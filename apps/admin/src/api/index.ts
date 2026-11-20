import { httpGet, httpPost, httpPatch } from './http';
import type {
  AdminLoginResult,
  AuditLogItem,
  CommandLogItem,
  DashboardData,
  DeviceItem,
  DeviceModelItem,
  FamilyItem,
  Page,
  SceneRunItem,
  SimDevice,
  TelemetryItem,
  UserItem,
} from '../types';

export const api = {
  // 认证
  adminLogin: (email: string, password: string) =>
    httpPost<AdminLoginResult>('/auth/admin/login', { email, password }),
  logout: (refreshToken: string) => httpPost<{ success: boolean }>('/auth/logout', { refreshToken }),

  // 仪表盘
  dashboard: () => httpGet<DashboardData>('/admin/dashboard'),

  // 用户 / 家庭
  users: (params: { q?: string; page: number; pageSize: number }) =>
    httpGet<Page<UserItem>>('/admin/users', params),
  families: (params: { q?: string; page: number; pageSize: number }) =>
    httpGet<Page<FamilyItem>>('/admin/families', params),

  // 设备型号
  deviceModels: (status?: string) =>
    httpGet<DeviceModelItem[]>('/admin/device-models', status ? { status } : undefined),
  createDeviceModel: (data: {
    code: string;
    name: string;
    category: string;
    brand?: string;
    image?: string;
    metadata: Record<string, unknown>;
    status?: string;
  }) => httpPost<DeviceModelItem>('/admin/device-models', data),
  patchDeviceModel: (
    id: string,
    data: Partial<{
      name: string;
      category: string;
      brand?: string;
      image?: string;
      metadata: Record<string, unknown>;
      status: string;
    }>,
  ) => httpPatch<DeviceModelItem>(`/admin/device-models/${id}`, data),

  // 设备库存
  devices: (params: { q?: string; page: number; pageSize: number }) =>
    httpGet<Page<DeviceItem>>('/admin/devices', params),
  unbindDevice: (id: string, reason: string) =>
    httpPost<{ success: boolean }>(`/admin/devices/${id}/unbind`, { reason }),
  importDevices: (modelId: string, serials: string[]) =>
    httpPost<{ created: string[]; skipped: string[] }>('/admin/devices/import', {
      modelId,
      serials,
    }),

  // 日志
  commandLogs: (params: { deviceId?: string; page: number; pageSize: number }) =>
    httpGet<Page<CommandLogItem>>('/admin/logs/commands', params),
  telemetryLogs: (params: { deviceId?: string; page: number; pageSize: number }) =>
    httpGet<Page<TelemetryItem>>('/admin/logs/telemetry', params),
  sceneRunLogs: (params: { page: number; pageSize: number }) =>
    httpGet<Page<SceneRunItem>>('/admin/logs/scene-runs', params),
  auditLogs: (params: { action?: string; page: number; pageSize: number }) =>
    httpGet<Page<AuditLogItem>>('/admin/audit-logs', params),

  // 设备模拟器
  simCreate: (modelCode: string, name?: string) =>
    httpPost<SimDevice>('/admin/simulator/devices', name ? { modelCode, name } : { modelCode }),
  simTelemetry: (id: string, metrics: Record<string, unknown>) =>
    httpPost<{ success: boolean }>(`/admin/simulator/devices/${id}/telemetry`, { metrics }),
  simDisconnect: (id: string) =>
    httpPost<{ success: boolean }>(`/admin/simulator/devices/${id}/disconnect`),
  simReconnect: (id: string) =>
    httpPost<{ success: boolean }>(`/admin/simulator/devices/${id}/reconnect`),
};
