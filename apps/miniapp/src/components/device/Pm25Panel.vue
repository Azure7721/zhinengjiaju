<script setup lang="ts">
/** PM2.5 只读面板 */
import { computed } from 'vue';

const props = defineProps<{ value: number; label?: string }>();

const level = computed(() => {
  const v = Number(props.value) || 0;
  if (v <= 35) return { text: '优', color: '#2fc18c' };
  if (v <= 75) return { text: '良', color: '#12bfc1' };
  if (v <= 115) return { text: '轻度污染', color: '#ff9f43' };
  if (v <= 150) return { text: '中度污染', color: '#f5564e' };
  return { text: '重度污染', color: '#e0342b' };
});
</script>

<template>
  <view class="pm">
    <view class="pm-label">{{ label ?? 'PM2.5' }}</view>
    <view class="pm-row">
      <text class="pm-value">{{ value ?? '--' }}</text>
      <text class="pm-unit">μg/m³</text>
      <text class="pm-level" :style="{ color: level.color, borderColor: level.color }">{{ level.text }}</text>
    </view>
    <view class="pm-bar">
      <view class="pm-bar-fill" :style="{ width: Math.min(100, ((Number(value) || 0) / 250) * 100) + '%' }" />
    </view>
    <view class="pm-hint">实时空气质量监测</view>
  </view>
</template>

<style scoped lang="scss">
.pm {
  background: linear-gradient(135deg, #eefafa, #f7fbfb);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
}
.pm-label {
  font-size: 26rpx;
  color: #6b7a7c;
}
.pm-row {
  display: flex;
  align-items: baseline;
  margin-top: 8rpx;
}
.pm-value {
  font-size: 84rpx;
  font-weight: 300;
  color: #1d2526;
  line-height: 1.1;
}
.pm-unit {
  margin-left: 12rpx;
  color: #93a1a3;
  font-size: 26rpx;
}
.pm-level {
  margin-left: auto;
  font-size: 24rpx;
  padding: 6rpx 20rpx;
  border: 2rpx solid;
  border-radius: 999rpx;
}
.pm-bar {
  height: 12rpx;
  background: #e4eded;
  border-radius: 999rpx;
  margin-top: 20rpx;
  overflow: hidden;
}
.pm-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #12bfc1, #7bdedf);
  border-radius: 999rpx;
}
.pm-hint {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #a4b0b2;
}
</style>
