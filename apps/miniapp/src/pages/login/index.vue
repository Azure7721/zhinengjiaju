<script setup lang="ts">
/**
 * 登录页（A 类新设计）：微信一键登录（mock）+ 演示账号 + 隐私协议
 */
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import { errorToast, toast } from '@/platform/toast';

const user = useUserStore();
const device = useDeviceStore();
const loading = ref(false);

onLoad(() => {
  if (user.isLoggedIn) goHome();
});

function goHome() {
  uni.switchTab({ url: '/pages/home/index' });
}

/** 微信一键登录（演示环境走 mock 接口） */
async function wxLogin() {
  if (loading.value) return;
  loading.value = true;
  try {
    await user.mockLogin('userA', 'mock_userA');
    await device.load(true);
    goHome();
  } catch (e: any) {
    errorToast(e?.message ?? '登录失败');
  } finally {
    loading.value = false;
  }
}

/** 演示账号：userA（5 台设备 2 场景）/ userB */
function demoLogin() {
  uni.showActionSheet({
    itemList: ['演示账号 userA（5 台设备 · 2 场景）', '演示账号 userB'],
    success: async (res) => {
      const nickname = res.tapIndex === 1 ? 'userB' : 'userA';
      if (loading.value) return;
      loading.value = true;
      try {
        await user.mockLogin(nickname, `mock_${nickname}`);
        await device.load(true);
        goHome();
      } catch (e: any) {
        errorToast(e?.message ?? '登录失败');
      } finally {
        loading.value = false;
      }
    },
  });
}

function showPrivacy() {
  uni.showModal({
    title: '隐私协议',
    content:
      '我们仅在演示环境下收集设备状态与家庭信息，用于展示全屋智能功能；不会上传真实个人数据。点击同意即表示您已阅读并同意《隐私政策》与《用户协议》。',
    confirmText: '我知道了',
    showCancel: false,
  });
}
</script>

<template>
  <view class="login">
    <view class="login-bg" />
    <view class="login-hero">
      <view class="logo">智</view>
      <view class="app-name">智慧家</view>
      <view class="slogan">全屋智能 · 一屏掌控</view>
    </view>

    <view class="login-panel card">
      <button class="wx-btn" :disabled="loading" @click="wxLogin">
        {{ loading ? '登录中…' : '微信一键登录' }}
      </button>
      <view class="demo-btn" @click="demoLogin">使用演示账号</view>
      <view class="divider"><text class="line" />登录即代表同意<text class="link" @click="showPrivacy">《隐私协议》</text><text class="line" /></view>
    </view>

    <view class="footer-tip">演示环境 · 服务端 127.0.0.1:3000</view>
  </view>
</template>

<style scoped lang="scss">
.login {
  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  background: #f2f7f8;
}
.login-bg {
  position: absolute;
  top: -160rpx;
  left: -120rpx;
  width: 700rpx;
  height: 700rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, rgba(18, 191, 193, 0.22), rgba(18, 191, 193, 0));
}
.login-hero {
  margin-top: 22vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.logo {
  width: 140rpx;
  height: 140rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, #12bfc1, #5bd6d7);
  color: #fff;
  font-size: 72rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 40rpx rgba(18, 191, 193, 0.4);
}
.app-name {
  margin-top: 28rpx;
  font-size: 48rpx;
  font-weight: 700;
  color: #1d2526;
  letter-spacing: 4rpx;
}
.slogan {
  margin-top: 12rpx;
  color: #8a9a9c;
  font-size: 26rpx;
}
.login-panel {
  position: absolute;
  left: 48rpx;
  right: 48rpx;
  bottom: 160rpx;
  padding: 48rpx 40rpx 36rpx;
  box-sizing: border-box;
}
.wx-btn {
  background: #12bfc1;
  color: #fff;
  border-radius: 999rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  &::after {
    border: none;
  }
}
.demo-btn {
  margin-top: 28rpx;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 999rpx;
  background: #eef7f8;
  color: #0b8e90;
  font-size: 29rpx;
}
.divider {
  margin-top: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: #a4b0b2;
  font-size: 23rpx;
}
.line {
  width: 70rpx;
  height: 2rpx;
  background: #e6eef0;
}
.link {
  color: #12bfc1;
}
.footer-tip {
  position: absolute;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  color: #c0cbcc;
  font-size: 22rpx;
}
</style>
