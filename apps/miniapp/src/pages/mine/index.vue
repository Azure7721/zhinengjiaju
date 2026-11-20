<script setup lang="ts">
/**
 * 我的（P1）：统计 · 家庭切换 · 服务入口（B 类 → underDev）
 */
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import { underDev } from '@/components/feedback/UnderDev';
import Sheet from '@/components/common/Sheet.vue';

const user = useUserStore();
const devices = useDeviceStore();

const memberCount = ref(0);
const familyShow = ref(false);

onShow(async () => {
  if (!user.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  await Promise.all([user.ensureData(), devices.load(), devices.loadModels()]);
  try {
    const fam = user.currentFamily;
    if (fam) {
      const members = await user.loadMembers(fam.id);
      memberCount.value = members.length;
    }
  } catch {
    memberCount.value = user.families.length;
  }
});

const stats = computed(() => [
  { num: devices.devices.length, label: '总设备' },
  { num: devices.running.length, label: '运行设备' },
  { num: memberCount.value || user.families.length, label: '家庭成员' },
  { num: devices.onlineCount, label: 'WiFi链接' },
]);

const quickEntries = [
  { icon: '📊', label: '电量统计', path: '/pkgEnergy/index/index' },
  { icon: '🏠', label: '我的家庭', path: '/pages/family/index' },
  { icon: '💗', label: '健康生活', dev: true },
  { icon: '🔧', label: '家电维修', dev: true },
];

const listEntries = [
  { icon: '🧾', label: '我的二维码', dev: true },
  { icon: '🛒', label: '我的商城', dev: true },
  { icon: '📦', label: '设备耗材', dev: true },
  { icon: '🔗', label: '连接三方平台', dev: true },
  { icon: '🔔', label: '消息通知', path: '/pages/notification/index' },
  { icon: '🗺', label: '全屋控制', path: '/pages/all-home/index' },
  { icon: '📶', label: 'WiFi / 网络管理', path: '/pages/wifi/index' },
  { icon: '⚙️', label: '设置', path: '/pages/settings/index' },
];

function go(entry: { path?: string; dev?: boolean; label: string }) {
  if (entry.dev) {
    underDev(entry.label);
    return;
  }
  if (entry.path) uni.navigateTo({ url: entry.path });
}

function switchFamily() {
  familyShow.value = true;
}

function pickFamily(id: string) {
  user.switchFamily(id);
  familyShow.value = false;
  void devices.reload();
}
</script>

<template>
  <view class="page mine">
    <!-- 用户信息 -->
    <view class="profile">
      <view class="avatar">{{ (user.user?.nickname ?? 'U').slice(0, 1).toUpperCase() }}</view>
      <view class="profile-main">
        <view class="profile-name">{{ user.user?.nickname ?? '未登录' }}</view>
        <view class="profile-sub" @click="switchFamily">
          {{ user.currentFamily?.name ?? '暂无家庭' }} · 切换 ›
        </view>
      </view>
    </view>

    <!-- 统计 -->
    <view class="stats card">
      <view v-for="s in stats" :key="s.label" class="stat">
        <view class="stat-num">{{ s.num }}</view>
        <view class="stat-label">{{ s.label }}</view>
      </view>
    </view>

    <!-- 会员卡（静态展示，B 类） -->
    <view class="vip" @click="underDev('超级会员')">
      <view class="vip-left">
        <view class="vip-title">👑 超级会员</view>
        <view class="vip-sub">2026-12-25 到期 ›</view>
      </view>
      <view class="vip-art">◆</view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick card">
      <view v-for="e in quickEntries" :key="e.label" class="quick-item" @click="go(e)">
        <view class="quick-icon">{{ e.icon }}</view>
        <view class="quick-label">{{ e.label }}</view>
      </view>
    </view>

    <!-- 列表入口 -->
    <view class="list card">
      <view v-for="e in listEntries" :key="e.label" class="list-row" @click="go(e)">
        <view class="list-icon">{{ e.icon }}</view>
        <view class="list-label">{{ e.label }}</view>
        <view class="list-arrow">›</view>
      </view>
    </view>

    <!-- 家庭切换弹层 -->
    <Sheet :show="familyShow" title="切换家庭" @close="familyShow = false">
      <view class="fam-list">
        <view
          v-for="f in user.families"
          :key="f.id"
          class="fam-item"
          :class="{ active: f.id === user.currentFamilyId }"
          @click="pickFamily(f.id)"
        >
          <view class="fam-name">{{ f.name }}</view>
          <view class="fam-role chip chip-primary">{{ f.role }}</view>
        </view>
        <view v-if="!user.families.length" class="empty-inline">暂无家庭</view>
      </view>
    </Sheet>
  </view>
</template>

<style scoped lang="scss">
.mine {
  padding: 40rpx 28rpx 60rpx;
}
.profile {
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 16rpx 8rpx;
}
.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #12bfc1, #7bdedf);
  color: #fff;
  font-size: 56rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-name {
  font-size: 42rpx;
  font-weight: 700;
}
.profile-sub {
  margin-top: 8rpx;
  color: #8a9a9c;
  font-size: 25rpx;
}
.stats {
  margin-top: 30rpx;
  display: flex;
  padding: 32rpx 12rpx;
}
.stat {
  flex: 1;
  text-align: center;
}
.stat-num {
  font-size: 44rpx;
  font-weight: 700;
  color: #12bfc1;
}
.stat-label {
  margin-top: 8rpx;
  color: #8a9a9c;
  font-size: 24rpx;
}
.vip {
  margin-top: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(120deg, #b9cfd1, #cfe0e1 55%, #dcebea);
  padding: 34rpx 34rpx;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.vip-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
}
.vip-sub {
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.85);
  font-size: 24rpx;
}
.vip-art {
  margin-left: auto;
  font-size: 72rpx;
  color: rgba(255, 255, 255, 0.5);
}
.quick {
  margin-top: 24rpx;
  display: flex;
  padding: 32rpx 12rpx;
}
.quick-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}
.quick-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #eefafa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
}
.quick-label {
  font-size: 25rpx;
  color: #45585a;
}
.list {
  margin-top: 24rpx;
  padding: 8rpx 0;
}
.list-row {
  display: flex;
  align-items: center;
  padding: 30rpx 30rpx;
  border-bottom: 2rpx solid #f4f8f8;
  &:last-child {
    border-bottom: none;
  }
}
.list-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  background: #eefafa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 24rpx;
}
.list-label {
  flex: 1;
  font-size: 29rpx;
  color: #1d2526;
}
.list-arrow {
  color: #c0cbcc;
  font-size: 36rpx;
}
.fam-list {
  padding-bottom: 24rpx;
}
.fam-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 26rpx;
  border-radius: 20rpx;
  background: #f7fafa;
  margin-bottom: 16rpx;
  &.active {
    background: #eefafa;
    outline: 3rpx solid #12bfc1;
  }
}
.fam-name {
  font-size: 30rpx;
  font-weight: 600;
}
</style>
