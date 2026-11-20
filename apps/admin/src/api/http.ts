import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

/** API 基址：默认本地服务端，可用 VITE_API_BASE 覆盖 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');

const TOKEN_KEY = 'admin_access_token';
const REFRESH_KEY = 'admin_refresh_token';

export class ApiError extends Error {
  code: string;
  constructor(message: string, code = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

interface ApiBody<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

const instance = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 15000,
});

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 尝试用 refreshToken 换新的 accessToken（失败返回 null） */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken });
    const body = res.data as ApiBody<{ accessToken: string; refreshToken?: string }>;
    if (body?.ok && body.data?.accessToken) {
      localStorage.setItem(TOKEN_KEY, body.data.accessToken);
      if (body.data.refreshToken) localStorage.setItem(REFRESH_KEY, body.data.refreshToken);
      return body.data.accessToken;
    }
  } catch {
    // fallthrough
  }
  return null;
}

function clearAuthAndGoLogin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('admin_profile');
  localStorage.removeItem('admin_permissions');
  if (!window.location.hash.startsWith('#/login')) {
    window.location.href = '/#/login';
  }
}

instance.interceptors.response.use(
  (response) => {
    const body = response.data as any;
    if (body && typeof body === 'object' && 'ok' in body) {
      if (body.ok) return body.data;
      return Promise.reject(
        new ApiError(body.error?.message || '请求失败', body.error?.code || 'UNKNOWN'),
      );
    }
    return response.data;
  },
  async (error: AxiosError<any>) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        (config.headers as any).Authorization = `Bearer ${token}`;
        return instance.request(config);
      }
      clearAuthAndGoLogin();
      return Promise.reject(new ApiError('登录已过期，请重新登录', 'AUTH_REQUIRED'));
    }
    const body = error.response?.data;
    const message =
      body?.error?.message ||
      (error.code === 'ERR_NETWORK' ? '网络错误，无法连接服务端' : error.message) ||
      '请求失败';
    const code = body?.error?.code || 'UNKNOWN';
    return Promise.reject(new ApiError(message, code));
  },
);

export function httpGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return instance.get(url, { params }) as Promise<T>;
}

export function httpPost<T>(url: string, data?: unknown): Promise<T> {
  return instance.post(url, data) as Promise<T>;
}

export function httpPatch<T>(url: string, data?: unknown): Promise<T> {
  return instance.patch(url, data) as Promise<T>;
}
