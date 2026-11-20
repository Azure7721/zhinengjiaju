/** 统一错误码 → HTTP 状态映射（见 docs/02 · 错误码） */
export const ERROR_CODES = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  FAMILY_NOT_FOUND: 404,
  DEVICE_NOT_FOUND: 404,
  DEVICE_OFFLINE: 409,
  COMMAND_TIMEOUT: 504,
  DUPLICATE_COMMAND: 200,
  PROVISION_EXPIRED: 410,
  PROVISION_TOKEN_INVALID: 403,
  SCENE_RUNNING: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  BAD_REQUEST: 400,
  CONFLICT: 409,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = ERROR_CODES[code];
    this.details = details;
  }
}

export function httpStatusFor(code: ErrorCode): number {
  return ERROR_CODES[code];
}
