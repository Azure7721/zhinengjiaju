/**
 * WS / MQTT 消息契约（docs/02 · 6/7）
 * 所有消息带 v 字段做版本化。
 */
export const CONTRACT_VERSION = 1;

/** ---- MQTT 载荷 ---- */
export interface TelemetryMessage {
  v: number;
  deviceId: string;
  ts: number;
  metrics: Record<string, unknown>;
}

export interface StateMessage {
  v: number;
  deviceId: string;
  ts: number;
  online: boolean;
  state: Record<string, unknown>;
}

export interface CommandMessage {
  v: number;
  cmdId: string;
  deviceId: string;
  capability: string;
  name: string;
  params: Record<string, unknown>;
  ts: number;
}

export interface AckMessage {
  v: number;
  cmdId: string;
  deviceId: string;
  status: 'ok' | 'error';
  error?: string;
  ts: number;
}

export interface PresenceMessage {
  v: number;
  deviceId: string;
  online: boolean;
  ts: number;
}

/** ---- WebSocket 事件 ---- */
export interface WsDeviceStateEvent {
  type: 'device.state';
  payload: { deviceId: string; online: boolean; state: Record<string, unknown>; updatedAt: string };
}

export interface WsDeviceTelemetryEvent {
  type: 'device.telemetry';
  payload: { deviceId: string; ts: string; metrics: Record<string, unknown> };
}

export interface WsCommandEvent {
  type: 'command.updated';
  payload: { commandId: string; cmdId: string; deviceId: string; status: string; error?: string };
}

export interface WsSceneRunEvent {
  type: 'scene.run.started' | 'scene.run.updated' | 'scene.run.finished';
  payload: {
    runId: string;
    sceneId: string;
    status?: string;
    trigger?: string;
    actions?: Array<{ id: string; actionId: string; status: string; message?: string }>;
    summary?: string;
  };
}

export interface WsNotificationEvent {
  type: 'notification.created';
  payload: { id: string; type: string; title: string; body: string };
}

export interface WsPresenceEvent {
  type: 'presence';
  payload: { homeId: string; page?: string };
}

export type WsServerEvent =
  | WsDeviceStateEvent
  | WsDeviceTelemetryEvent
  | WsCommandEvent
  | WsSceneRunEvent
  | WsNotificationEvent;

export type WsClientEvent = WsPresenceEvent;

/** ---- 虚拟 BLE（docs/04 · 5 / docs/08 · 2.3） ---- */
export type VirtualBleMessage =
  | { type: 'scan.start'; serviceUUID?: string }
  | {
      type: 'scan.result';
      devices: Array<{ deviceId: string; name: string; rssi: number; serviceUUID: string }>;
    }
  | { type: 'connect'; deviceId: string }
  | { type: 'connected'; deviceId: string }
  | { type: 'discover' }
  | {
      type: 'services';
      services: Array<{ uuid: string; characteristics: Array<{ uuid: string; properties: string[] }> }>;
    }
  | { type: 'read'; serviceId: string; characteristicId: string }
  | { type: 'value'; serviceId: string; characteristicId: string; value: string }
  | { type: 'write'; serviceId: string; characteristicId: string; value: string }
  | { type: 'notify'; characteristicId: string; value: string }
  | { type: 'disconnect'; deviceId?: string; reason?: string }
  | { type: 'error'; code: string; message: string };

/** BLE 标准 GATT 服务/特征（docs/08 · 3.2） */
export const BLE_UUIDS = {
  service: 'FFF0',
  deviceInfo: 'FFF1', // read
  provision: 'FFF2', // write
  command: 'FFF3', // write
  telemetry: 'FFF4', // notify
  ack: 'FFF5', // notify
} as const;

/** 校验器：命令参数按 CommandDef.params 类型 */
export function validateCommandParams(
  params: Record<string, unknown>,
  schema: Record<string, string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [key, type] of Object.entries(schema)) {
    const v = params[key];
    if (v === undefined) {
      errors.push(`missing param: ${key}`);
      continue;
    }
    if (type === 'boolean' && typeof v !== 'boolean') errors.push(`${key} must be boolean`);
    if (type === 'number' && typeof v !== 'number') errors.push(`${key} must be number`);
    if (type === 'string' && typeof v !== 'string') errors.push(`${key} must be string`);
    if (type === 'enum' && typeof v !== 'string') errors.push(`${key} must be string enum`);
  }
  return { valid: errors.length === 0, errors };
}
