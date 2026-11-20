<script setup lang="ts">
/**
 * WiFi / 网络管理（A 类）：当前网络状态 + 重新配网入口
 */
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { http } from '@/platform/request';
import { underDev } from '@/components/feedback/UnderDev';

const networkType = ref('获取中…');
const serverOk = ref<boolean | null>(null);
const checking = ref(false);

onShow(() => void check());

async function check() {
  checking.value = true;
  try {
    await new Promise<void>((resolve) => {
      uni.getNetworkType({
        success: (res) => {
          networkType.value = String(res.networkType ?? 'unknown').toUpperCase();
          resolve();
        },
        fail: () => {
          networkType.value = 'UNKNOWN';
          resolve();
        },
      });
    });
    await http.get('/health');
    serverOk.value = true;
  } catch {
    serverOk.value = false;
  } finally {
    checking.value = false;
  }
}

function reProvision() {
  uni.navigateTo({ url: '/pkgAdd/index/index' });
}
</script>

<template>
  <view class="page wifi">
    <!-- 状态卡 -->
    <view class="status card">
      <view class="status-icon">📶</view>
      <view class="status-main">
        <view class="status-net">本机网络 · {{ networkType }}</view>
        <view class="status-server">
          服务端连接：
          <text :class="serverOk === true ? 'ok' : serverOk === false ? 'bad' : ''">
            {{ serverOk === true ? '正常' : serverOk === false ? '不可达' : '检测中…' }}
          </text>
        </view>
      </view>
      <view class="status-refresh" :class="{ checking }" @click="check">
        {{ checking ? '…' : '↻' }}
      </view>
    </view>

    <!-- 设备网络 -->
    <view class="section-title">设备网络</view>
    <view class="card block">
      <view class="block-row">
        <text>家庭路由器</text>
        <text class="block-val" @click="underDev('WiFi 密码管理')">Home-WiFi-5G ›</text>
      </view>
      <view class="block-row">
        <text>配网协议</text>
        <text class="block-val">BLE + SoftAP（演示）</text>
      </view>
      <view class="block-row">
        <text>已配网设备</text>
        <text class="block-val">见设备列表</text>
      </view>
    </view>

    <!-- 重新配网 -->
    <view class="reprovision card" @click="reProvision">
      <view class="rp-icon">🔗</view>
      <view class="rp-main">
        <view class="rp-title">重新配网设备</view>
        <view class="rp-sub">更换路由器或设备离线时，走一遍配网流程</view>
      </view>
      <view class="rp-arrow">›</view>
    </view>

    <!-- 提示 -->
    <view class="tips card">
      <view class="tips-title">网络提示</view>
      <view class="tips-item">· 小程序需连接 2.4GHz/5GHz 均可（演示环境）</view>
      <view class="tips-item">· 设备仅支持 2.4GHz 配网</view>
      <view class="tips-item">· 修改路由器密码后需重新配网</view>
      <view class="tips-item" @click="underDev('网络诊断')">运行网络诊断 ›</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.wifi {
  padding: 24rpx 28rpx 60rpx;
}
.status {
  display: flex;
  align-items: center;
  padding: 32rpx 30rpx;
}
.status-icon {
  font-size: 56rpx;
  margin-right: 24rpx;
}
.status-main {
  flex: 1;
}
.status-net {
  font-size: 31rpx;
  font-weight: 600;
}
.status-server {
  margin-top: 8rpx;
  font-size: 25rpx;
  color: #8a9a9c;
  .ok {
    color: #2fc18c;
  }
  .bad {
    color: #f5564e;
  }
}
.status-refresh {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #eefafa;
  color: #12bfc1;
  font-size: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  &.checking {
    opacity: 0.5;
  }
}
.block {
  padding: 8rpx 30rpx;
}
.block-row {
  display: flex;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 2rpx solid #f4f8f8;
  font-size: 28rpx;
  &:last-child {
    border-bottom: none;
  }
}
.block-val {
  color: #8a9a9c;
}
.reprovision {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  padding: 32rpx 30rpx;
  background: linear-gradient(120deg, #eafafa, #f7fdfd);
}
.rp-icon {
  font-size: 48rpx;
  margin-right: 22rpx;
}
.rp-main {
  flex: 1;
}
.rp-title {
  font-size: 31rpx;
  font-weight: 600;
}
.rp-sub {
  margin-top: 6rpx;
  color: #8a9a9c;
  font-size: 24rpx;
}
.rp-arrow {
  color: #12bfc1;
  font-size: 38rpx;
}
.tips {
  margin-top: 24rpx;
  padding: 28rpx 32rpx;
}
.tips-title {
  font-size: 29rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.tips-item {
  color: #6b7a7c;
  font-size: 25rpx;
  margin-top: 10rpx;
}
</style>
