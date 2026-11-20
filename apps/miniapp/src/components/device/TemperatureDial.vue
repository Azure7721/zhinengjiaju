<script setup lang="ts">
/** 温度圆盘：环形进度 + 旋钮 + 加减（conic-gradient，不支持时退化为灰环） */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    label?: string;
    disabled?: boolean;
  }>(),
  { min: 16, max: 30, step: 1, unit: '℃', label: '温度', disabled: false },
);
const emit = defineEmits<{ change: [number] }>();

const p = computed(() => {
  const span = props.max - props.min || 1;
  return Math.min(1, Math.max(0, (Number(props.value) - props.min) / span));
});
const angle = computed(() => -90 + p.value * 360);
const arcStyle = computed(() => ({
  background: `conic-gradient(from -90deg, #12bfc1 0 ${(p.value * 100).toFixed(1)}%, #e8eff0 ${(p.value * 100).toFixed(1)}% 100%)`,
}));

function step(dir: 1 | -1) {
  if (props.disabled) return;
  const next = Number(props.value) + dir * props.step;
  const clamped = Math.min(props.max, Math.max(props.min, next));
  if (clamped !== Number(props.value)) emit('change', clamped);
}
</script>

<template>
  <view class="dial">
    <view class="dial-arc" :style="arcStyle" />
    <view class="dial-inner">
      <view class="dial-label">{{ label }}</view>
      <view class="dial-value-row">
        <view class="dial-btn" :class="{ disabled }" @click="step(-1)">−</view>
        <view class="dial-value">
          {{ value }}
          <text class="dial-unit">{{ unit }}</text>
        </view>
        <view class="dial-btn" :class="{ disabled }" @click="step(1)">＋</view>
      </view>
      <view class="dial-range">{{ min }}{{ unit }} – {{ max }}{{ unit }}</view>
    </view>
    <view class="dial-knob-wrap" :style="{ transform: `rotate(${angle}deg)` }">
      <view class="dial-knob" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.dial {
  position: relative;
  width: 460rpx;
  height: 460rpx;
  margin: 24rpx auto 8rpx;
}
.dial-arc {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.dial-inner {
  position: absolute;
  inset: 34rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: inset 0 4rpx 24rpx rgba(29, 37, 38, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.dial-label {
  color: #93a1a3;
  font-size: 26rpx;
}
.dial-value-row {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}
.dial-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f2f7f8;
  color: #12bfc1;
  font-size: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  &.disabled {
    opacity: 0.4;
  }
}
.dial-value {
  min-width: 180rpx;
  text-align: center;
  font-size: 88rpx;
  font-weight: 300;
  color: #1d2526;
  line-height: 1.1;
}
.dial-unit {
  font-size: 30rpx;
  color: #93a1a3;
  vertical-align: super;
}
.dial-range {
  margin-top: 8rpx;
  color: #c0cbcc;
  font-size: 22rpx;
}
.dial-knob-wrap {
  position: absolute;
  inset: 0;
}
.dial-knob {
  position: absolute;
  top: -6rpx;
  left: 50%;
  width: 56rpx;
  height: 56rpx;
  margin-left: -28rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 6rpx 20rpx rgba(29, 37, 38, 0.18);
}
</style>
