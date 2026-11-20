<script setup lang="ts">
defineProps<{
  show: boolean;
  title?: string;
}>();
defineEmits<{ close: [] }>();
</script>

<template>
  <view v-if="show" class="sheet-mask" @click="$emit('close')">
    <view class="sheet-body" @click.stop>
      <view class="sheet-handle" />
      <view v-if="title" class="sheet-title">{{ title }}</view>
      <slot />
      <view style="height: env(safe-area-inset-bottom)" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 31, 0.45);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}
.sheet-body {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 16rpx 32rpx 24rpx;
  box-sizing: border-box;
}
.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: #e0e8e9;
  margin: 8rpx auto 16rpx;
}
.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 20rpx;
}
</style>
