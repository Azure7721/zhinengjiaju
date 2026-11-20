<script setup lang="ts">
/**
 * 首页（P0）：环境三指标 · 房间 Tab · 运行设备卡 · 快捷开关 · 空态引导
 */
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import type { DeviceDto } from '@smart-home/shared';
import DeviceCard from '@/components/device/DeviceCard.vue';
import DevicePowerToggle from '@/components/device/DevicePowerToggle.vue';
import Empty from '@/components/common/Empty.vue';
import { toast, vibrateShort } from '@/platform/toast';
import { underDev } from '@/components/feedback/UnderDev';

const user = useUserStore();
const devices = useDeviceStore();

const roomTab = ref('working');
const booting = ref(false);

onShow(async () => {
  if (!user.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  booting.value = true;
  try {
    await Promise.all([user.ensureData(), devices.load(), devices.loadModels()]);
    if (roomTab.value !== 'working' && !rooms.value.includes(roomTab.value)) roomTab.value = 'working';
  } finally {
    booting.value = false;
  }
});

onPullDownRefresh(async () => {
  await Promise.all([devices.reload(), user.loadHomes()]);
  uni.stopPullDownRefresh();
});

const rooms = computed(() => user.rooms.map((r) => r.name));
const roomTabs = computed(() => ['工作中', ...rooms.value]);

/** 环境三指标：温度来自空调 currentTemp，湿度取自状态，空气质量取净化器 PM2.5 */
const env = computed(() => {
  const list = devices.devices;
  const climate = list.find((d) => typeof d.state?.state?.currentTemp === 'number');
  const purifier = list.find((d) => typeof d.state?.state?.pm25 === 'number');
  const humidity = list.find((d) => typeof d.state?.state?.humidity === 'number');
  return {
    temp: (climate?.state?.state?.currentTemp as number) ?? 26,
    humidity: (humidity?.state?.state?.humidity as number) ?? 56,
    aqi: (purifier?.state?.state?.pm25 as number) ?? 51,
    tempDeviceId: climate?.id ?? '',
  };
});

const filtered = computed<DeviceDto[]>(() => {
  if (roomTab.value === 'working') return devices.running;
  const inRoom = devices.devices.filter((d) => d.roomName === roomTab.value);
  return inRoom.sort((a, b) => Number(b.state?.state?.power === true) - Number(a.state?.state?.power === true));
});

/** 快捷开关：带 switch 能力的设备（最多 4 个） */
const quickToggles = computed(() =>
  devices.devices
    .filter((d) => devices.capabilitiesOf(d).some((c) => c.key === 'switch' || c.key === 'power'))
    .slice(0, 4),
);

function openDevice(d: DeviceDto) {
  uni.navigateTo({ url: `/pages/device/detail?id=${d.id}` });
}

async function toggleDevice(d: DeviceDto, v: boolean) {
  const ok = await devices.sendByCapability(d.id, 'switch', v);
  if (ok) {
    vibrateShort();
    toast(`${d.name} 已${v ? '开启' : '关闭'}`, 'success');
  } else {
    const st = devices.getCmdState(d.id, 'switch');
    toast(st?.error ?? '控制失败', 'none');
  }
}

function goAdd() {
  uni.navigateTo({ url: '/pkgAdd/index/index' });
}
function goNotification() {
  uni.navigateTo({ url: '/pages/notification/index' });
}
function goAllHome() {
  uni.navigateTo({ url: '/pages/all-home/index' });
}
function weatherTap() {
  toast('演示数据 · 天气服务开发中');
}
function openTemp() {
  const d = env.value.tempDeviceId ? devices.byId(env.value.tempDeviceId) : null;
  if (d) openDevice(d);
}
</script>

<template>
  <view class="page home">
    <!-- 顶栏：天气 pill + 消息 + 添加 -->
    <view class="topbar">
      <view class="weather" @click="weatherTap">
        <text class="weather-icon">☀</text>
        <text class="weather-text">今天天气很好哟，快出门逛逛吧！</text>
        <text class="weather-arrow">›</text>
      </view>
      <view class="top-actions">
        <view class="icon-btn" @click="goNotification">🔔</view>
        <view class="icon-btn" @click="goAdd">⊕</view>
      </view>
    </view>

    <!-- 环境三指标 -->
    <view class="env card">
      <view class="env-left">
        <view class="env-title" @click="goAllHome">
          {{ user.currentFamily?.name ?? '我的家' }} <text class="env-entry">全屋控制 ›</text>
        </view>
        <view class="env-metrics">
          <view class="metric" @click="openTemp">
            <view class="metric-row"><text class="metric-icon">🌡</text><text class="metric-num">{{ env.temp }}</text></view>
            <view class="metric-label">温度</view>
          </view>
          <view class="metric">
            <view class="metric-row"><text class="metric-icon">💧</text><text class="metric-num">{{ env.humidity }}</text></view>
            <view class="metric-label">湿度</view>
          </view>
          <view class="metric">
            <view class="metric-row"><text class="metric-icon">🍃</text><text class="metric-num">{{ env.aqi }}</text></view>
            <view class="metric-label">空气质量</view>
          </view>
        </view>
      </view>
      <view class="env-cover">
        <view class="env-cover-room">客厅</view>
        <view class="env-cover-arrow">›</view>
      </view>
    </view>

    <!-- B 类运营位占位 -->
    <view class="promo" @click="underDev('智能家电优惠购')">
      <view class="promo-text">
        <view class="promo-title">智能家电优惠购</view>
        <view class="promo-sub">开启居家智能生活</view>
        <view class="promo-tag">领券立减30元</view>
      </view>
      <view class="promo-art">🤖</view>
    </view>

    <!-- 房间 Tab -->
    <scroll-view scroll-x class="room-tabs" :show-scrollbar="false">
      <view
        v-for="t in roomTabs"
        :key="t"
        class="room-tab"
        :class="{ active: roomTab === t }"
        @click="roomTab = t"
      >
        {{ t }}
      </view>
      <view class="room-tab menu" @click="goAllHome">☰</view>
    </scroll-view>

    <!-- 空态 -->
    <Empty
      v-if="!devices.loading && devices.devices.length === 0"
      text="还没有设备，添加一台开始全屋智能体验"
      action-text="添加设备"
      @action="goAdd"
    />

    <!-- 运行/房间设备 -->
    <view v-else>
      <view v-if="filtered.length" class="dcards">
        <DeviceCard
          v-for="d in filtered"
          :key="d.id"
          :device="d"
          @open="openDevice(d)"
          @toggle="(v: boolean) => toggleDevice(d, v)"
        />
      </view>
      <view v-else class="empty-running">
        <text class="empty-running-icon">💤</text>
        <text class="empty-running-text">{{ roomTab === 'working' ? '当前没有运行中的设备' : '该房间暂无设备' }}</text>
        <text class="empty-running-link" @click="goAdd">去添加设备 ›</text>
      </view>
    </view>

    <!-- 快捷开关 -->
    <view v-if="quickToggles.length" class="section-title row-between">
      <text>快捷开关</text>
      <text class="section-link" @click="goAllHome">全屋控制 ›</text>
    </view>
    <view v-if="quickToggles.length" class="quick-grid">
      <view v-for="d in quickToggles" :key="d.id" class="quick-card" @click="openDevice(d)">
        <view class="quick-head">
          <view class="quick-emoji">{{ d.state?.state?.power ? '💡' : '🔌' }}</view>
          <view @click.stop>
            <DevicePowerToggle :device="d" @changed="(v: boolean) => toggleDevice(d, v)" />
          </view>
        </view>
        <view class="quick-name">{{ d.name }}</view>
        <view class="quick-room">{{ d.roomName || '未分配' }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.home {
  padding: 24rpx 28rpx 40rpx;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.weather {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #fff;
  border-radius: 999rpx;
  padding: 16rpx 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(29, 37, 38, 0.04);
}
.weather-icon {
  color: #ffb020;
}
.weather-text {
  flex: 1;
  font-size: 24rpx;
  color: #6b7a7c;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.weather-arrow {
  color: #c0cbcc;
}
.top-actions {
  display: flex;
  gap: 14rpx;
}
.icon-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  box-shadow: 0 6rpx 20rpx rgba(29, 37, 38, 0.04);
}
.env {
  margin-top: 24rpx;
  padding: 32rpx 28rpx;
  display: flex;
  gap: 20rpx;
}
.env-left {
  flex: 1;
  min-width: 0;
}
.env-title {
  font-size: 44rpx;
  font-weight: 700;
  color: #1d2526;
}
.env-entry {
  font-size: 24rpx;
  color: #12bfc1;
  font-weight: 400;
  margin-left: 8rpx;
}
.env-metrics {
  display: flex;
  margin-top: 28rpx;
  gap: 8rpx;
}
.metric {
  flex: 1;
}
.metric-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.metric-icon {
  font-size: 26rpx;
}
.metric-num {
  font-size: 40rpx;
  font-weight: 600;
  color: #1d2526;
}
.metric-label {
  margin-top: 8rpx;
  color: #a4b0b2;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.metric-label::before {
  content: '';
  width: 24rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: #d8f4f4;
  border: 2rpx solid #12bfc1;
  box-sizing: border-box;
}
.env-cover {
  width: 240rpx;
  border-radius: 20rpx;
  background: linear-gradient(150deg, #dcebec, #eef5f5 60%, #e3f0ef);
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 16rpx;
  box-sizing: border-box;
}
.env-cover-room {
  background: rgba(255, 255, 255, 0.8);
  color: #45585a;
  font-size: 22rpx;
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
.env-cover-arrow {
  position: absolute;
  left: -24rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #fff;
  color: #12bfc1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.08);
}
.promo {
  margin-top: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(120deg, #dff3f4, #ecf8f8 70%);
  padding: 30rpx 32rpx;
  display: flex;
  align-items: center;
  overflow: hidden;
  position: relative;
}
.promo-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1d2526;
}
.promo-sub {
  font-size: 24rpx;
  color: #6b7a7c;
  margin-top: 8rpx;
}
.promo-tag {
  display: inline-block;
  margin-top: 16rpx;
  background: #bfe9ea;
  color: #0b8e90;
  font-size: 22rpx;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}
.promo-art {
  font-size: 96rpx;
  margin-left: auto;
  opacity: 0.9;
}
.room-tabs {
  margin-top: 30rpx;
  white-space: nowrap;
  width: 100%;
}
.room-tab {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 8rpx;
  margin-right: 36rpx;
  font-size: 32rpx;
  color: #8a9a9c;
  position: relative;
  &.active {
    color: #12bfc1;
    font-weight: 700;
    font-size: 36rpx;
    &::after {
      content: '';
      position: absolute;
      left: 20%;
      right: 20%;
      bottom: 0;
      height: 6rpx;
      border-radius: 6rpx;
      background: #12bfc1;
    }
  }
  &.menu {
    color: #45585a;
    margin-right: 0;
    float: right;
  }
}
.dcards {
  margin-top: 24rpx;
}
.empty-running {
  margin-top: 40rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}
.empty-running-icon {
  font-size: 64rpx;
}
.empty-running-text {
  color: #8a9a9c;
  font-size: 27rpx;
}
.empty-running-link {
  color: #12bfc1;
  font-size: 27rpx;
  margin-top: 8rpx;
}
.section-link {
  font-size: 25rpx;
  color: #12bfc1;
  font-weight: 400;
}
.quick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}
.quick-card {
  width: calc(50% - 10rpx);
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-sizing: border-box;
  box-shadow: 0 8rpx 32rpx rgba(29, 37, 38, 0.05);
}
.quick-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.quick-emoji {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: #f2f7f8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}
.quick-name {
  margin-top: 18rpx;
  font-size: 29rpx;
  font-weight: 600;
  color: #1d2526;
}
.quick-room {
  margin-top: 4rpx;
  font-size: 23rpx;
  color: #a4b0b2;
}
</style>
