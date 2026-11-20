import { computed, reactive } from 'vue';
import { api } from '../api';
import type { AdminProfile } from '../types';

const TOKEN_KEY = 'admin_access_token';
const REFRESH_KEY = 'admin_refresh_token';
const PROFILE_KEY = 'admin_profile';
const PERMS_KEY = 'admin_permissions';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const state = reactive({
  accessToken: localStorage.getItem(TOKEN_KEY) || '',
  refreshToken: localStorage.getItem(REFRESH_KEY) || '',
  admin: loadJson<AdminProfile | null>(PROFILE_KEY, null),
  permissions: loadJson<string[]>(PERMS_KEY, []),
});

/** 权限码判断：支持 `*` 与 `resource:*`（与 shared/constants.ts 一致） */
export function hasPerm(permission: string): boolean {
  const perms = state.permissions;
  if (!permission) return true;
  if (!perms.length) return false;
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const resource = permission.split(':')[0];
  return perms.includes(`${resource}:*`);
}

export function useAuth() {
  const isLogin = computed(() => !!state.accessToken);
  const roleName = computed(() => state.admin?.role || '');

  function saveSession(data: {
    accessToken: string;
    refreshToken: string;
    admin: AdminProfile;
    permissions: string[];
  }) {
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.admin = data.admin;
    state.permissions = data.permissions;
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data.admin));
    localStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions));
  }

  function clearSession() {
    state.accessToken = '';
    state.refreshToken = '';
    state.admin = null;
    state.permissions = [];
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PERMS_KEY);
  }

  async function login(email: string, password: string) {
    const data = await api.adminLogin(email, password);
    saveSession(data);
    return data;
  }

  async function logout() {
    const rt = state.refreshToken;
    clearSession();
    if (rt) {
      try {
        await api.logout(rt);
      } catch {
        // 忽略登出接口失败
      }
    }
    window.location.href = '/#/login';
  }

  return { state, isLogin, roleName, login, logout };
}
