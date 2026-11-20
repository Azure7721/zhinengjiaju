<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import { realtime } from '@/platform/ws';

onLaunch(() => {
  const user = useUserStore();
  user.restore();

  // WS 事件只注册一次（onShow 反复注册会导致重复处理）
  const device = useDeviceStore();
  realtime.on('device.state', (payload) => device.applyDeviceState(payload));
  realtime.on('device.telemetry', (payload) => device.applyDeviceTelemetry(payload));
  realtime.onFallbackPolling = () => device.startPolling();
});

onShow(() => {
  const user = useUserStore();
  if (user.token) {
    const device = useDeviceStore();
    device.load();
    realtime.connect(user.token);
  }
});

onHide(() => {
  realtime.pause();
});
</script>

<style>
@import './styles/base.css';

page {
  background: #f2f7f8;
  color: #1d2526;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
</style>
