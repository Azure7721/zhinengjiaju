/**
 * HTTP 请求封装：Bearer token、401 自动 refresh 重试一次、统一错误结构。
 * 响应约定：{ok:true,data} / {ok:false,error:{code,message}}
 */
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './storage';

/** 本地开发服务端地址（微信开发者工具需关闭域名校验） */
export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) ||
  'http://127.0.0.1:3000/api/v1';

export interface ApiError {
  code: string;
  message: string;
}

export class RequestError extends Error implements ApiError {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RequestError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RawResult {
  status: number;
  body: any;
}

function rawRequest(method: Method, path: string, data?: unknown): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: API_BASE + path,
      method: method as any,
      data: data as any,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      success: (res) => resolve({ status: res.statusCode, body: res.data }),
      fail: (err) => reject(new RequestError('NETWORK_ERROR', err.errMsg || '网络异常，请稍后重试')),
    });
  });
}

/** token 刷新（并发只发一次） */
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  refreshing = (async () => {
    try {
      const res = await rawRequest('POST', '/auth/refresh', { refreshToken });
      const body = res.body;
      if (body?.ok && body.data?.accessToken) {
        setTokens(body.data.accessToken, body.data.refreshToken ?? refreshToken, body.data.expiresIn);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(method: Method, path: string, data?: unknown): Promise<T> {
  let res = await rawRequest(method, path, data);

  const unauthorized = res.status === 401 || res.body?.error?.code === 'AUTH_REQUIRED';
  if (unauthorized && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(method, path, data);
    } else {
      clearTokens();
      throw new RequestError('AUTH_REQUIRED', '登录已过期，请重新登录');
    }
  }

  if (res.body && typeof res.body === 'object' && 'ok' in res.body) {
    if (res.body.ok) return res.body.data as T;
    const err = res.body.error ?? {};
    throw new RequestError(err.code || 'UNKNOWN', err.message || '请求失败');
  }
  if (res.status >= 200 && res.status < 300) return res.body as T;
  throw new RequestError(`HTTP_${res.status}`, '服务异常，请稍后重试');
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, data?: unknown) => request<T>('POST', path, data),
  patch: <T>(path: string, data?: unknown) => request<T>('PATCH', path, data),
  put: <T>(path: string, data?: unknown) => request<T>('PUT', path, data),
  del: <T>(path: string, data?: unknown) => request<T>('DELETE', path, data),
};
