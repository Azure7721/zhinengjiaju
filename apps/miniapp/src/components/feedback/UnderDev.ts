/** B 类占位：点击提示「正在开发中」 */
import { toast } from '@/platform/toast';

export function underDev(msg?: string): void {
  toast(msg ? `${msg} · 正在开发中` : '正在开发中');
}

export default underDev;
