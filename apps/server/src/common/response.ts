import { ApiOk, ApiFail } from '@smart-home/shared';

/** 统一成功响应 */
export function ok<T>(data: T, requestId?: string): ApiOk<T> {
  return requestId ? { ok: true, data, requestId } : { ok: true, data };
}

/** 统一失败响应 */
export function fail(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiFail {
  return {
    ok: false,
    error: { code, message, details },
    ...(requestId ? { requestId } : {}),
  };
}
