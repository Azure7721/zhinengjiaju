<script setup lang="ts">
/**
 * 消息列表（P2）：告警 / 场景完成 / 设备事件；支持标记已读
 */
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { http } from '@/platform/request';
import type { NotificationDto, Paginated } from '@/core/types';
import Empty from '@/components/common/Empty.vue';
import { errorToast, toast } from '@/platform/toast';

const list = ref<NotificationDto[]>([]);
const loading = ref(false);

onShow(() => void load());

async function load() {
  loading.value = true;
  try {
    const data = await http.get<Paginated<NotificationDto>>('/notifications?page=1&pageSize=50');
    list.value = data.items ?? [];
  } catch (e: any) {
    errorToast(e?.message ?? '加载失败');
  } finally {
    loading.value = false;
  }
}

async function markAllRead() {
  try {
    await http.post('/notifications/read', {});
    list.value = list.value.map((n) => ({ ...n, read: true }));
    toast('已全部标记已读', 'success');
  } catch (e: any) {
    errorToast(e?.message ?? '操作失败');
  }
}

async function markRead(item: NotificationDto) {
  if (item.read) return;
  item.read = true;
  try {
    await http.post('/notifications/read', { ids: [item.id] });
  } catch {
    /* 本地已更新，忽略 */
  }
}

function typeIcon(type: string): string {
  const map: Record<string, string> = {
    device: '📱',
    scene: '✨',
    alert: '⚠️',
    system: '🔔',
  };
  return map[type] ?? '🔔';
}

function timeOf(iso: string): string {
  return iso.replace('T', ' ').slice(5, 16);
}
</script>

<template>
  <view class="page noti">
    <view class="bar row-between">
      <text class="bar-count">{{ list.length }} 条消息</text>
      <text class="bar-read" @click="markAllRead">全部已读</text>
    </view>

    <view v-if="loading && !list.length" class="loading">加载中…</view>
    <Empty v-else-if="!list.length" text="暂无消息" />

    <view
      v-for="n in list"
      :key="n.id"
      class="noti-item card"
      :class="{ unread: !n.read }"
      @click="markRead(n)"
    >
      <view class="noti-icon">{{ typeIcon(n.type) }}</view>
      <view class="noti-main">
        <view class="noti-title">
          {{ n.title }}
          <text v-if="!n.read" class="dot" />
        </view>
        <view class="noti-body">{{ n.body }}</view>
        <view class="noti-time">{{ timeOf(n.createdAt) }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.noti {
  padding: 24rpx 28rpx 60rpx;
}
.bar {
  margin-bottom: 20rpx;
}
.bar-count {
  color: #8a9a9c;
  font-size: 25rpx;
}
.bar-read {
  color: #12bfc1;
  font-size: 26rpx;
}
.loading {
  text-align: center;
  color: #a4b0b2;
  padding: 100rpx 0;
}
.noti-item {
  display: flex;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
  border-left: 6rpx solid transparent;
  &.unread {
    border-left-color: #12bfc1;
  }
}
.noti-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  background: #eefafa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  margin-right: 22rpx;
  flex-shrink: 0;
}
.noti-main {
  flex: 1;
  min-width: 0;
}
.noti-title {
  font-size: 29rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #f5564e;
}
.noti-body {
  margin-top: 8rpx;
  color: #6b7a7c;
  font-size: 25rpx;
}
.noti-time {
  margin-top: 10rpx;
  color: #c0cbcc;
  font-size: 22rpx;
}
</style>
