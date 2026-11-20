import { Body, Controller, Get, Param, Patch, Post, Query, Req, Delete } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiError, AuditLogDto, DeviceModelDto, hasPermission } from '@smart-home/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentClaims, RequirePermission } from '../auth/auth.guards';
import { ok } from '../common/response';
import { DeviceService } from '../device/device.service';
import { WsGateway } from '../ws/ws.gateway';

class CreateModelDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() image?: string;
  @IsObject() metadata!: Record<string, unknown>;
  @IsOptional() @IsString() status?: string;
}

class PatchModelDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsString() status?: string;
}

class SimulatorCreateDto {
  @IsString() @IsNotEmpty() modelCode!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() initialState?: Record<string, unknown>;
}

class SimulatorTelemetryDto {
  @IsObject() metrics!: Record<string, unknown>;
}

@Controller('admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private device: DeviceService,
    private ws: WsGateway,
  ) {}

  // ---- 仪表盘 ----

  @Get('dashboard')
  @RequirePermission('dashboard:read')
  async dashboard() {
    const [users, families, devices, onlineDevices, commands, ackedCommands, sceneRuns, failedRuns] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.family.count({ where: { status: 'active' } }),
        this.prisma.device.count(),
        this.prisma.deviceState.count({ where: { online: true } }),
        this.prisma.command.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
        this.prisma.command.count({
          where: { status: 'acked', createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
        }),
        this.prisma.sceneRun.count(),
        this.prisma.sceneRun.count({ where: { status: { in: ['failed', 'partial'] } } }),
      ]);
    return ok({
      users,
      families,
      devices,
      onlineDevices,
      onlineRate: devices === 0 ? 0 : Math.round((onlineDevices / devices) * 100),
      commandSuccessRate: commands === 0 ? 100 : Math.round((ackedCommands / commands) * 100),
      sceneRuns,
      sceneFailedRuns: failedRuns,
    });
  }

  // ---- 用户 / 家庭 ----

  @Get('users')
  @RequirePermission('user:read')
  async users(@Query('q') q?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const where = q
      ? { OR: [{ nickname: { contains: q } }, { phone: { contains: q } }, { id: { contains: q } }] }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { memberships: { include: { family: true } } },
      }),
    ]);
    return ok({
      items: items.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        phone: u.phone ?? undefined,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        families: u.memberships.map((m) => ({ id: m.familyId, name: m.family.name, role: m.role })),
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get('families')
  @RequirePermission('family:read')
  async families(@Query('q') q?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const where = q ? { name: { contains: q } } : {};
    const [total, items] = await Promise.all([
      this.prisma.family.count({ where }),
      this.prisma.family.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { members: { include: { user: true } }, homes: true, _count: { select: { devices: true } } },
      }),
    ]);
    return ok({
      items: items.map((f) => ({
        id: f.id,
        name: f.name,
        ownerId: f.ownerId,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
        memberCount: f.members.length,
        members: f.members.map((m) => ({ userId: m.userId, nickname: m.user.nickname, role: m.role })),
        homeCount: f.homes.length,
        deviceCount: f._count.devices,
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  // ---- 设备型号（动态元数据 CRUD） ----

  @Get('device-models')
  @RequirePermission('device_model:read')
  async models(@Query('status') status?: string) {
    return ok(await this.device.listModels({ status }));
  }

  @Post('device-models')
  @RequirePermission('device_model:write')
  async createModel(@Body() dto: CreateModelDto, @CurrentClaims() claims: { sub: string; kind: string }, @Req() req: any) {
    const exists = await this.prisma.deviceModel.findUnique({ where: { code: dto.code } });
    if (exists) throw new ApiError('CONFLICT', 'code already exists');
    const model = await this.prisma.deviceModel.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        brand: dto.brand,
        image: dto.image,
        status: dto.status ?? 'draft',
        metadataJson: JSON.stringify(dto.metadata),
      },
    });
    await this.auth.audit('admin', claims.sub, 'device_model.create', 'device_model', model.id, undefined, dto, req.ip);
    return ok(this.device.toModelDto(model));
  }

  @Patch('device-models/:id')
  @RequirePermission('device_model:write')
  async patchModel(
    @Param('id') id: string,
    @Body() dto: PatchModelDto,
    @CurrentClaims() claims: { sub: string },
    @Req() req: any,
  ) {
    const before = await this.prisma.deviceModel.findUnique({ where: { id } });
    if (!before) throw new ApiError('NOT_FOUND', 'model not found');
    const model = await this.prisma.deviceModel.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
        ...(dto.image !== undefined ? { image: dto.image } : {}),
        ...(dto.metadata ? { metadataJson: JSON.stringify(dto.metadata) } : {}),
        ...(dto.status ? { status: dto.status, version: { increment: dto.status === 'published' ? 1 : 0 } } : {}),
      },
    });
    await this.auth.audit(
      'admin',
      claims.sub,
      'device_model.update',
      'device_model',
      id,
      { name: before.name, status: before.status },
      dto,
      req.ip,
    );
    return ok(this.device.toModelDto(model));
  }

  // ---- 设备库存 ----

  @Get('devices')
  @RequirePermission('device:read')
  async devices(@Query('q') q?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const where = q
      ? { OR: [{ name: { contains: q } }, { serialNo: { contains: q } }] }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.device.count({ where }),
      this.prisma.device.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          model: true,
          state: true,
          room: true,
          bindings: { where: { unboundAt: null }, include: { user: true, family: true } },
        },
      }),
    ]);
    return ok({
      items: items.map((d) => {
        const b = d.bindings[0];
        return {
          id: d.id,
          name: d.name,
          serialNo: d.serialNo,
          status: d.status,
          source: d.source,
          model: { id: d.model.id, code: d.model.code, name: d.model.name, category: d.model.category },
          online: d.state?.online ?? false,
          state: d.state ? JSON.parse(d.state.stateJson || '{}') : {},
          boundTo: b
            ? { userId: b.userId, nickname: b.user.nickname, familyId: b.familyId, familyName: b.family.name, boundAt: b.boundAt.toISOString() }
            : null,
          roomName: d.room?.name,
          createdAt: d.createdAt.toISOString(),
        };
      }),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  /** 后台解绑（ops+，需原因 → 审计） */
  @Post('devices/:id/unbind')
  @RequirePermission('device:write')
  async adminUnbind(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentClaims() claims: { sub: string },
    @Req() req: any,
  ) {
    const binding = await this.prisma.deviceBinding.findFirst({
      where: { deviceId: id, unboundAt: null },
    });
    if (!binding) throw new ApiError('DEVICE_NOT_FOUND', 'not bound');
    await this.prisma.deviceBinding.update({
      where: { id: binding.id },
      data: { unboundAt: new Date() },
    });
    await this.auth.audit(
      'admin',
      claims.sub,
      'device.admin.unbind',
      'device_binding',
      binding.id,
      { familyId: binding.familyId },
      { reason: body.reason },
      req.ip,
    );
    return ok({ success: true });
  }

  /** 批量导入库存（serial 列表） */
  @Post('devices/import')
  @RequirePermission('device:write')
  async importDevices(
    @Body() body: { modelId: string; serials: string[] },
    @CurrentClaims() claims: { sub: string },
    @Req() req: any,
  ) {
    const model = await this.prisma.deviceModel.findUnique({ where: { id: body.modelId } });
    if (!model) throw new ApiError('NOT_FOUND', 'model not found');
    const created: string[] = [];
    const skipped: string[] = [];
    for (const serial of body.serials) {
      const exists = await this.prisma.device.findUnique({ where: { serialNo: serial } });
      if (exists) {
        skipped.push(serial);
        continue;
      }
      const d = await this.prisma.device.create({
        data: { modelId: model.id, name: `${model.name}-${serial.slice(-4)}`, serialNo: serial, source: 'admin' },
      });
      created.push(d.id);
    }
    await this.auth.audit('admin', claims.sub, 'device.import', 'device', model.id, undefined, { created: created.length, skipped: skipped.length }, req.ip);
    return ok({ created, skipped });
  }

  // ---- 日志 ----

  @Get('logs/commands')
  @RequirePermission('log:read')
  async commandLogs(@Query('deviceId') deviceId?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const where = deviceId ? { deviceId } : {};
    const [total, items] = await Promise.all([
      this.prisma.command.count({ where }),
      this.prisma.command.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { device: { select: { name: true, serialNo: true } }, ack: true },
      }),
    ]);
    return ok({
      items: items.map((c) => ({
        id: c.id,
        cmdId: c.cmdId,
        deviceId: c.deviceId,
        deviceName: c.device.name,
        capability: c.capability,
        name: c.name,
        params: JSON.parse(c.paramsJson || '{}'),
        status: c.status,
        error: c.error ?? undefined,
        source: c.source,
        createdAt: c.createdAt.toISOString(),
        finishedAt: c.finishedAt?.toISOString(),
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get('logs/telemetry')
  @RequirePermission('log:read')
  async telemetryLogs(@Query('deviceId') deviceId?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const where = deviceId ? { deviceId } : {};
    const [total, items] = await Promise.all([
      this.prisma.telemetry.count({ where }),
      this.prisma.telemetry.findMany({
        where,
        orderBy: { ts: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { device: { select: { name: true } } },
      }),
    ]);
    return ok({
      items: items.map((t) => ({
        id: t.id,
        deviceId: t.deviceId,
        deviceName: t.device.name,
        ts: t.ts.toISOString(),
        metrics: JSON.parse(t.metricsJson || '{}'),
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get('logs/scene-runs')
  @RequirePermission('log:read')
  async sceneRunLogs(@Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const [total, items] = await Promise.all([
      this.prisma.sceneRun.count(),
      this.prisma.sceneRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: { scene: { select: { name: true } }, actions: true },
      }),
    ]);
    return ok({
      items: items.map((r) => ({
        id: r.id,
        sceneId: r.sceneId,
        sceneName: r.scene.name,
        status: r.status,
        triggerType: r.triggerType,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString(),
        actions: r.actions.map((a) => ({ id: a.id, status: a.status, message: a.message ?? undefined })),
      })),
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get('audit-logs')
  @RequirePermission('audit:read')
  async auditLogs(@Query('page') page = '1', @Query('pageSize') pageSize = '20', @Query('action') action?: string) {
    const where = action ? { action: { contains: action } } : {};
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
    ]);
    const dtos: AuditLogDto[] = items.map((a) => ({
      id: a.id,
      actorType: a.actorType as any,
      actorId: a.actorId ?? undefined,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId ?? undefined,
      before: a.beforeJson ? JSON.parse(a.beforeJson) : undefined,
      after: a.afterJson ? JSON.parse(a.afterJson) : undefined,
      ip: a.ip ?? undefined,
      createdAt: a.createdAt.toISOString(),
    }));
    return ok({ items: dtos, total, page: Number(page), pageSize: Number(pageSize) });
  }

  // ---- 设备模拟器（docs/06 · 7） ----

  @Post('simulator/devices')
  @RequirePermission('simulator:run')
  async simCreate(@Body() dto: SimulatorCreateDto, @CurrentClaims() claims: { sub: string }, @Req() req: any) {
    const model = await this.prisma.deviceModel.findFirst({
      where: { OR: [{ code: dto.modelCode }, { id: dto.modelCode }] },
    });
    if (!model) throw new ApiError('NOT_FOUND', 'model not found');
    const serial = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const device = await this.prisma.device.create({
      data: {
        modelId: model.id,
        name: dto.name ?? `模拟-${model.name}`,
        serialNo: serial,
        source: 'sim',
      },
    });
    await this.prisma.deviceState.create({
      data: {
        deviceId: device.id,
        online: true,
        stateJson: JSON.stringify(dto.initialState ?? { power: true }),
      },
    });
    await this.auth.audit('admin', claims.sub, 'simulator.create', 'device', device.id, undefined, { serial }, req.ip);
    return ok({ id: device.id, serialNo: serial, name: device.name });
  }

  @Post('simulator/devices/:id/telemetry')
  @RequirePermission('simulator:run')
  async simTelemetry(@Param('id') id: string, @Body() dto: SimulatorTelemetryDto) {
    await this.injectTelemetry(id, dto.metrics);
    return ok({ success: true });
  }

  private async injectTelemetry(deviceId: string, metrics: Record<string, unknown>) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { bindings: true },
    });
    if (!device) throw new ApiError('DEVICE_NOT_FOUND', 'device not found');
    await this.prisma.telemetry.create({
      data: { deviceId, ts: new Date(), metricsJson: JSON.stringify(metrics) },
    });
    const prev = await this.prisma.deviceState.findUnique({ where: { deviceId } });
    const merged = { ...(prev ? JSON.parse(prev.stateJson || '{}') : {}), ...metrics };
    await this.prisma.deviceState.upsert({
      where: { deviceId },
      update: { online: true, stateJson: JSON.stringify(merged), updatedAt: new Date() },
      create: { deviceId, online: true, stateJson: JSON.stringify(metrics) },
    });
    const binding = device.bindings.find((b) => !b.unboundAt);
    if (binding) {
      this.ws.pushToFamily(binding.familyId, {
        type: 'device.state',
        payload: { deviceId, online: true, state: merged, updatedAt: new Date().toISOString() },
      });
      this.ws.broadcastAdmin({
        type: 'device.state',
        payload: { deviceId, online: true, state: merged, updatedAt: new Date().toISOString() },
      });
    }
  }

  @Post('simulator/devices/:id/disconnect')
  @RequirePermission('simulator:run')
  async simDisconnect(@Param('id') id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { bindings: true },
    });
    if (!device) throw new ApiError('DEVICE_NOT_FOUND', 'device not found');
    await this.prisma.deviceState.upsert({
      where: { deviceId: id },
      update: { online: false, updatedAt: new Date() },
      create: { deviceId: id, online: false, stateJson: '{}' },
    });
    const binding = device.bindings.find((b) => !b.unboundAt);
    if (binding) {
      this.ws.pushToFamily(binding.familyId, {
        type: 'device.state',
        payload: { deviceId: id, online: false, state: {}, updatedAt: new Date().toISOString() },
      });
    }
    return ok({ success: true });
  }

  @Post('simulator/devices/:id/reconnect')
  @RequirePermission('simulator:run')
  async simReconnect(@Param('id') id: string) {
    await this.prisma.deviceState.upsert({
      where: { deviceId: id },
      update: { online: true, updatedAt: new Date() },
      create: { deviceId: id, online: true, stateJson: '{}' },
    });
    return ok({ success: true });
  }
}
