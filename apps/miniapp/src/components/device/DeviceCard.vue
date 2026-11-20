<script setup lang="ts">
/** 首页运行设备卡：状态为主 + 快捷电源 + 进入详情 */
import { computed } from 'vue';
import type { DeviceDto } from '@smart-home/shared';
import PowerSwitch from './PowerSwitch.vue';

const props = defineProps<{ device: DeviceDto }>();
const emit = defineEmits<{ open: []; toggle: [boolean] }>();

const roomName = computed(() => props.device.roomName || '未分配');
const online = computed(() => props.device.state?.online ?? false);
const power = computed(() => props.device.state?.state?.power === true);
const state = computed(() => props.device.state?.state ?? {});

/** 状态摘要 chips：按常见字段生成 */
const chips = computed(() => {
  const s = state.value;
  const out: string[] = [];
  if (typeof s.mode === 'string') out.push(modeLabel(s.mode));
  if (typeof s.targetTemp === 'number') out.push(`${s.targetTemp}℃`);
  if (typeof s.fanSpeed === 'string') out.push(`风速 ${modeLabel(s.fanSpeed)}`);
  if (typeof s.position === 'number') out.push(`开合 ${s.position}%`);
  if (typeof s.brightness === 'number') out.push(`亮度 ${s.brightness}%`);
  if (typeof s.pm25 === 'number') out.push(`PM2.5 ${s.pm25}`);
  if (!out.length) out.push(power.value ? '运行中' : '已关闭');
  return out.slice(0, 3);
});

/** 进度：窗帘按开合度，其余运行时给氛围条 */
const progress = computed(() => {
  const s = state.value;
  if (typeof s.position === 'number') return s.position;
  return null;
});

function modeLabel(v: string): string {
  const map: Record<string, string> = {
    cool: '制冷',
    heat: '制热',
    auto: '自动',
    dry: '除湿',
    fan: '送风',
    low: '低速',
    mid: '中速',
    high: '高速',
    open: '打开',
    pause: '暂停',
    close: '关闭',
    sleep: '静音',
    turbo: '强力',
    a: 'A 档',
    b: 'B 档',
    c: 'C 档',
  };
  return map[v] ?? v;
}
</script>

<template>
  <view class="dcard" @click="emit('open')">
    <view class="dcard-icon" :class="{ on: power && online, off: !power }">
      {{ online ? (power ? '▶' : '⏸') : '⚡' }}
    </view>
    <view class="dcard-main">
      <view class="dcard-title row-between">
        <text class="dcard-name">{{ device.name }}</text>
        <view @click.stop>
          <PowerSwitch
            :model-value="power"
            :disabled="!online"
            variant="pill"
            @toggle="(v: boolean) => emit('toggle', v)"
          />
        </view>
      </view>
      <view class="dcard-room">
        {{ roomName }}
        <text v-if="!online" class="offline">· 离线</text>
      </view>
      <view class="dcard-chips">
        <text v-for="(c, i) in chips" :key="i" class="dchip">{{ c }}</text>
      </view>
      <view v-if="progress !== null" class="dcard-progress">
        <view class="dcard-progress-track">
          <view class="dcard-progress-fill" :style="{ width: progress + '%' }" />
        </view>
        <text class="dcard-progress-num">{{ progress }}%</text>
      </view>
    </view>
    <view class="dcard-arrow">›</view>
  </view>
</template>

<style scoped lang="scss">
.dcard {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 32rpx rgba(29, 37, 38, 0.05);
}
.dcard-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-right: 24rpx;
  flex-shrink: 0;
  &.on {
    background: #d8f4f4;
    color: #12bfc1;
  }
  &.off {
    background: #f2f7f8;
    color: #a4b0b2;
  }
}
.dcard-main {
  flex: 1;
  min-width: 0;
}
.dcard-name {
  font-size: 31rpx;
  font-weight: 600;
  color: #1d2526;
}
.dcard-room {
  font-size: 24rpx;
  color: #a4b0b2;
  margin-top: 4rpx;
}
.offline {
  color: #f5564e;
}
.dcard-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}
.dchip {
  background: #f2f7f8;
  color: #45585a;
  font-size: 23rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
}
.dcard-progress {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 16rpx;
}
.dcard-progress-track {
  flex: 1;
  height: 12rpx;
  background: #eef2f3;
  border-radius: 999rpx;
  overflow: hidden;
}
.dcard-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #12bfc1, #7bdedf);
  border-radius: 999rpx;
}
.dcard-progress-num {
  font-size: 24rpx;
  color: #12bfc1;
  min-width: 70rpx;
  text-align: right;
}
.dcard-arrow {
  color: #c0cbcc;
  font-size: 44rpx;
  margin-left: 8rpx;
}
</style>
