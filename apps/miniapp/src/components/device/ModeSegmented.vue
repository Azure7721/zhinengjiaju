<script setup lang="ts">
/** 分段控件：模式/风速等枚举能力 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    value: string;
    values: string[];
    label?: string;
    disabled?: boolean;
  }>(),
  { label: '模式', disabled: false },
);
const emit = defineEmits<{ change: [string] }>();

const LABEL_MAP: Record<string, string> = {
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

const items = computed(() =>
  (props.values ?? []).map((v) => ({ value: v, label: LABEL_MAP[v] ?? v })),
);

function pick(v: string) {
  if (props.disabled || v === props.value) return;
  emit('change', v);
}
</script>

<template>
  <view class="seg">
    <view class="seg-label">{{ label }}</view>
    <view class="seg-track">
      <view
        v-for="it in items"
        :key="it.value"
        class="seg-item"
        :class="{ active: it.value === value }"
        @click="pick(it.value)"
      >
        {{ it.label }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.seg {
  margin: 20rpx 0;
}
.seg-label {
  font-size: 26rpx;
  color: #6b7a7c;
  margin-bottom: 12rpx;
}
.seg-track {
  display: flex;
  background: #f2f7f8;
  border-radius: 999rpx;
  padding: 8rpx;
}
.seg-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 999rpx;
  font-size: 27rpx;
  color: #6b7a7c;
  &.active {
    background: #12bfc1;
    color: #fff;
    font-weight: 600;
    box-shadow: 0 6rpx 16rpx rgba(18, 191, 193, 0.35);
  }
}
</style>
