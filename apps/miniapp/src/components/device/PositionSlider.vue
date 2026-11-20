<script setup lang="ts">
/** 通用滑杆：位置/亮度等（uni slider，松手时才发命令） */
import { ref, watch } from 'vue';

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
  { min: 0, max: 100, step: 1, unit: '%', label: '位置', disabled: false },
);
const emit = defineEmits<{ change: [number] }>();

const local = ref(Number(props.value) || 0);
watch(
  () => props.value,
  (v) => {
    local.value = Number(v) || 0;
  },
);

function onChanging(e: any) {
  local.value = e.detail.value;
}
function onChange(e: any) {
  local.value = e.detail.value;
  emit('change', local.value);
}
</script>

<template>
  <view class="slider-box">
    <view class="slider-head row-between">
      <text class="slider-label">{{ label }}</text>
      <text class="slider-value">{{ local }}{{ unit }}</text>
    </view>
    <slider
      :value="local"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      activeColor="#12BFC1"
      backgroundColor="#E8EFF0"
      block-color="#ffffff"
      block-size="26"
      @changing="onChanging"
      @change="onChange"
    />
  </view>
</template>

<style scoped lang="scss">
.slider-box {
  padding: 8rpx 8rpx 0;
}
.slider-head {
  margin-bottom: 4rpx;
}
.slider-label {
  color: #6b7a7c;
  font-size: 26rpx;
}
.slider-value {
  color: #12bfc1;
  font-size: 32rpx;
  font-weight: 600;
}
</style>
