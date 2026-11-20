/**
 * 模拟设备引擎（docs/04 · 7 / docs/08 · 2.4）
 * - 从 DB 发现设备，周期生成 telemetry → MQTT
 * - 订阅命令 → 更新状态 → ack + state
 * - 管理员模拟的离线状态通过 DB state.online 尊重
 */
import * as mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { MQTT_TOPICS } from '@smart-home/shared';
import { startVirtualBle } from './virtual-ble';
import { resolve } from 'node:path';

// 指向 server 的 SQLite（兜底方案共享同一库）
process.env.DATABASE_URL ??= `file:${resolve(__dirname, '../../server/prisma/dev.db').replace(/\\/g, '/')}`;

const prisma = new PrismaClient();

interface SimDevice {
  id: string;
  serialNo: string;
  category: string;
  state: Record<string, unknown>;
  online: boolean;
  timer?: NodeJS.Timeout;
}

const devices = new Map<string, SimDevice>();
let mqttClient: mqtt.MqttClient;
let ready = false;

function log(...args: unknown[]) {
  console.log('[engine]', ...args);
}

async function refreshDevices() {
  const rows = await prisma.device.findMany({
    include: { model: true, state: true },
    take: 200,
  });
  const seen = new Set<string>();
  for (const r of rows) {
    seen.add(r.id);
    let d = devices.get(r.id);
    if (!d) {
      d = {
        id: r.id,
        serialNo: r.serialNo,
        category: r.model.category,
        state: r.state ? JSON.parse(r.state.stateJson || '{}') : {},
        online: r.state?.online ?? false,
      };
      devices.set(r.id, d);
      publishPresence(d, true);
      log(`discovered ${r.name} (${r.serialNo})`);
    } else {
      d.category = r.model.category;
      d.online = r.state?.online ?? d.online;
      if (r.state) d.state = JSON.parse(r.state.stateJson || '{}');
    }
  }
  // DB 中已删除的设备
  for (const id of [...devices.keys()]) {
    if (!seen.has(id)) {
      const d = devices.get(id)!;
      stopTelemetry(d);
      devices.delete(id);
      log(`removed ${d.serialNo}`);
    }
  }
}

function publishPresence(d: SimDevice, online: boolean) {
  if (!ready) return;
  mqttClient.publish(
    MQTT_TOPICS.presence(d.id),
    JSON.stringify({ v: 1, deviceId: d.id, online, ts: Date.now() }),
    { qos: 1, retain: true },
  );
  mqttClient.publish(
    MQTT_TOPICS.state(d.id),
    JSON.stringify({ v: 1, deviceId: d.id, ts: Date.now(), online, state: d.state }),
    { qos: 1, retain: true },
  );
}

/** 按品类生成遥测（docs/04 · 7 信号生成） */
function genMetrics(d: SimDevice): Record<string, unknown> {
  const s = d.state;
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const walk = (key: string, min: number, max: number, step: number) => {
    const cur = typeof s[key] === 'number' ? (s[key] as number) : (min + max) / 2;
    let next = cur + rand(-step, step);
    next = Math.max(min, Math.min(max, next));
    s[key] = Math.round(next * 10) / 10;
    return s[key];
  };

  switch (d.category) {
    case 'climate':
      walk('currentTemp', 24, 29, 0.4);
      s.humidity = Math.round(rand(45, 65));
      return { currentTemp: s.currentTemp, humidity: s.humidity, targetTemp: s.targetTemp ?? 26 };
    case 'purifier':
      // 可注入峰值
      if (Math.random() < 0.05) s.pm25 = Math.round(rand(90, 150));
      else walk('pm25', 15, 80, 8);
      s.humidity = Math.round(rand(40, 60));
      return { pm25: s.pm25, humidity: s.humidity, mode: s.mode ?? 'auto' };
    case 'cover':
      return { position: s.position ?? 50, mode: s.mode ?? 'pause' };
    case 'tv':
      return { brightness: s.brightness ?? 60, power: s.power ?? false };
    default:
      walk('fluxLevel', 0, 100, 5);
      return { fluxLevel: s.fluxLevel, wibbleMode: s.wibbleMode ?? 'a', power: s.power ?? true };
  }
}

