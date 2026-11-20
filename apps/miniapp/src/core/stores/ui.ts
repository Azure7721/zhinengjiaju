import { defineStore } from 'pinia';
import { toast } from '@/platform/toast';

/** 全局 UI：Toast（B 类占位也走这里）、弹层、加载态 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    globalLoading: false,
    lastToast: '',
  }),
  actions: {
    toast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
      this.lastToast = title;
      toast(title, icon);
    },
    /** B 类入口统一反馈 */
    underDev(label?: string) {
      this.toast(label ? `${label} · 正在开发中` : '正在开发中');
    },
    loading(on: boolean) {
      this.globalLoading = on;
    },
  },
});
