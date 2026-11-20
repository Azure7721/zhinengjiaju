/** 统一 toast / 轻反馈 */

export function toast(title: string, icon: 'none' | 'success' | 'error' | 'loading' = 'none'): void {
  uni.showToast({ title, icon, duration: icon === 'none' ? 1800 : 1200 });
}

export function successToast(title: string): void {
  uni.showToast({ title, icon: 'success', duration: 1200 });
}

export function errorToast(title: string): void {
  uni.showToast({ title, icon: 'none', duration: 2200 });
}

export function vibrateShort(): void {
  try {
    uni.vibrateShort({ type: 'light' } as any);
  } catch {
    /* 桌面预览环境无震动 */
  }
}