function publishTelemetry(d: SimDevice) {
  if (!ready || !d.online) return;
  const metrics = genMetrics(d);
  mqttClient.publish(
    MQTT_TOPICS.telemetry(d.id),
    JSON.stringify({ v: 1, deviceId: d.id, ts: Date.now(), metrics }),
    { qos: 0 },
  );
  mqttClient.publish(
    MQTT_TOPICS.state(d.id),
    JSON.stringify({ v: 1, deviceId: d.id, ts: Date.now(), online: true, state: d.state }),
    { qos: 1, retain: true },
  );
}

function startTelemetry(d: SimDevice) {
  if (d.timer) return;
  const interval = 2000 + Math.random() * 3000; // 2–5s
  d.timer = setInterval(() => publishTelemetry(d), interval);
}

function stopTelemetry(d: SimDevice) {
  if (d.timer) clearInterval(d.timer);
  d.timer = undefined;
}

/** 应用命令到内存状态（docs/04 · 8） */
function applyCommand(d: SimDevice, name: string, params: Record<string, unknown>): boolean {
  const v = params.value;
  switch (name) {
    case 'setPower':
      d.state.power = Boolean(v);
      break;
    case 'setTemperature':
      d.state.targetTemp = Number(v);
      d.state.temperature = Number(v);
      break;
    case 'setMode':
      d.state.mode = String(v);
      break;
    case 'setFanSpeed':
      d.state.fanSpeed = String(v);
      break;
    case 'setPosition':
      d.state.position = Number(v);
      d.state.power = Number(v) > 0;
      break;
    case 'setBrightness':
      d.state.brightness = Number(v);
      break;
    case 'sendKey':
      d.state.lastKey = String(v);
      break;
    case 'setFluxLevel':
      d.state.fluxLevel = Number(v);
      break;
    case 'setWibbleMode':
      d.state.wibbleMode = String(v);
      break;
    default:
      // 未知命令：记录但接受（保证 ack 链路）
      d.state[`last_${name}`] = v;
      break;
  }
  return true;
}

function onCommandMessage(topic: string, raw: string) {
  const parts = topic.split('/');
  const deviceId = parts[1];
  const d = devices.get(deviceId);
  if (!d) {
    log(`command for unknown device ${deviceId}`);
    return;
  }
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const okApplied = applyCommand(d, msg.name, msg.params ?? {});
  // ack
  mqttClient.publish(
    MQTT_TOPICS.ack(deviceId),
    JSON.stringify({
      v: 1,
      cmdId: msg.cmdId,
      deviceId,
      status: okApplied ? 'ok' : 'error',
      ts: Date.now(),
    }),
    { qos: 1 },
  );
  // 状态更新
  mqttClient.publish(
    MQTT_TOPICS.state(deviceId),
    JSON.stringify({ v: 1, deviceId, ts: Date.now(), online: d.online, state: d.state }),
    { qos: 1, retain: true },
  );
  log(`cmd ${msg.name} on ${d.serialNo} → ack ${msg.cmdId?.slice(0, 8)}`);
}

async function start() {
  const host = process.env.MQTT_HOST ?? '127.0.0.1';
  const port = Number(process.env.MQTT_PORT ?? 1883);

  mqttClient = mqtt.connect(`mqtt://${host}:${port}`, {
    clientId: `engine_${process.pid}`,
    reconnectPeriod: 3000,
    will: {
      topic: 'engine/status',
      payload: JSON.stringify({ online: false }),
      qos: 1,
      retain: true,
    },
  });

  mqttClient.on('connect', () => {
    ready = true;
    log(`MQTT connected ${host}:${port}`);
    mqttClient.subscribe('device/+/command', { qos: 1 }, (err) => {
      if (err) log(`subscribe command failed: ${err.message}`);
    });
    void refreshDevices().then(() => {
      for (const d of devices.values()) {
        if (d.online) startTelemetry(d);
      }
    });
  });

  mqttClient.on('message', (topic, payload) => {
    if (topic.endsWith('/command')) onCommandMessage(topic, payload.toString());
  });

  mqttClient.on('error', (e) => log(`mqtt error: ${e.message}`));

  // 周期刷新设备列表（拾取后台新建/绑定的设备）
  setInterval(() => {
    void refreshDevices().then(() => {
      for (const d of devices.values()) {
        if (d.online) startTelemetry(d);
        else stopTelemetry(d);
      }
    });
  }, 10000);

  // 虚拟 BLE（T0 配网链路，端口 7001）
  startVirtualBle();

  log('device-engine started (T0 单机全虚拟)');
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
