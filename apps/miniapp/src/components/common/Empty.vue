<script setup lang="ts">
defineProps<{
  text?: string;
  actionText?: string;
}>();
defineEmits<{ action: [] }>();
</script>

<template>
  <view class="empty">
    <view class="empty-icon">☁</view>
    <view class="empty-text">{{ text ?? '暂无数据' }}</view>
    <view v-if="actionText" class="empty-action" @click="$emit('action')">{{ actionText }}</view>
  </view>
</template>

<style scoped lang="scss">
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 60rpx;
}
.empty-icon {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: #e8f5f5;
  color: #12bfc1;
  font-size: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-text {
  margin-top: 24rpx;
  color: #a4b0b2;
  font-size: 26rpx;
}
.empty-action {
  margin-top: 32rpx;
  padding: 18rpx 56rpx;
  border-radius: 999rpx;
  background: #12bfc1;
  color: #fff;
  font-size: 28rpx;
}
</style>
