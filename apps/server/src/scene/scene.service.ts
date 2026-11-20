import { Injectable, Logger } from '@nestjs/common';
import { ApiError, SceneDto, SceneRunDto, SCENE_DEFAULT_COOLDOWN_SEC } from '@smart-home/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceService } from '../device/device.service';
import { WsGateway } from '../ws/ws.gateway';

interface ScenePolicy {
  onActionError: 'continue' | 'abort';
  maxRetries: number;
  cooldownSec: number;
}

/**
 * 场景执行器（docs/07）：
 * queued → running → success/partial/failed
 * 逐动作状态 + WS 推送 + 幂等/冷却/并发控制
 */
@Injectable()
export class SceneService {
  private readonly logger = new Logger('Scene');
  private running = new Set<string>(); // sceneId 并发锁
  private lastRunAt = new Map<string, number>(); // 冷却

  constructor(
    private prisma: PrismaService,
    private device: DeviceService,
    private ws: WsGateway,
  ) {}

  private parsePolicy(json: string): ScenePolicy {
    try {
      return { onActionError: 'continue', maxRetries: 1, cooldownSec: SCENE_DEFAULT_COOLDOWN_SEC, ...JSON.parse(json) };
    } catch {
      return { onActionError: 'continue', maxRetries: 1, cooldownSec: SCENE_DEFAULT_COOLDOWN_SEC };
    }
  }

  toSceneDto(s: any): SceneDto {
    return {
      id: s.id,
      homeId: s.homeId,
      name: s.name,
      cover: s.cover ?? undefined,
      enabled: s.enabled,
      mode: s.mode,
      policy: this.parsePolicy(s.policyJson ?? '{}'),
      createdBy: s.createdBy ?? undefined,
      triggers: (s.triggers ?? []).map((t: any) => ({
        id: t.id,
        type: t.type,
        config: JSON.parse(t.configJson ?? '{}'),
        enabled: t.enabled,
      })),
      actions: (s.actions ?? []).map((a: any) => ({
        id: a.id,
        deviceId: a.deviceId,
        command: a.command,
        params: JSON.parse(a.paramsJson ?? '{}'),
        delayMs: a.delayMs,
        sort: a.sort,
      })),
    };
  }

  async listScenes(homeIds: string[]): Promise<SceneDto[]> {
    const scenes = await this.prisma.scene.findMany({
      where: { homeId: { in: homeIds }, enabled: true },
      include: { triggers: true, actions: { orderBy: { sort: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return scenes.map((s) => this.toSceneDto(s));
  }

  async getScene(id: string, homeIds: string[]): Promise<SceneDto> {
    const s = await this.prisma.scene.findUnique({
      where: { id },
      include: { triggers: true, actions: { orderBy: { sort: 'asc' } } },
    });
    if (!s || !homeIds.includes(s.homeId)) throw new ApiError('NOT_FOUND', 'scene not found');
    return this.toSceneDto(s);
  }

  async createScene(
    userId: string,
    data: {
      homeId: string;
      name: string;
      cover?: string;
      triggers?: Array<{ type: string; config?: Record<string, unknown>; deviceId?: string }>;
      actions?: Array<{ deviceId: string; command: string; params: Record<string, unknown>; delayMs?: number }>;
      policy?: Partial<ScenePolicy>;
    },
  ): Promise<SceneDto> {
    // 校验家庭归属
    const home = await this.prisma.home.findUnique({ where: { id: data.homeId } });
    if (!home) throw new ApiError('FAMILY_NOT_FOUND', 'home not found');
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: home.familyId, userId } },
    });
    if (!member || member.role === 'member') throw new ApiError('FORBIDDEN', 'owner/admin only');

    const s = await this.prisma.scene.create({
      data: {
        homeId: data.homeId,
        familyId: home.familyId,
        name: data.name,
        cover: data.cover,
        createdBy: userId,
        policyJson: JSON.stringify(data.policy ?? {}),
        triggers: {
          create: (data.triggers?.length ? data.triggers : [{ type: 'manual' }]).map((t) => ({
            type: t.type,
            configJson: JSON.stringify(t.config ?? {}),
            deviceId: t.deviceId,
          })),
        },
        actions: {
          create: (data.actions ?? []).map((a, i) => ({
            deviceId: a.deviceId,
            command: a.command,
            paramsJson: JSON.stringify(a.params ?? {}),
            delayMs: a.delayMs ?? 0,
            sort: i,
          })),
        },
      },
      include: { triggers: true, actions: { orderBy: { sort: 'asc' } } },
    });
    return this.toSceneDto(s);
  }

  /**
   * 手动执行场景（docs/07 · 6 执行器）
   */
  async runScene(sceneId: string, userId: string, idempotencyKey?: string): Promise<SceneRunDto> {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: { triggers: true, actions: { orderBy: { sort: 'asc' } } },
    });
    if (!scene) throw new ApiError('NOT_FOUND', 'scene not found');
    if (!scene.enabled) throw new ApiError('FORBIDDEN', 'scene disabled');

