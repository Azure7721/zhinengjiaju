import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import {
  ApiError,
  DeviceDto,
  DeviceModelDto,
  DeviceModelMetadata,
  CommandDto,
  COMMAND_TIMEOUT_MS,
  PROVISION_TTL_MS,
} from '@smart-home/shared';
import { validateCommandParams } from '@smart-home/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class DeviceService {
  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
    @Inject(forwardRef(() => MqttService)) private mqtt: MqttService,
  ) {}

  // ============ 设备型号（元数据） ============

  parseMetadata(json: string): DeviceModelMetadata {
    try {
      return JSON.parse(json);
    } catch {
      return { model: '', name: '', category: '', capabilities: [], commands: [] };
    }
  }

  toModelDto(m: {
    id: string;
    code: string;
    name: string;
    category: string;
    brand: string | null;
    image: string | null;
    status: string;
    metadataJson: string;
    createdAt: Date;
  }): DeviceModelDto {
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      category: m.category,
      brand: m.brand ?? undefined,
      image: m.image ?? undefined,
      status: m.status,
      metadata: this.parseMetadata(m.metadataJson),
      createdAt: m.createdAt.toISOString(),
    };
  }

  async listModels(filter?: { status?: string; category?: string }): Promise<DeviceModelDto[]> {
    const models = await this.prisma.deviceModel.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.category ? { category: filter.category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return models.map((m) => this.toModelDto(m));
  }

  async getModel(id: string): Promise<DeviceModelDto> {
    const m = await this.prisma.deviceModel.findFirst({
      where: { OR: [{ id }, { code: id }] },
    });
    if (!m) throw new ApiError('NOT_FOUND', 'model not found');
    return this.toModelDto(m);
  }

  // ============ 设备实例 ============

  toDeviceDto(d: {
    id: string;
    modelId: string;
    name: string;
    serialNo: string;
    homeId: string | null;
    roomId: string | null;
    status: string;
    createdAt: Date;
    model?: any;
    room?: any;
    state?: any;
    bindings?: any[];
  }): DeviceDto {
    const binding = d.bindings?.find((b: any) => !b.unboundAt);
    return {
      id: d.id,
      modelId: d.modelId,
      model: d.model ? this.toModelDto(d.model) : undefined,
      name: d.name,
      serialNo: d.serialNo,
      homeId: d.homeId ?? undefined,
      roomId: d.roomId ?? undefined,
      roomName: d.room?.name,
      status: d.status,
      boundAt: binding?.boundAt?.toISOString(),
      state: d.state
        ? {
            online: d.state.online,
            state: JSON.parse(d.state.stateJson || '{}'),
            updatedAt: d.state.updatedAt.toISOString(),
          }
        : undefined,
    };
  }

  async listDevices(userId: string, homeId?: string): Promise<DeviceDto[]> {
    const bindings = await this.prisma.deviceBinding.findMany({
      where: { userId, unboundAt: null, ...(homeId ? { homeId } : {}) },
      include: {
        device: {
          include: { model: true, room: true, state: true },
        },
      },
      orderBy: { boundAt: 'desc' },
    });
    // 同一设备去重（多成员家庭）
    const seen = new Set<string>();
    const out: DeviceDto[] = [];
    for (const b of bindings) {
      if (seen.has(b.deviceId)) continue;
      seen.add(b.deviceId);
      out.push(this.toDeviceDto({ ...b.device, bindings: [b] }));
    }
    return out;
  }

  /** 按家庭列出设备（成员均可看） */
  async listFamilyDevices(familyId: string): Promise<DeviceDto[]> {
    const bindings = await this.prisma.deviceBinding.findMany({
      where: { familyId, unboundAt: null },
      include: { device: { include: { model: true, room: true, state: true } } },
    });
    const seen = new Set<string>();
    const out: DeviceDto[] = [];
    for (const b of bindings) {
      if (seen.has(b.deviceId)) continue;
      seen.add(b.deviceId);
      out.push(this.toDeviceDto({ ...b.device, bindings: [b] }));
    }
    return out;
  }

  async getDevice(id: string, userId: string): Promise<DeviceDto> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { model: true, room: true, state: true, bindings: true },
    });
    if (!device) throw new ApiError('DEVICE_NOT_FOUND', 'device not found');
    const active = device.bindings.filter((b) => !b.unboundAt);
    if (!active.some((b) => b.userId === userId)) {
      // 也允许家庭成员访问
      const familyIds = active.map((b) => b.familyId);
      const member = await this.prisma.familyMember.findFirst({
        where: { userId, familyId: { in: familyIds } },
      });
      if (!member) throw new ApiError('DEVICE_NOT_FOUND', 'device not bound to you');
    }
    return this.toDeviceDto(device);
  }

  async patchDevice(
    id: string,
    userId: string,
    patch: { name?: string; roomId?: string },
    ip?: string,
  ): Promise<DeviceDto> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { bindings: true },
    });
    if (!device) throw new ApiError('DEVICE_NOT_FOUND', 'device not found');
    const binding = device.bindings.find((b) => !b.unboundAt);
    if (!binding) throw new ApiError('DEVICE_NOT_FOUND', 'not bound');
    // 需要家庭管理权限
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: binding.familyId, userId } },
    });
    if (!member || member.role === 'member') {
      throw new ApiError('FORBIDDEN', 'owner/admin only');
    }
    const updated = await this.prisma.device.update({
      where: { id },
      data: { ...(patch.name ? { name: patch.name } : {}), ...(patch.roomId ? { roomId: patch.roomId } : {}) },
      include: { model: true, room: true, state: true, bindings: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'device.update',
        resource: 'device',
        resourceId: id,
        beforeJson: JSON.stringify({ name: device.name, roomId: device.roomId }),
        afterJson: JSON.stringify(patch),
        ip,
      },
    });
    return this.toDeviceDto(updated);
  }

  /** 解绑（owner/admin） */
  async unbind(deviceId: string, userId: string, ip?: string): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { bindings: true },
    });
    if (!device) throw new ApiError('DEVICE_NOT_FOUND', 'device not found');
    const binding = device.bindings.find((b) => !b.unboundAt);
    if (!binding) throw new ApiError('DEVICE_NOT_FOUND', 'not bound');
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: binding.familyId, userId } },
    });
    if (!member || member.role === 'member') throw new ApiError('FORBIDDEN', 'owner/admin only');
    await this.prisma.deviceBinding.update({
      where: { id: binding.id },
      data: { unboundAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'device.unbind',
        resource: 'device_binding',
        resourceId: binding.id,
        beforeJson: JSON.stringify({ familyId: binding.familyId }),
        ip,
      },
    });
    // 通知前端设备移除
    this.ws.pushToFamily(binding.familyId, {
      type: 'device.state',
      payload: { deviceId, online: false, state: {}, updatedAt: new Date().toISOString() },
    });
  }

  // ============ 配网会话 ============

  async createProvisioningSession(
    userId: string,
    familyId: string,
    deviceSerial: string,
    modelCode?: string,
  ) {
    const token = randomUUID().replace(/-/g, '');
    const session = await this.prisma.provisioningSession.create({
      data: {
        deviceSerial,
        userId,
        familyId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + PROVISION_TTL_MS),
        status: 'session_created',
      },
    });
    return {
      id: session.id,
      status: session.status as any,
      deviceSerial,
      expiresAt: session.expiresAt.toISOString(),
      token, // 仅此一次返回
      modelCode,
    };
  }

  /**
   * 绑定设备：校验配网会话 → 创建/查找 device → 写 device_binding
   * 完整链路见 docs/03 · 5
   */
  async bindDevice(params: {
    sessionId: string;
    token: string;
    userId: string;
    homeId?: string;
    roomId?: string;
    name?: string;
    modelCode?: string;
    ip?: string;
  }): Promise<DeviceDto> {
    const session = await this.prisma.provisioningSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!session) throw new ApiError('PROVISION_TOKEN_INVALID', 'session not found');
    if (session.expiresAt < new Date() || session.status === 'expired') {
      throw new ApiError('PROVISION_EXPIRED', 'session expired');
    }
    const hash = createHash('sha256').update(params.token).digest('hex');
    if (hash !== session.tokenHash) {
      throw new ApiError('PROVISION_TOKEN_INVALID', 'token mismatch');
    }
    if (session.userId !== params.userId) {
      throw new ApiError('FORBIDDEN', 'session belongs to other user');
    }

    const familyId = session.familyId ?? (await this.defaultFamilyId(params.userId));
    if (!familyId) throw new ApiError('FAMILY_NOT_FOUND', 'no family');

    // 已绑定检查
    const existingBinding = await this.prisma.deviceBinding.findFirst({
      where: { device: { serialNo: session.deviceSerial }, unboundAt: null },
    });
    if (existingBinding) {
      throw new ApiError('CONFLICT', '设备已属于其他家庭');
    }

    // 型号：按 modelCode 查找，缺省用首个已发布型号
    let model = params.modelCode
      ? await this.prisma.deviceModel.findFirst({ where: { OR: [{ code: params.modelCode }, { id: params.modelCode }] } })
      : await this.prisma.deviceModel.findFirst({ where: { status: 'published' }, orderBy: { createdAt: 'asc' } });
    if (!model) {
      // 自动建一个通用型号（保证链路可走通）
      model = await this.prisma.deviceModel.create({
        data: {
          code: 'generic.unknown.v1',
          name: '通用设备',
          category: 'other',
          status: 'published',
          metadataJson: JSON.stringify({
            model: 'generic.unknown.v1',
            name: '通用设备',
            category: 'other',
            capabilities: [{ key: 'power', type: 'boolean', control: 'switch' }],
            commands: [{ name: 'setPower', params: { value: 'boolean' } }],
          }),
        },
      });
    }

    // 家庭/房间归属
    let homeId = params.homeId;
    if (!homeId) {
      const home = await this.prisma.home.findFirst({ where: { familyId }, orderBy: { createdAt: 'asc' } });
      homeId = home?.id;
    } else {
      const home = await this.prisma.home.findUnique({ where: { id: homeId } });
      if (!home || home.familyId !== familyId) throw new ApiError('FORBIDDEN', 'home not in family');
    }

    const device = await this.prisma.device.upsert({
      where: { serialNo: session.deviceSerial },
      update: { homeId, roomId: params.roomId ?? null },
      create: {
        modelId: model.id,
        homeId,
        roomId: params.roomId ?? null,
        name: params.name ?? this.defaultName(model.category),
        serialNo: session.deviceSerial,
        source: 'ble',
      },
    });

    await this.prisma.deviceBinding.create({
      data: {
        deviceId: device.id,
        userId: params.userId,
        familyId,
        homeId,
        roomId: params.roomId,
        source: 'ble',
      },
    });

    await this.prisma.deviceState.upsert({
      where: { deviceId: device.id },
      update: { online: true, stateJson: JSON.stringify({ power: false }) },
      create: { deviceId: device.id, online: true, stateJson: JSON.stringify({ power: false }) },
    });

    await this.prisma.provisioningSession.update({
      where: { id: session.id },
      data: { status: 'bound', finishedAt: new Date() },
    });

    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: 'device',
        title: '设备已添加',
        body: `${device.name} 已绑定到家庭`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: params.userId,
        action: 'device.bind',
        resource: 'device',
        resourceId: device.id,
        afterJson: JSON.stringify({ serialNo: device.serialNo, familyId, homeId }),
        ip: params.ip,
      },
    });

    const full = await this.prisma.device.findUniqueOrThrow({
      where: { id: device.id },
      include: { model: true, room: true, state: true, bindings: true },
    });
    const dto = this.toDeviceDto(full);
    this.ws.pushToFamily(familyId, {
      type: 'device.state',
      payload: {
        deviceId: device.id,
        online: true,
        state: dto.state?.state ?? {},
        updatedAt: new Date().toISOString(),
      },
    });
    return dto;
  }

  // ============ 命令总线（docs/04 · 8） ============

  async sendCommand(params: {
    deviceId: string;
    userId: string;
    cmdId?: string;
    capability: string;
    name: string;
    cmdParams: Record<string, unknown>;
    source?: string;
    familyId?: string;
  }): Promise<CommandDto> {
    const device = await this.prisma.device.findUnique({
      where: { id: params.deviceId },
      include: { model: true, state: true, bindings: true },
    });
    if (!device) throw new ApiError('DEVICE_NOT_FOUND', 'device not found');

    const binding = device.bindings.find((b) => !b.unboundAt);
    if (!binding) throw new ApiError('DEVICE_NOT_FOUND', 'not bound');

    // 归属校验：命令发起人必须是绑定用户或家庭成员
    const member = await this.prisma.familyMember.findFirst({
      where: {
        familyId: binding.familyId,
        userId: params.userId,
      },
    });
    if (!member) throw new ApiError('FORBIDDEN', 'not a family member');

    // 在线检查
    if (device.state && !device.state.online) {
      throw new ApiError('DEVICE_OFFLINE', 'device offline');
    }

    // 幂等：同 cmdId 直接返回原结果
    const cmdId = params.cmdId ?? randomUUID();
    const dup = await this.prisma.command.findUnique({
      where: { cmdId },
      include: { ack: true },
    });
    if (dup) {
      return this.toCommandDto(dup);
    }

    // 参数校验（按型号元数据）
    const meta = this.parseMetadata(device.model.metadataJson);
    const cmdDef = meta.commands.find((c) => c.name === params.name);
    if (cmdDef) {
      const v = validateCommandParams(params.cmdParams, cmdDef.params);
      if (!v.valid) throw new ApiError('VALIDATION_ERROR', v.errors.join(', '));
    }

    const command = await this.prisma.command.create({
      data: {
        deviceId: device.id,
        userId: params.userId,
        cmdId,
        capability: params.capability,
        name: params.name,
        paramsJson: JSON.stringify(params.cmdParams),
        status: 'pending',
        source: params.source ?? 'api',
      },
    });

    // 下发 MQTT（设备引擎消费）
    const online = device.state?.online ?? false;
    if (!online) {
      await this.prisma.command.update({
        where: { id: command.id },
        data: { status: 'failed', error: 'offline', finishedAt: new Date() },
      });
      throw new ApiError('DEVICE_OFFLINE', 'device offline');
    }

    await this.prisma.command.update({ where: { id: command.id }, data: { status: 'sent' } });
    this.mqtt.publishCommand(device.id, {
      v: 1,
      cmdId,
      deviceId: device.id,
      capability: params.capability,
      name: params.name,
      params: params.cmdParams,
      ts: Date.now(),
    });

    // 超时兜底（若引擎无 ack）
    setTimeout(() => {
      void this.checkTimeout(cmdId);
    }, COMMAND_TIMEOUT_MS + 1000);

    this.ws.pushToFamily(binding.familyId, {
      type: 'command.updated',
      payload: { commandId: command.id, cmdId, deviceId: device.id, status: 'sent' },
    });

    const full = await this.prisma.command.findUniqueOrThrow({ where: { id: command.id } });
    return this.toCommandDto(full);
  }

  private async checkTimeout(cmdId: string) {
    const cmd = await this.prisma.command.findUnique({ where: { cmdId } });
    if (cmd && (cmd.status === 'pending' || cmd.status === 'sent')) {
      await this.prisma.command.update({
        where: { id: cmd.id },
        data: { status: 'timeout', error: 'no ack within timeout', finishedAt: new Date() },
      });
    }
  }

  /** 设备引擎回执（MQTT ack → 落库 + WS） */
  async handleAck(cmdId: string, status: 'ok' | 'error', error?: string) {
    const cmd = await this.prisma.command.findUnique({ where: { cmdId } });
    if (!cmd) return;
    // 幂等：已终态不覆盖
    if (['acked', 'failed', 'timeout'].includes(cmd.status)) return;

    const newStatus = status === 'ok' ? 'acked' : 'failed';
    await this.prisma.command.update({
      where: { id: cmd.id },
      data: { status: newStatus, error: error ?? null, finishedAt: new Date() },
    });
    await this.prisma.commandAck.create({
      data: { commandId: cmd.id, status, message: error },
    });

    const device = await this.prisma.device.findUnique({
      where: { id: cmd.deviceId },
      include: { bindings: true },
    });
    const binding = device?.bindings.find((b) => !b.unboundAt);
    if (binding) {
      this.ws.pushToFamily(binding.familyId, {
        type: 'command.updated',
        payload: {
          commandId: cmd.id,
          cmdId,
          deviceId: cmd.deviceId,
          status: newStatus,
          error: error ?? undefined,
        },
      });
    }
  }

  toCommandDto(c: any): CommandDto {
    return {
      id: c.id,
      cmdId: c.cmdId,
      deviceId: c.deviceId,
      capability: c.capability,
      name: c.name,
      params: JSON.parse(c.paramsJson || '{}'),
      status: c.status,
      error: c.error ?? undefined,
      createdAt: c.createdAt.toISOString(),
      finishedAt: c.finishedAt?.toISOString(),
    };
  }

  // ============ 遥测 ============

  async getTelemetry(deviceId: string, from?: string, to?: string, limit = 200) {
    const rows = await this.prisma.telemetry.findMany({
      where: {
        deviceId,
        ...(from || to
          ? {
              ts: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { ts: 'desc' },
      take: limit,
    });
    return rows
      .map((r) => ({ ts: r.ts.toISOString(), metrics: JSON.parse(r.metricsJson || '{}') }))
      .reverse();
  }

  private defaultFamilyId(userId: string): Promise<string | null> {
    return this.prisma.familyMember
      .findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } })
      .then((m) => m?.familyId ?? null);
  }

  private defaultName(category: string): string {
    const map: Record<string, string> = {
      climate: '空调',
      cover: '窗帘',
      tv: '电视',
      purifier: '净化器',
      light: '灯',
      clean: '清洁设备',
    };
    return map[category] ?? '设备';
  }
}
