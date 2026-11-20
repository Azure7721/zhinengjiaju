<script setup lang="ts">
/**
 * 设置（A 类新设计）：账号 · 通知 · 通用 · 关于 · 退出登录
 */
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import { realtime } from '@/platform/ws';
import { errorToast, toast } from '@/platform/toast';
import { API_BASE } from '@/platform/request';
import { underDev } from '@/components/feedback/UnderDev';

const user = useUserStore();
const devices = useDeviceStore();

const pushEnabled = ref(true);
const clearing = ref(false);

onShow(() => {
  if (!user.isLoggedIn) uni.reLaunch({ url: '/pages/login/index' });
});

function togglePush(v: boolean) {
  pushEnabled.value = v;
  toast(v ? '已开启消息推送（本地）' : '已关闭消息推送（本地）');
}

async function clearCache() {
  clearing.value = true;
  try {
    await devices.reload();
    toast('缓存已刷新', 'success');
  } catch (e: any) {
    errorToast(e?.message ?? '刷新失败');
  } finally {
    clearing.value = false;
  }
}

function about() {
  uni.showModal({
    title: '关于智慧家',
    content: `版本 0.1.0\n服务端 ${API_BASE}\n全屋智能小程序用户端（P3 演示）`,
    showCancel: false,
  });
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号？',
    confirmColor: '#F5564E',
    success: (res) => {
      if (!res.confirm) return;
      realtime.disconnect();
      devices.stopPolling();
      user.logout();
      uni.reLaunch({ url: '/pages/login/index' });
    },
  });
}
</script>

<template>
  <view class="page settings">
    <!-- 账号 -->
    <view class="group card">
      <view class="g-title">账号</view>
      <view class="row-item">
        <text class="row-label">昵称</text>
        <text class="row-value">{{ user.user?.nickname ?? '—' }}</text>
      </view>
      <view class="row-item" @click="underDev('账号安全')">
        <text class="row-label">账号安全</text>
        <text class="row-value">密码 / 设备管理 ›</text>
      </view>
    </view>

    <!-- 通知 -->
    <view class="group card">
      <view class="g-title">消息通知</view>
      <view class="row-item">
        <text class="row-label">推送通知</text>
        <switch :checked="pushEnabled" color="#12BFC1" @change="(e: any) => togglePush(e.detail.value)" />
      </view>
      <view class="row-item" @click="underDev('免打扰时段')">
        <text class="row-label">免打扰时段</text>
        <text class="row-value">未设置 ›</text>
      </view>
    </view>

    <!-- 通用 -->
    <view class="group card">
      <view class="g-title">通用</view>
      <view class="row-item" @click="!clearing && clearCache()">
        <text class="row-label">刷新本地缓存</text>
        <text class="row-value">{{ clearing ? '刷新中…' : '›' }}</text>
      </view>
      <view class="row-item" @click="underDev('深色模式')">
        <text class="row-label">外观</text>
        <text class="row-value">跟随系统 ›</text>
      </view>
    </view>

    <!-- 关于 -->
    <view class="group card">
      <view class="g-title">关于</view>
      <view class="row-item" @click="about">
        <text class="row-label">版本</text>
        <text class="row-value">0.1.0 ›</text>
      </view>
      <view class="row-item" @click="underDev('用户协议')">
        <text class="row-label">用户协议与隐私政策</text>
        <text class="row-value">›</text>
      </view>
    </view>

    <view class="logout" @click="logout">退出登录</view>
  </view>
</template>

<style scoped lang="scss">
.settings {
  padding: 24rpx 28rpx 60rpx;
}
.group {
  padding: 10rpx 0;
  margin-bottom: 24rpx;
}
.g-title {
  font-size: 25rpx;
  color: #a4b0b2;
  padding: 24rpx 30rpx 8rpx;
}
.row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 2rpx solid #f4f8f8;
  &:last-child {
    border-bottom: none;
  }
}
.row-label {
  font-size: 29rpx;
  color: #1d2526;
}
.row-value {
  font-size: 26rpx;
  color: #a4b0b2;
}
.logout {
  margin-top: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  text-align: center;
  padding: 30rpx 0;
  color: #f5564e;
  font-size: 30rpx;
  font-weight: 600;
}
</style>
