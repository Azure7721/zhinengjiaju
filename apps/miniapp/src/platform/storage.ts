/** 统一本地存储（小程序/H5 均走 uni storage） */

const KEY_TOKEN = 'sh.accessToken';
const KEY_REFRESH = 'sh.refreshToken';
const KEY_EXPIRES = 'sh.expiresAt';
const KEY_FAMILY = 'sh.currentFamilyId';

export function getAccessToken(): string {
  return (uni.getStorageSync(KEY_TOKEN) as string) || '';
}

export function getRefreshToken(): string {
  return (uni.getStorageSync(KEY_REFRESH) as string) || '';
}

export function setTokens(accessToken: string, refreshToken: string, expiresIn?: number): void {
  uni.setStorageSync(KEY_TOKEN, accessToken);
  uni.setStorageSync(KEY_REFRESH, refreshToken);
  if (expiresIn) uni.setStorageSync(KEY_EXPIRES, String(Date.now() + expiresIn * 1000));
}

export function clearTokens(): void {
  uni.removeStorageSync(KEY_TOKEN);
  uni.removeStorageSync(KEY_REFRESH);
  uni.removeStorageSync(KEY_EXPIRES);
}

export function getCurrentFamilyId(): string {
  return (uni.getStorageSync(KEY_FAMILY) as string) || '';
}

export function setCurrentFamilyId(id: string): void {
  if (id) uni.setStorageSync(KEY_FAMILY, id);
  else uni.removeStorageSync(KEY_FAMILY);
}
