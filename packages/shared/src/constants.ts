/** REST 前缀 */
export const API_PREFIX = '/api/v1';

/** MQTT 主题模板（docs/02 · MQTT 主题） */
export const MQTT_TOPICS = {
  telemetry: (deviceId: string) => `device/${deviceId}/telemetry`,
  state: (deviceId: string) => `device/${deviceId}/state`,
  command: (deviceId: string) => `device/${deviceId}/command`,
  ack: (deviceId: string) => `device/${deviceId}/ack`,
  presence: (deviceId: string) => `device/${deviceId}/presence`,
} as const;

/** 通配订阅 */
export const MQTT_WILDCARDS = {
  allTelemetry: 'device/+/telemetry',
  allState: 'device/+/state',
  allAck: 'device/+/ack',
  allPresence: 'device/+/presence',
} as const;

/** WS 事件名（docs/02 · WebSocket 事件） */
export const WS_EVENTS = {
  deviceState: 'device.state',
  deviceTelemetry: 'device.telemetry',
  commandUpdated: 'command.updated',
  sceneRunUpdated: 'scene.run.updated',
  sceneRunStarted: 'scene.run.started',
  sceneRunFinished: 'scene.run.finished',
  notificationCreated: 'notification.created',
  presence: 'presence',
} as const;

/** 命令超时（ms）与重试 */
export const COMMAND_TIMEOUT_MS = 5000;
export const COMMAND_MAX_RETRIES = 2;

/** 配网会话有效期（ms） */
export const PROVISION_TTL_MS = 5 * 60 * 1000;

/** 场景冷却默认（秒） */
export const SCENE_DEFAULT_COOLDOWN_SEC = 10;

/** 家庭角色 */
export const FAMILY_ROLES = ['owner', 'admin', 'member'] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

/** 管理员角色（RBAC） */
export const ADMIN_ROLES = ['super_admin', 'ops', 'support', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** 管理员角色 → 权限码（docs/03 · RBAC） */
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['*'],
  ops: [
    'dashboard:read',
    'user:read',
    'family:read',
    'device_model:read',
    'device_model:write',
    'device:read',
    'device:write',
    'scene_template:read',
    'scene_template:write',
    'log:read',
    'simulator:run',
    'audit:read',
  ],
  support: ['dashboard:read', 'user:read', 'family:read', 'device:read', 'log:read'],
  viewer: ['dashboard:read', 'log:read'],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  // 支持 resource:* 形式
  const resource = permission.split(':')[0];
  return perms.includes(`${resource}:*`);
}

/** 家庭角色能力矩阵（docs/03 · 家庭与角色） */
export const FAMILY_CAPABILITIES = {
  view: ['owner', 'admin', 'member'],
  control: ['owner', 'admin', 'member'],
  manageDevices: ['owner', 'admin'],
  manageScenes: ['owner', 'admin'],
  inviteMembers: ['owner', 'admin'],
  removeMembers: ['owner'],
  transfer: ['owner'],
  deleteFamily: ['owner'],
} as const;

export type FamilyCapability = keyof typeof FAMILY_CAPABILITIES;

export function familyCan(role: FamilyRole, capability: FamilyCapability): boolean {
  return (FAMILY_CAPABILITIES[capability] as readonly string[]).includes(role);
}
