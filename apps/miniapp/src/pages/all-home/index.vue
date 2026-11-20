<script setup lang="ts">
/**
 * 全屋控制（P2 · 简化版）：房间分组设备列表 + 快捷模式（触发场景）
 */
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useDeviceStore } from '@/core/stores/device';
import { useUserStore } from '@/core/stores/user';
import { useSceneStore } from '@/core/stores/scene';
import type { DeviceDto } from '@smart-home/shared';
import PowerSwitch from '@/components/device/PowerSwitch.vue';
import { errorToast, toast, vibrateShort } from '@/platform/toast';

const devices = useDeviceStore();
const user = useUserStore();
const scenes = useSceneStore();

const activeRoom = ref('all');

onShow(async () => {
  if (!user.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  await Promise.all([user.ensureData(), devices.load(true), scenes.load(true)]);
});

const roomGroups = computed(() => {
  const groups = new Map<string, DeviceDto[]>();
  for (const d of devices.devices) {
    const key = d.roomName || '未分配';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return Array.from(groups.entries()).map(([name, list]) => ({ name, list }));
});

const shownGroups = computed(() =>
  activeRoom.value === 'all'
    ? roomGroups.value
    : roomGroups.value.filter((g) => g.name === activeRoom.value),
);

/** 快捷模式：按名称匹配场景执行 */
const MODES = [
  { icon: '❄️', name: '清凉干爽', match: ['舒适', '观影'] },
  { icon: '🌤', name: '舒适宜人', match: ['舒适'] },
  { icon: '🌙', name: '温暖湿润', match: ['晚安', '睡眠', '观影'] },
];

async function runMode(mode: { name: string; match: string[] }) {
  const scene =
    scenes.scenes.find((s) => mode.match.some((k) => s.name.includes(k))) ?? scenes.scenes[0];
  if (!scene) {
    errorToast('暂无可执行的场景');
    return;
  }
  try {
    await scenes.run(scene.id);
    vibrateShort();
    toast(`已触发「${scene.name}」`);
  } catch (e: any) {
    errorToast(e?.message ?? '执行失败');
  }
}

function openDevice(d: DeviceDto) {
  uni.navigateTo({ url: `/pages/device/detail?id=${d.id}` });
}

async function toggle(d: DeviceDto, v: boolean) {
  const ok = await devices.sendByCapability(d.id, 'switch', v);
  if (ok) toast(`${d.name} 已${v ? '开启' : '关闭'}`, 'success');
  else errorToast(devices.getCmdState(d.id, 'switch')?.error ?? '控制失败');
}

function powerOf(d: DeviceDto): boolean {
  return d.state?.state?.power === true;
}
function onlineOf(d: DeviceDto): boolean {
  return d.state?.online ?? false;
}
</script>

<template>
  <view class="page allhome">
    <!-- 快捷模式 -->
    <view class="modes">
      <view v-for="m in MODES" :key="m.name" class="mode" @click="runMode(m)">
        <view class="mode-icon">{{ m.icon }}</view>
        <view class="mode-name">{{ m.name }}</view>
      </view>
    </view>

    <!-- 房间筛选 -->
    <scroll-view scroll-x class="room-chips" :show-scrollbar="false">
      <view
        class="rchip"
        :class="{ active: activeRoom === 'all' }"
        @click="activeRoom = 'all'"
      >
        全部（{{ devices.devices.length }}）
      </view>
      <view
        v-for="g in roomGroups"
        :key="g.name"
        class="rchip"
        :class="{ active: activeRoom === g.name }"
        @click="activeRoom = g.name"
      >
        {{ g.name }}（{{ g.list.length }}）
      </view>
    </scroll-view>

    <!-- 房间分组设备 -->
    <view v-for="g in shownGroups" :key="g.name" class="group">
      <view class="group-title row-between">
        <text>📍 {{ g.name }}</text>
        <text class="group-count">{{ g.list.filter(onlineOf).length }}/{{ g.list.length }} 在线</text>
      </view>
      <view class="group-card card">
        <view v-for="d in g.list" :key="d.id" class="drow" @click="openDevice(d)">
          <view class="drow-icon" :class="{ on: powerOf(d) && onlineOf(d) }">
            {{ onlineOf(d) ? (powerOf(d) ? '▶' : '⏸') : '⚡' }}
          </view>
          <view class="drow-main">
            <view class="drow-name">{{ d.name }}</view>
            <view class="drow-state">
              {{ onlineOf(d) ? (powerOf(d) ? '运行中' : '待机') : '离线' }}
            </view>
          </view>
          <view @click.stop>
            <PowerSwitch
              v-if="d.state"
              :model-value="powerOf(d)"
              :disabled="!onlineOf(d)"
              @toggle="(v: boolean) => toggle(d, v)"
            />
          </view>
        </view>
      </view>
    </view>

    <view v-if="!devices.devices.length && !devices.loading" class="empty-inline">还没有设备</view>
  </view>
</template>

<style scoped lang="scss">
.allhome {
  padding: 24rpx 28rpx 60rpx;
}
.modes {
  display: flex;
  gap: 20rpx;
}
.mode {
  flex: 1;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  box-shadow: 0 8rpx 32rpx rgba(29, 37, 38, 0.05);
}
.mode-icon {
  font-size: 48rpx;
}
.mode-name {
  font-size: 26rpx;
  color: #45585a;
}
.room-chips {
  margin-top: 30rpx;
  white-space: nowrap;
  width: 100%;
}
.rchip {
  display: inline-flex;
  padding: 14rpx 32rpx;
  background: #fff;
  border-radius: 999rpx;
  color: #6b7a7c;
  font-size: 26rpx;
  margin-right: 18rpx;
  &.active {
    background: #12bfc1;
    color: #fff;
    font-weight: 600;
  }
}
.group {
  margin-top: 30rpx;
}
.group-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.group-count {
  font-size: 24rpx;
  color: #8a9a9c;
  font-weight: 400;
}
.group-card {
  padding: 8rpx 26rpx;
}
.drow {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 2rpx solid #f4f8f8;
  &:last-child {
    border-bottom: none;
  }
}
.drow-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 22rpx;
  background: #f2f7f8;
  color: #a4b0b2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 22rpx;
  &.on {
    background: #d8f4f4;
    color: #12bfc1;
  }
}
.drow-main {
  flex: 1;
}
.drow-name {
  font-size: 30rpx;
  font-weight: 600;
}
.drow-state {
  margin-top: 4rpx;
  font-size: 23rpx;
  color: #8a9a9c;
}
</style>
