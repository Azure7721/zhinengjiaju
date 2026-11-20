<script setup lang="ts">
/** 电源开关：pill（iOS 风）或 circle（详情页头部） */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    variant?: 'pill' | 'circle';
    size?: number;
  }>(),
  { disabled: false, variant: 'pill', size: 0 },
);
const emit = defineEmits<{ 'update:modelValue': [boolean]; toggle: [boolean] }>();

function onTap() {
  if (props.disabled) return;
  const next = !props.modelValue;
  emit('update:modelValue', next);
  emit('toggle', next);
}
</script>

<template>
  <view
    v-if="variant === 'circle'"
    class="power-circle"
    :class="{ on: modelValue, disabled }"
    :style="size ? { width: size + 'rpx', height: size + 'rpx' } : {}"
    @click="onTap"
  >
    <text class="power-glyph">⏻</text>
  </view>
  <view
    v-else
    class="power-pill"
    :class="{ on: modelValue, disabled }"
    @click="onTap"
  >
    <view class="power-knob" />
  </view>
</template>

<style scoped lang="scss">
.power-pill {
  width: 92rpx;
  height: 52rpx;
  border-radius: 999rpx;
  background: #dfe7e8;
  position: relative;
  transition: background 0.2s;
  &.on {
    background: #12bfc1;
  }
  &.disabled {
    opacity: 0.5;
  }
}
.power-knob {
  position: absolute;
  top: 6rpx;
  left: 6rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
}
.power-pill.on .power-knob {
  transform: translateX(40rpx);
}
.power-circle {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #eef2f3;
  display: flex;
  align-items: center;
  justify-content: center;
  &.on {
    background: #12bfc1;
    box-shadow: 0 10rpx 26rpx rgba(18, 191, 193, 0.4);
  }
  &.disabled {
    opacity: 0.5;
  }
}
.power-glyph {
  font-size: 44rpx;
  color: #94a3a5;
}
.power-circle.on .power-glyph {
  color: #fff;
}
</style>
