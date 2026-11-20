<script setup lang="ts">
/**
 * 添加设备（P0）：扫描附近设备（演示：调 GET /devices/models + 模拟 BLE 扫描结果）
 */
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useDeviceStore } from '@/core/stores/device';
import Empty from '@/components/common/Empty.vue';
import { errorToast } from '@/platform/toast';

interface NearbyItem {
  serial: string;
  modelCode: string;
  modelName: string;
  rssi: number;
}

const devices = useDeviceStore();
const scanning = ref(false);
const scanned = ref(false);
const list = ref<NearbyItem[]>([]);
const errMsg = ref('');

onLoad(() => {
  void devices.loadModels();
});

/** 模拟 BLE 扫描：随机序列号 + 型号元数据（真机可换 uni.startBluetoothDevicesDiscovery） */
async function scan() {
  scanning.value = true;
  errMsg.value = '';
  scanned.value = false;
  list.value = [];
  try {
    await devices.loadModels();
  } catch {
    /* 忽略：仍可用内置型号 */
  }
  setTimeout(() => {
    const pool = devices.models.length
      ? devices.models.map((m) => ({ code: m._code ?? m.model, name: m.name }))
      : [
          { code: 'ac.dual.v1', name: '双模空调' },
          { code: 'purifier.v1', name: '空气净化器' },
          { code: 'curtain.v1', name: '智能窗帘' },
        ];
    const stamp = String(Date.now()).slice(-5);
    list.value = pool.slice(0, 3).map((m, i) => ({
      serial: `DEMO-NEW-${stamp}-${i + 1}`,
      modelCode: m.code,
      modelName: m.name,
      rssi: -45 - i * 8,
    }));
    scanned.value = true;
    scanning.value = false;
    if (!list.value.length) errMsg.value = '未发现设备，请确认设备已通电并靠近手机';
  }, 1500);
}

function connect(item: NearbyItem) {
  uni.navigateTo({
    url: `/pkgAdd/connect/index?serial=${encodeURIComponent(item.serial)}&modelCode=${encodeURIComponent(
      item.modelCode,
    )}&modelName=${encodeURIComponent(item.modelName)}`,
  });
}

function help() {
  errorToast('请长按设备重置键 3 秒进入配网模式');
}
</script>

<template>
  <view class="page add">
    <view class="hero card">
      <view class="hero-icon">📡</view>
      <view class="hero-title">添加设备</view>
      <view class="hero-sub">打开蓝牙与定位，让设备靠近手机</view>
      <view class="scan-btn" :class="{ scanning }" @click="!scanning && scan()">
        {{ scanning ? '扫描中…' : scanned ? '重新扫描' : '开始扫描' }}
      </view>
      <view class="scan-hint" v-if="scanning">
        <view class="scan-ring" />
      </view>
    </view>

    <!-- 扫描动画进度 -->
    <view v-if="scanning" class="scan-progress">
      <view class="scan-progress-bar"><view class="scan-progress-fill" /></view>
      <text class="scan-progress-text">正在搜索附近设备…</text>
    </view>

    <!-- 扫描结果 -->
    <template v-if="scanned && !scanning">
      <view class="section-title">附近设备（{{ list.length }}）</view>
      <Empty v-if="!list.length" :text="errMsg || '未发现设备'" action-text="如何进入配网模式" @action="help" />
      <view v-for="item in list" :key="item.serial" class="nearby card" @click="connect(item)">
        <view class="nearby-icon">📱</view>
        <view class="nearby-main">
          <view class="nearby-name">{{ item.modelName }}</view>
          <view class="nearby-meta">SN {{ item.serial }} · 信号 {{ item.rssi }}dBm</view>
        </view>
        <view class="nearby-cta">连接 ›</view>
      </view>
    </template>

    <view class="tips card">
      <view class="tips-title">没有找到设备？</view>
      <view class="tips-item">1. 确认设备已通电、处于配网模式</view>
      <view class="tips-item">2. 手机靠近设备 1 米以内</view>
      <view class="tips-item">3. 检查手机蓝牙与定位权限</view>
      <view class="tips-link" @click="help">仍无法连接，查看帮助 ›</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.add {
  padding: 24rpx 28rpx 60rpx;
}
.hero {
  padding: 48rpx 32rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hero-icon {
  font-size: 88rpx;
}
.hero-title {
  margin-top: 16rpx;
  font-size: 38rpx;
  font-weight: 700;
}
.hero-sub {
  margin-top: 10rpx;
  color: #8a9a9c;
  font-size: 25rpx;
}
.scan-btn {
  margin-top: 36rpx;
  background: #12bfc1;
  color: #fff;
  border-radius: 999rpx;
  padding: 24rpx 96rpx;
  font-size: 31rpx;
  font-weight: 600;
  box-shadow: 0 12rpx 30rpx rgba(18, 191, 193, 0.35);
  &.scanning {
    opacity: 0.6;
  }
}
.scan-hint {
  margin-top: 24rpx;
}
.scan-ring {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  border: 6rpx solid #d8f4f4;
  border-top-color: #12bfc1;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.scan-progress {
  margin-top: 32rpx;
}
.scan-progress-bar {
  height: 14rpx;
  background: #e4eded;
  border-radius: 999rpx;
  overflow: hidden;
}
.scan-progress-fill {
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, #12bfc1, #7bdedf);
  border-radius: 999rpx;
  animation: slide 1.4s ease-in-out infinite alternate;
}
@keyframes slide {
  from {
    margin-left: -40%;
  }
  to {
    margin-left: 60%;
  }
}
.scan-progress-text {
  display: block;
  text-align: center;
  margin-top: 16rpx;
  color: #8a9a9c;
  font-size: 25rpx;
}
.nearby {
  display: flex;
  align-items: center;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
}
.nearby-icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: #eefafa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 24rpx;
}
.nearby-main {
  flex: 1;
}
.nearby-name {
  font-size: 31rpx;
  font-weight: 600;
}
.nearby-meta {
  margin-top: 6rpx;
  color: #a4b0b2;
  font-size: 23rpx;
}
.nearby-cta {
  color: #12bfc1;
  font-size: 28rpx;
}
.tips {
  margin-top: 32rpx;
  padding: 28rpx 30rpx;
}
.tips-title {
  font-size: 29rpx;
  font-weight: 600;
  margin-bottom: 14rpx;
}
.tips-item {
  color: #6b7a7c;
  font-size: 25rpx;
  margin-top: 8rpx;
}
.tips-link {
  margin-top: 18rpx;
  color: #12bfc1;
  font-size: 25rpx;
}
</style>
