import type { FamilyRole } from './constants.js';

/** REST 统一响应（docs/02 · REST 约定） */
export interface ApiOk<T> {
  ok: true;
  data: T;
  requestId?: string;
}

export interface ApiFail {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  requestId?: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiFail;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 用户（小程序端） */
export interface UserDto {
  id: string;
  nickname: string;
  avatar?: string;
  phone?: string;
  status: string;
}

export interface FamilyDto {
  id: string;
  name: string;
  role: FamilyRole;
  ownerId: string;
  createdAt?: string;
}

export interface MeDto {
  user: UserDto;
  families: FamilyDto[];
  currentFamilyId?: string;
}

/** Token 对 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult extends TokenPair {
  user: UserDto;
  families: FamilyDto[];
}

/** 管理员 */
export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt?: string;
}

export interface AdminLoginResult extends TokenPair {
  admin: AdminUserDto;
  permissions: string[];
}

/** 家庭 / 住宅 / 房间 */
export interface HomeDto {
  id: string;
  familyId: string;
  name: string;
  address?: string;
  cover?: string;
}

export interface RoomDto {
  id: string;
  homeId: string;
  name: string;
  sort: number;
}

/** 设备能力元数据（docs/01 · 6.1） */
export type CapabilityType = 'boolean' | 'number' | 'enum' | 'string';

export type ControlKind =
  | 'switch'
  | 'dial'
  | 'slider'
  | 'segmented'
  | 'remote'
  | 'panel'
  | 'generic';

export interface CapabilityDef {
  key: string;
  type: CapabilityType;
  control?: ControlKind;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  values?: string[];
  label?: string;
  /** 只读能力（如 pm25），无对应命令 */
  readonly?: boolean;
}

export interface CommandDef {
  name: string;
  params: Record<string, string>; // param name → type
}

export interface DeviceModelMetadata {
  model: string;
  name: string;
  category: string;
  capabilities: CapabilityDef[];
  commands: CommandDef[];
  ui?: Record<string, unknown>;
}

export interface DeviceModelDto {
  id: string;
  code: string;
  name: string;
  category: string;
  brand?: string;
  image?: string;
  status: string;
  metadata: DeviceModelMetadata;
  createdAt?: string;
}

/** 设备实例与状态 */
export interface DeviceStateDto {
  online: boolean;
  state: Record<string, unknown>;
  updatedAt: string;
}

export interface DeviceDto {
  id: string;
  modelId: string;
  model?: DeviceModelDto;
  name: string;
  serialNo: string;
  homeId?: string;
  roomId?: string;
  roomName?: string;
  status: string;
  state?: DeviceStateDto;
  boundAt?: string;
}

/** 命令 */
export type CommandStatus = 'pending' | 'sent' | 'acked' | 'failed' | 'timeout';

export interface CommandDto {
  id: string;
  cmdId: string;
  deviceId: string;
  capability: string;
  name: string;
  params: Record<string, unknown>;
  status: CommandStatus;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

/** 遥测 */
export interface TelemetryPoint {
  ts: string;
  metrics: Record<string, unknown>;
}

/** 场景（docs/07 · DSL） */
export type TriggerType = 'manual' | 'schedule' | 'condition' | 'deviceEvent';

export interface SceneTriggerDto {
  id: string;
  type: TriggerType;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface SceneActionDto {
  id: string;
  deviceId: string;
  deviceName?: string;
  command: string;
  params: Record<string, unknown>;
  delayMs: number;
  sort: number;
}

export interface SceneDto {
  id: string;
  homeId: string;
  name: string;
  cover?: string;
  enabled: boolean;
  mode: string;
  triggers: SceneTriggerDto[];
  actions: SceneActionDto[];
  policy?: { onActionError: 'continue' | 'abort'; maxRetries: number; cooldownSec: number };
  createdBy?: string;
}

export type SceneRunStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled' | 'timeout';

export interface SceneRunActionDto {
  id: string;
  actionId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message?: string;
  finishedAt?: string;
}

export interface SceneRunDto {
  id: string;
  sceneId: string;
  triggerType: TriggerType | string;
  status: SceneRunStatus;
  startedAt: string;
  finishedAt?: string;
  actions: SceneRunActionDto[];
}

/** 配网 */
export type ProvisionStatus =
  | 'idle'
  | 'session_created'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'provisioning'
  | 'provisioned'
  | 'binding'
  | 'bound'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface ProvisioningSessionDto {
  id: string;
  status: ProvisionStatus;
  deviceSerial?: string;
  expiresAt: string;
  token?: string; // 仅创建时返回一次
  failReason?: string;
}

/** 消息通知 */
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/** 审计 */
export interface AuditLogDto {
  id: string;
  actorType: 'user' | 'admin' | 'system';
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  createdAt: string;
}
