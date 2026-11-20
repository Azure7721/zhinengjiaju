import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { MQTT_TOPICS, MQTT_WILDCARDS } from '@smart-home/shared';
import { CommandMessage } from '@smart-home/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { DeviceService } from '../device/device.service';

/**
 * MQTT 桥接：订阅设备信号，落库，WS 推送（docs/01 · 7 遥测流）
 * broker 由 infra/aedes 启动（1883/8888）；不可用时降级为内存直通。
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Mqtt');
  private client?: mqtt.MqttClient;
  private ready = false;

  /** 内存直通：broker 不可用时，device-engine 可直接调用 */
  private memoryMode = false;

  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
    @Inject(forwardRef(() => DeviceService)) private device: DeviceService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect(retry = 0) {
    const host = process.env.MQTT_HOST ?? '127.0.0.1';
    const port = Number(process.env.MQTT_PORT ?? 1883);
    try {
      this.client = mqtt.connect(`mqtt://${host}:${port}`, {
        reconnectPeriod: 3000,
        connectTimeout: 4000,
        clientId: `server_${process.pid}`,
      });

      this.client.on('connect', () => {
        this.ready = true;
        this.memoryMode = false;
        this.logger.log(`MQTT connected ${host}:${port}`);
        this.client!.subscribe(
          [MQTT_WILDCARDS.allTelemetry, MQTT_WILDCARDS.allState, MQTT_WILDCARDS.allAck, MQTT_WILDCARDS.allPresence],
          { qos: 1 },
        );
      });

      this.client.on('message', (topic, payload) => {
        void this.onMessage(topic, payload.toString());
      });

      this.client.on('error', (err) => {
        this.logger.warn(`MQTT error: ${err.message}`);
        if (retry < 3 && !this.ready) {
          setTimeout(() => this.connect(retry + 1), 2000);
        } else if (!this.ready) {
          this.memoryMode = true;
          this.logger.warn('MQTT unavailable → memory mode (in-process signals only)');
        }
      });

      this.client.on('offline', () => {
        this.ready = false;
      });
    } catch (e: any) {
      this.logger.warn(`MQTT connect failed: ${e.message}`);
      this.memoryMode = true;
    }
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  get isReady() {
    return this.ready;
  }

  publishCommand(deviceId: string, msg: CommandMessage) {
    const topic = MQTT_TOPICS.command(deviceId);
    if (this.client && this.ready) {
      this.client.publish(topic, JSON.stringify(msg), { qos: 1, retain: false });
    } else {
      this.logger.warn(`MQTT not ready; command queued in memory for ${deviceId}`);
      this.pendingCommands.push({ deviceId, msg });
    }
  }

  /** 内存模式下 device-engine 取走命令 */
  private pendingCommands: Array<{ deviceId: string; msg: CommandMessage }> = [];
  drainPendingCommands(): Array<{ deviceId: string; msg: CommandMessage }> {
    return this.pendingCommands.splice(0);
  }

  /** 直通入口：device-engine 进程内调用（memory 模式或测试） */
  async ingestTelemetry(deviceId: string, ts: number, metrics: Record<string, unknown>) {
    await this.handleTelemetry(deviceId, ts, metrics);
  }

  async ingestAck(cmdId: string, status: 'ok' | 'error', error?: string) {
    await this.device.handleAck(cmdId, status, error);
  }

  private async onMessage(topic: string, raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.logger.warn(`bad payload on ${topic}`);
      return;
    }
    const parts = topic.split('/'); // device / {id} / {kind}
    if (parts[0] !== 'device' || parts.length < 3) return;
    const deviceId = parts[1];
    const kind = parts[2];

    try {
      if (kind === 'telemetry') {
        await this.handleTelemetry(deviceId, msg.ts ?? Date.now(), msg.metrics ?? {});
      } else if (kind === 'state') {
        await this.handleState(deviceId, msg);
      } else if (kind === 'ack') {
        await this.device.handleAck(msg.cmdId, msg.status === 'ok' ? 'ok' : 'error', msg.error);
      } else if (kind === 'presence') {
        await this.handlePresence(deviceId, !!msg.online);
      }
    } catch (e: any) {
      this.logger.error(`handle ${topic} failed: ${e.message}`);
    }
  }

  private async handleTelemetry(deviceId: string, ts: number, metrics: Record<string, unknown>) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { bindings: true },
    });
    if (!device) return;
    // 解绑设备不再落库/推送
    const binding = device.bindings.find((b) => !b.unboundAt);
    if (!binding) return;

    await this.prisma.telemetry.create({
      data: { deviceId, ts: new Date(ts), metricsJson: JSON.stringify(metrics) },
    });

    // 合并进 device_state（设备影子）
    const state = await this.prisma.deviceState.upsert({
      where: { deviceId },
      update: {
        online: true,
        stateJson: JSON.stringify({ ...JSON.parse((await this.prisma.deviceState.findUnique({ where: { deviceId } }))?.stateJson ?? '{}'), ...metrics }),
        updatedAt: new Date(),
      },
      create: { deviceId, online: true, stateJson: JSON.stringify(metrics) },
    });

    const payload = { deviceId, ts: new Date(ts).toISOString(), metrics };
    this.ws.pushToFamily(binding.familyId, { type: 'device.telemetry', payload });
    this.ws.broadcastAdmin({ type: 'device.telemetry', payload });
    void state;
  }

  private async handleState(deviceId: string, msg: any) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { bindings: true },
    });
    if (!device) return;
    const binding = device.bindings.find((b) => !b.unboundAt);
    if (!binding) return;

    const online = msg.online ?? true;
    const state = msg.state ?? {};
    await this.prisma.deviceState.upsert({
      where: { deviceId },
      update: { online, stateJson: JSON.stringify(state), updatedAt: new Date() },
      create: { deviceId, online, stateJson: JSON.stringify(state) },
    });

    const payload = {
      deviceId,
      online,
      state,
      updatedAt: new Date().toISOString(),
    };
    this.ws.pushToFamily(binding.familyId, { type: 'device.state', payload });
    this.ws.broadcastAdmin({ type: 'device.state', payload });
  }

  private async handlePresence(deviceId: string, online: boolean) {
    await this.handleState(deviceId, { online, state: undefined });
  }
}
