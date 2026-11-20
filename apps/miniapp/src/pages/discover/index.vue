<script setup lang="ts">
/**
 * 发现（B 类占位）：Tab 保留，内容「正在开发中」
 */
import { onShow } from '@dcloudio/uni-app';
import { underDev } from '@/components/feedback/UnderDev';

let toastOnce = false;
onShow(() => {
  if (!toastOnce) {
    toastOnce = true;
    underDev('发现');
  }
});

function goHome() {
  uni.switchTab({ url: '/pages/home/index' });
}
</script>

<template>
  <view class="page dev">
    <view class="dev-icon">🪐</view>
    <view class="dev-title">发现</view>
    <view class="dev-sub">内容流、活动位、玩法推荐</view>
    <view class="dev-tag">正在开发中</view>
    <view class="dev-back" @click="goHome">回首页</view>
  </view>
</template>

<style scoped lang="scss">
.dev {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
}
.dev-icon {
  font-size: 110rpx;
}
.dev-title {
  font-size: 42rpx;
  font-weight: 700;
}
.dev-sub {
  color: #8a9a9c;
  font-size: 26rpx;
}
.dev-tag {
  margin-top: 16rpx;
  background: #eefafa;
  color: #12bfc1;
  font-size: 26rpx;
  padding: 12rpx 40rpx;
  border-radius: 999rpx;
}
.dev-back {
  margin-top: 40rpx;
  color: #fff;
  background: #12bfc1;
  padding: 20rpx 70rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
}
</style>
