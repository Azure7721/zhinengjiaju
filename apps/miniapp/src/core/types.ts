/** 小程序端类型：复用 @smart-home/shared，补充本地视图类型 */
export type {
  ApiOk,
  ApiFail,
  ApiResponse,
  Paginated,
  UserDto,
  FamilyDto,
  MeDto,
  TokenPair,
  LoginResult,
  HomeDto,
  RoomDto,
  CapabilityType,
  ControlKind,
  CapabilityDef,
  CommandDef,
  DeviceModelMetadata,
  DeviceModelDto,
  DeviceStateDto,
  DeviceDto,
  CommandStatus,
  CommandDto,
  TelemetryPoint,
  TriggerType,
  SceneTriggerDto,
  SceneActionDto,
  SceneDto,
  SceneRunStatus,
  SceneRunActionDto,
  SceneRunDto,
  ProvisionStatus,
  ProvisioningSessionDto,
  NotificationDto,
} from '@smart-home/shared';

export type FamilyRole = 'owner' | 'admin' | 'member' | 'viewer';

/** 房间（服务端 homes 列表内嵌） */
export interface RoomLite {
  id: string;
  homeId: string;
  name: string;
  sort: number;
}

/** 首页视图用：带展示摘要的设备 */
export interface DeviceView {
  id: string;
  name: string;
  roomName: string;
  online: boolean;
  power: boolean;
  summary: string;
}

export type CmdStatus = 'pending' | 'success' | 'failed';

export interface CmdState {
  status: CmdStatus;
  error?: string;
  /** 失败时可重试的请求参数快照 */
  retry?: () => void;
}
