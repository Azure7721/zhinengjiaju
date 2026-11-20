/** 与服务端返回结构对应的本地 DTO（admin 侧） */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt?: string;
}

export interface AdminLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: AdminProfile;
  permissions: string[];
}

export interface DashboardData {
  users: number;
  families: number;
  devices: number;
  onlineDevices: number;
  onlineRate: number;
  commandSuccessRate: number;
  sceneRuns: number;
  sceneFailedRuns: number;
}

export interface UserFamilyRef {
  id: string;
  name: string;
  role: string;
}

export interface UserItem {
  id: string;
  nickname: string;
  phone?: string;
  status: string;
  createdAt: string;
  families: UserFamilyRef[];
}

export interface FamilyMember {
  userId: string;
  nickname: string;
  role: string;
}

export interface FamilyItem {
  id: string;
  name: string;
  ownerId: string;
  status: string;
  createdAt: string;
  memberCount: number;
  members: FamilyMember[];
  homeCount: number;
  deviceCount: number;
}

export type CapabilityType = 'boolean' | 'number' | 'enum' | 'string';
export type ControlKind = 'switch' | 'dial' | 'slider' | 'segmented' | 'remote' | 'panel' | 'generic';

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
  readonly?: boolean;
}

export interface CommandDef {
  name: string;
  params: Record<string, string>;
}

export interface DeviceModelMetadata {
  model?: string;
  name?: string;
  category?: string;
  capabilities: CapabilityDef[];
  commands: CommandDef[];
  ui?: Record<string, unknown>;
}

export interface DeviceModelItem {
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

export interface BoundRef {
  userId: string;
  nickname: string;
  familyId: string;
  familyName: string;
  boundAt: string;
}

export interface DeviceItem {
  id: string;
  name: string;
  serialNo: string;
  status: string;
  source: string;
  model: { id: string; code: string; name: string; category: string };
  online: boolean;
  state: Record<string, unknown>;
  boundTo: BoundRef | null;
  roomName?: string;
  createdAt: string;
}

export interface CommandLogItem {
  id: string;
  cmdId: string;
  deviceId: string;
  deviceName: string;
  capability: string;
  name: string;
  params: Record<string, unknown>;
  status: string;
  error?: string;
  source: string;
  createdAt: string;
  finishedAt?: string;
}

export interface TelemetryItem {
  id: string;
  deviceId: string;
  deviceName: string;
  ts: string;
  metrics: Record<string, unknown>;
}

export interface SceneRunItem {
  id: string;
  sceneId: string;
  sceneName: string;
  status: string;
  triggerType: string;
  startedAt: string;
  finishedAt?: string;
  actions: { id: string; status: string; message?: string }[];
}

export interface AuditLogItem {
  id: string;
  actorType: string;
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  createdAt: string;
}

export interface SimDevice {
  id: string;
  serialNo: string;
  name: string;
}
