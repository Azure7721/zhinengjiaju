/**
 * 实时通道：uni.connectSocket 连接 ws://host/ws?token=<accessToken>
 * - 事件：device.state / device.telemetry / command.updated / scene.run.updated
 * - 断线指数退避重连；连续失败进入轮询降级（startPolling 回调由业务注册）
 */
export type RealtimeHandler = (payload: any) => void;

export const WS_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE) ||
  'ws://127.0.0.1:3000/ws';

const MAX_RETRY = 5;

class RealtimeClient {
  private task: UniApp.SocketTask | null = null;
  private handlers = new Map<string, Set<RealtimeHandler>>();
  private token = '';
  private retry = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private paused = false;
  private polling = false;
  /** 轮询降级回调（业务侧注册，如每 5s 拉一次设备全量） */
  onFallbackPolling: (() => void) | null = null;
  onStatusChange: ((connected: boolean) => void) | null = null;

  connect(token: string): void {
    if (!token) return;
    if (this.task && this.token === token && this.connected) return;
    this.token = token;
    this.paused = false;
    this.open();
  }

  private open(): void {
    if (!this.token) return;
    this.closeTask();
    try {
      this.task = uni.connectSocket({
        url: `${WS_BASE}?token=${encodeURIComponent(this.token)}`,
        complete: () => undefined,
      });
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.task.onOpen(() => {
      this.connected = true;
      this.retry = 0;
      this.polling = false;
      this.onStatusChange?.(true);
      this.startHeartbeat();
    });
    this.task.onMessage((ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg && msg.type) this.dispatch(msg.type, msg.payload);
      } catch {
        /* ignore malformed */
      }
    });
    this.task.onClose(() => {
      this.connected = false;
      this.onStatusChange?.(false);
      this.stopHeartbeat();
      if (!this.paused) this.scheduleReconnect();
    });
    this.task.onError(() => {
      this.connected = false;
      if (!this.paused) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.retry += 1;
    if (this.retry > MAX_RETRY) {
      // 降级为轮询，等待业务重新连接
      if (!this.polling) {
        this.polling = true;
        this.onFallbackPolling?.();
      }
      return;
    }
    const delay = Math.min(1000 * 2 ** (this.retry - 1), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      try {
        this.task?.send({ data: JSON.stringify({ type: 'ping' }) });
      } catch {
        /* ignore */
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private closeTask(): void {
    if (this.task) {
      try {
        this.task.close({ code: 1000, reason: 'client close' });
      } catch {
        /* ignore */
      }
      this.task = null;
    }
  }

  private dispatch(type: string, payload: any): void {
    const set = this.handlers.get(type);
    if (set) set.forEach((h) => h(payload));
  }

  on(type: string, handler: RealtimeHandler): void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
  }

  off(type: string, handler: RealtimeHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  /** 页面隐藏时暂停重连 */
  pause(): void {
    this.paused = true;
    this.stopHeartbeat();
  }

  get isOnline(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.paused = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeTask();
    this.connected = false;
    this.retry = 0;
  }
}

export const realtime = new RealtimeClient();