    // 权限：家庭成员可执行
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: scene.familyId ?? '', userId } },
    });
    if (!member && scene.familyId) throw new ApiError('FORBIDDEN', 'not a family member');

    // 并发：同场景串行
    if (this.running.has(sceneId)) throw new ApiError('SCENE_RUNNING', 'scene already running');

    // 幂等
    if (idempotencyKey) {
      const dup = await this.prisma.sceneRun.findFirst({
        where: { idempotencyKey },
        include: { actions: true },
      });
      if (dup) return this.toRunDto(dup);
    }

    // 冷却
    const policy = this.parsePolicy(scene.policyJson);
    const last = this.lastRunAt.get(sceneId) ?? 0;
    if (Date.now() - last < policy.cooldownSec * 1000) {
      throw new ApiError('SCENE_RUNNING', `冷却中，请 ${policy.cooldownSec}s 后再试`);
    }
    this.lastRunAt.set(sceneId, Date.now());

    const run = await this.prisma.sceneRun.create({
      data: {
        sceneId,
        triggerType: 'manual',
        idempotencyKey,
        status: 'queued',
        actions: {
          create: scene.actions.map((a) => ({ actionId: a.id, status: 'pending' })),
        },
      },
      include: { actions: true },
    });

    this.ws.pushToFamily(scene.familyId ?? '', {
      type: 'scene.run.started',
      payload: { runId: run.id, sceneId, trigger: 'manual' },
    });

    // 异步执行（不阻塞请求）
    void this.execute(run.id, scene, policy);

    return this.toRunDto(run);
  }

  private async execute(runId: string, scene: any, policy: ScenePolicy) {
    this.running.add(scene.sceneId ?? scene.id);
    const sceneId = scene.id;
    try {
      await this.prisma.sceneRun.update({
        where: { id: runId },
        data: { status: 'running' },
      });
      this.pushRunUpdate(runId, sceneId, scene.familyId);

      let success = 0;
      let failed = 0;

      for (const action of scene.actions) {
        // 更新当前 action 为 running
        await this.prisma.sceneRunAction.updateMany({
          where: { runId, actionId: action.id },
          data: { status: 'running' },
        });
        this.pushRunUpdate(runId, sceneId, scene.familyId);

        if (action.delayMs > 0) {
          await new Promise((r) => setTimeout(r, action.delayMs));
        }

        let ok = false;
        let errMsg: string | undefined;
        const retries = policy.maxRetries;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            // 找到执行 run 的用户（场景创建者或任意有权限成员）
            const executorId = scene.createdBy;
            await this.device.sendCommand({
              deviceId: action.deviceId,
              userId: executorId,
              capability: action.command.replace(/^set/, '').toLowerCase(),
              name: action.command,
              cmdParams: JSON.parse(action.paramsJson ?? '{}'),
              source: 'scene',
            });
            // 等待 ack（简化：等待命令到终态，最多 5s）
            ok = await this.waitForCommandAck(executorId, action.deviceId, action.command, 5000);
            if (ok) break;
            errMsg = 'command timeout';
          } catch (e: any) {
            errMsg = e.message;
            if (attempt === retries) break;
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        if (ok) {
          success++;
          await this.prisma.sceneRunAction.updateMany({
            where: { runId, actionId: action.id },
            data: { status: 'success', finishedAt: new Date() },
          });
        } else {
          failed++;
          await this.prisma.sceneRunAction.updateMany({
            where: { runId, actionId: action.id },
            data: { status: 'failed', message: errMsg, finishedAt: new Date() },
          });
          if (policy.onActionError === 'abort') {
            // 标记剩余为 skipped
            await this.prisma.sceneRunAction.updateMany({
              where: { runId, status: 'pending' },
              data: { status: 'skipped' },
            });
            break;
          }
        }
        this.pushRunUpdate(runId, sceneId, scene.familyId);
      }

      const status = failed === 0 ? 'success' : success === 0 ? 'failed' : 'partial';
      await this.prisma.sceneRun.update({
        where: { id: runId },
        data: { status, finishedAt: new Date() },
      });
      this.pushRunUpdate(runId, sceneId, scene.familyId, true);
    } catch (e: any) {
      this.logger.error(`scene run ${runId} failed: ${e.message}`);
      await this.prisma.sceneRun.update({
        where: { id: runId },
        data: { status: 'failed', error: e.message, finishedAt: new Date() },
      });
      this.pushRunUpdate(runId, sceneId, scene.familyId, true);
    } finally {
      this.running.delete(sceneId);
    }
  }

  private async waitForCommandAck(
    userId: string,
    deviceId: string,
    commandName: string,
    timeoutMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cmd = await this.prisma.command.findFirst({
        where: { deviceId, name: commandName, userId },
        orderBy: { createdAt: 'desc' },
      });
      if (cmd && ['acked', 'failed', 'timeout'].includes(cmd.status)) {
        return cmd.status === 'acked';
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  private async pushRunUpdate(runId: string, sceneId: string, familyId?: string | null, finished = false) {
    const run = await this.prisma.sceneRun.findUnique({
      where: { id: runId },
      include: { actions: true },
    });
    if (!run) return;
    const payload = {
      runId,
      sceneId,
      status: run.status,
      actions: run.actions.map((a) => ({
        id: a.id,
        actionId: a.actionId,
        status: a.status,
        message: a.message ?? undefined,
      })),
    };
    const type = finished ? 'scene.run.finished' : 'scene.run.updated';
    if (familyId) this.ws.pushToFamily(familyId, { type, payload });
    this.ws.broadcastAdmin({ type, payload });
  }

  async getRuns(sceneId: string, limit = 20): Promise<SceneRunDto[]> {
    const runs = await this.prisma.sceneRun.findMany({
      where: { sceneId },
      include: { actions: true },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    return runs.map((r) => this.toRunDto(r));
  }

  toRunDto(r: any): SceneRunDto {
    return {
      id: r.id,
      sceneId: r.sceneId,
      triggerType: r.triggerType,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString(),
      actions: r.actions.map((a: any) => ({
        id: a.id,
        actionId: a.actionId,
        status: a.status,
        message: a.message ?? undefined,
        finishedAt: a.finishedAt?.toISOString(),
      })),
    };
  }

  /** 删除场景 */
  async deleteScene(id: string, userId: string) {
    const s = await this.prisma.scene.findUnique({ where: { id } });
    if (!s) throw new ApiError('NOT_FOUND', 'scene not found');
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: s.familyId ?? '', userId } },
    });
    if (!member || member.role === 'member') throw new ApiError('FORBIDDEN', 'owner/admin only');
    await this.prisma.scene.delete({ where: { id } });
  }
}
