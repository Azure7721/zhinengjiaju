import { defineStore } from 'pinia';
import {
  resolveCommandName,
  stateKeysFor,
  type CapabilityDef,
  type DeviceDto,
  type DeviceModelMetadata,
} from '@smart-home/shared';
import { http } from '@/platform/request';
import type { CmdState } from '@/core/types';

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** 型号元数据 + 内部索引字段（_id/_code 用于匹配） */
export type ModelMeta = DeviceModelMetadata & { _id?: string; _code?: string };

export const useDeviceStore = defineStore('device', {
  state: () => ({
    devices: [] as DeviceDto[],
    models: [] as ModelMeta[],
    loading: false,
    error: '',
    /** deviceId:capability → 命令三态 */
    cmdStates: {} as Record<string, CmdState>,
    lastUpdatedAt: '',
    offlineCache: false,
  }),
  getters: {
    byId: (s) => (id: string) => s.devices.find((d) => d.id === id) ?? null,

    running(s): DeviceDto[] {
      return s.devices.filter((d) => d.state?.online && d.state?.state?.power === true);
    },

    onlineCount(s): number {
      return s.devices.filter((d) => d.state?.online).length;
    },

    /** 型号元数据：优先设备内嵌 model */
    modelOf: (s) => (device: DeviceDto): ModelMeta | null => {
      if (device.model?.metadata) return device.model.metadata;
      const byId = s.models.find((m) => m._id === device.modelId);
      return byId ?? null;
    },

    capabilitiesOf() {
      return (device: DeviceDto): CapabilityDef[] => {
        const meta = this.modelOf(device);
        return meta?.capabilities ?? [];
      };
    },
  },
  actions: {
    async load(force = false) {
      if (this.loading) return;
      if (!force && this.devices.length) return;
      this.loading = true;
      this.error = '';
      try {
        this.devices = await http.get<DeviceDto[]>('/devices');
        this.offlineCache = false;
        this.lastUpdatedAt = new Date().toISOString();
      } catch (e: any) {
        this.error = e?.message ?? '加载失败';
        if (this.devices.length) this.offlineCache = true;
      } finally {
        this.loading = false;
      }
    },

    async loadModels() {
      if (this.models.length) return;
      try {
        const list = await http.get<any[]>('/devices/models');
        this.models = list.map((m) => ({ ...m.metadata, _id: m.id, _code: m.code }) as ModelMeta);
      } catch {
        /* 型号加载失败不阻塞页面 */
      }
    },

    async reload() {
      await this.load(true);
    },

    cmdKey(deviceId: string, capability: string): string {
      return `${deviceId}:${capability}`;
    },

    getCmdState(deviceId: string, capability: string): CmdState | undefined {
      return this.cmdStates[this.cmdKey(deviceId, capability)];
    },

    /**
     * 下发命令：乐观更新 → POST → 失败回滚。
     * 返回是否成功。
     */
    async sendCommand(
      deviceId: string,
      capability: string,
      name: string,
      params: Record<string, unknown>,
      opts?: { rollbackValue?: unknown },
    ): Promise<boolean> {
      const key = this.cmdKey(deviceId, capability);
      const device = this.devices.find((d) => d.id === deviceId);
      if (!device) return false;

      // 快照用于回滚
      const stateKey = stateKeysFor(capability, this.capabilitiesOf(device).find((c) => c.key === capability))[0];
      const prevValue = device.state?.state?.[stateKey];
      const prevOnline = device.state?.online;

      // 乐观更新
      if (device.state && stateKey) {
        const value = 'value' in params ? params.value : params;
        device.state = {
          ...device.state,
          state: { ...device.state.state, [stateKey]: value },
          updatedAt: new Date().toISOString(),
        };
      }
      this.cmdStates[key] = { status: 'pending' };

      try {
        const cmd = await http.post<{ status: string; error?: string }>(
          `/devices/${deviceId}/commands`,
          { capability, name, params },
        );
        if (cmd?.status === 'failed' || cmd?.status === 'timeout') {
          throw new Error(cmd.error || '设备未响应');
        }
        this.cmdStates[key] = { status: 'success' };
        setTimeout(() => {
          if (this.cmdStates[key]?.status === 'success') delete this.cmdStates[key];
        }, 2500);
        return true;
      } catch (e: any) {
        // 回滚
        if (device.state && stateKey) {
          device.state = {
            ...device.state,
            state: { ...device.state.state, [stateKey]: opts?.rollbackValue !== undefined ? opts.rollbackValue : prevValue },
            online: prevOnline ?? device.state.online,
            updatedAt: device.state.updatedAt,
          };
        }
        this.cmdStates[key] = {
          status: 'failed',
          error: e?.message ?? '命令失败',
          retry: () => void this.sendCommand(deviceId, capability, name, params, opts),
        };
        return false;
      }
    },

    /** 从 CapabilityDef 快捷发命令（命令名按约定解析） */
    async sendByCapability(deviceId: string, capability: string, value: unknown): Promise<boolean> {
      const device = this.devices.find((d) => d.id === deviceId);
      if (!device) return false;
      const def = this.capabilitiesOf(device).find((c) => c.key === capability);
      const name = resolveCommandName(capability, def);
      if (!name) return false;
      return this.sendCommand(deviceId, capability, name, { value });
    },

    clearCmdState(deviceId: string, capability: string) {
      delete this.cmdStates[this.cmdKey(deviceId, capability)];
    },

    async patchDevice(id: string, patch: { name?: string; roomId?: string }) {
      const updated = await http.patch<DeviceDto>(`/devices/${id}`, patch);
      const idx = this.devices.findIndex((d) => d.id === id);
      if (idx >= 0) {
        this.devices[idx] = { ...this.devices[idx], ...updated, model: this.devices[idx].model };
      }
      return updated;
    },

    async unbind(id: string) {
      await http.del(`/devices/${id}/bind`);
      this.devices = this.devices.filter((d) => d.id !== id);
    },

    /** WS：device.state */
    applyDeviceState(payload: { deviceId: string; online?: boolean; state?: Record<string, unknown>; updatedAt?: string }) {
      if (!payload?.deviceId) return;
      const device = this.devices.find((d) => d.id === payload.deviceId);
      if (!device) {
        void this.reload();
        return;
      }
      device.state = {
        online: payload.online ?? device.state?.online ?? false,
        state: payload.state ?? device.state?.state ?? {},
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      };
      this.lastUpdatedAt = device.state.updatedAt;
    },

    /** WS：device.telemetry（并入 state） */
    applyDeviceTelemetry(payload: { deviceId: string; metrics?: Record<string, unknown>; ts?: string }) {
      if (!payload?.deviceId || !payload.metrics) return;
      const device = this.devices.find((d) => d.id === payload.deviceId);
      if (!device) return;
      device.state = {
        online: device.state?.online ?? true,
        state: { ...(device.state?.state ?? {}), ...payload.metrics },
        updatedAt: payload.ts ?? new Date().toISOString(),
      };
    },

    /** 轮询降级 */
    startPolling(intervalMs = 6000) {
      this.stopPolling();
      pollTimer = setInterval(() => void this.load(true), intervalMs);
    },
    stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  },
});
