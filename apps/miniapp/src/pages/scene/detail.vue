<script setup lang="ts">
/**
 * 场景详情（P1）：动作列表 · 执行 · 逐项状态轮询
 */
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { useSceneStore } from '@/core/stores/scene';
import type { SceneDto, SceneRunDto } from '@smart-home/shared';
import { errorToast, toast } from '@/platform/toast';

const scenes = useSceneStore();
const id = ref('');
const booting = ref(true);
const deleting = ref(false);

onLoad((q) => {
  id.value = q?.id ?? '';
});

onShow(async () => {
  if (!id.value) return;
  booting.value = true;
  try {
    await scenes.detail(id.value);
    const runs = await getRuns();
    if (runs?.[0]) scenes.runs[id.value] = runs[0];
  } catch (e: any) {
    errorToast(e?.message ?? '加载失败');
  } finally {
    booting.value = false;
  }
});

async function getRuns() {
  try {
    const { http } = await import('@/platform/request');
    return await http.get<SceneRunDto[]>(`/scenes/${id.value}/runs`);
  } catch {
    return null;
  }
}

const scene = computed<SceneDto | null>(() => scenes.byId(id.value));
const run = computed<SceneRunDto | null>(() => scenes.runs[id.value] ?? null);
const isRunning = computed(() => scenes.runningIds.includes(id.value));

const STATUS_TEXT: Record<string, string> = {
  queued: '排队中',
  running: '执行中',
  success: '全部成功',
  partial: '部分成功',
  failed: '执行失败',
  cancelled: '已取消',
  timeout: '超时',
  pending: '等待',
  skipped: '跳过',
};

const ACTION_ICON: Record<string, string> = {
  pending: '○',
  running: '◔',
  success: '✓',
  failed: '✕',
  skipped: '−',
};

/** 逐项状态：run.actions 按 actionId 关联 scene.actions */
const actionRows = computed(() => {
  const s = scene.value;
  if (!s) return [];
  const runActions = run.value?.actions ?? [];
  return (s.actions ?? []).map((a) => {
    const ra = runActions.find((x) => x.actionId === a.id);
    return {
      id: a.id,
      deviceName: a.deviceName ?? '设备',
      command: a.command,
      params: JSON.stringify(a.params ?? {}),
      delayMs: a.delayMs,
      status: ra?.status ?? (run.value ? 'pending' : 'idle'),
      message: ra?.message,
    };
  });
});

async function runScene() {
  try {
    await scenes.run(id.value);
    toast('开始执行…');
  } catch (e: any) {
    errorToast(e?.message ?? '执行失败');
  }
}

function removeScene() {
  uni.showModal({
    title: '删除场景',
    content: '删除后不可恢复，确定删除？',
    confirmColor: '#F5564E',
    success: async (res) => {
      if (!res.confirm) return;
      deleting.value = true;
      try {
        await scenes.remove(id.value);
        uni.navigateBack();
      } catch (e: any) {
        errorToast(e?.message ?? '删除失败');
      } finally {
        deleting.value = false;
      }
    },
  });
}
</script>

<template>
  <view class="page sdetail">
    <view v-if="booting" class="loading">加载中…</view>

    <view v-else-if="!scene" class="card miss">场景不存在</view>

    <template v-else>
      <!-- 执行区 -->
      <view class="hero card">
        <view class="hero-emoji">✨</view>
        <view class="hero-name">{{ scene.name }}</view>
        <view class="hero-tags">
          <text class="chip" :class="(scene.triggers ?? []).every((t) => t.type === 'manual') ? '' : 'chip-primary'">
            {{ (scene.triggers ?? []).every((t) => t.type === 'manual') ? '手动执行' : '自动触发' }}
          </text>
          <text class="chip">{{ (scene.actions ?? []).length }} 个动作</text>
          <text class="chip" :class="scene.enabled ? 'chip-primary' : 'chip-danger'">
            {{ scene.enabled ? '已启用' : '已停用' }}
          </text>
        </view>
        <view class="run-btn" :class="{ disabled: isRunning || !scene.enabled }" @click="runScene">
          {{ isRunning ? '执行中…' : '执行场景' }}
        </view>
      </view>

      <!-- 执行进度：逐项状态 -->
      <view v-if="run" class="run card">
        <view class="run-head row-between">
          <text class="run-title">执行状态</text>
          <text
            class="chip"
            :class="run.status === 'success' ? 'chip-primary' : run.status === 'failed' ? 'chip-danger' : ''"
          >
            {{ STATUS_TEXT[run.status] ?? run.status }}
          </text>
        </view>
        <view v-for="row in actionRows" :key="row.id" class="run-row">
          <text
            class="run-icon"
            :class="row.status"
          >
            {{ ACTION_ICON[row.status] ?? '○' }}
          </text>
          <view class="run-main">
            <view class="run-device">{{ row.deviceName }}</view>
            <view class="run-cmd">{{ row.command }} {{ row.params }}</view>
            <view v-if="row.message" class="run-msg">{{ row.message }}</view>
          </view>
          <text class="run-state">{{ STATUS_TEXT[row.status] ?? row.status }}</text>
        </view>
      </view>

      <!-- 动作列表 -->
      <view class="actions card">
        <view class="sec-title">设备动作</view>
        <view v-if="!(scene.actions ?? []).length" class="empty-inline">暂无动作（可由管理员后台配置）</view>
        <view v-for="(a, i) in scene.actions ?? []" :key="a.id" class="action">
          <view class="action-idx">{{ i + 1 }}</view>
          <view class="action-main">
            <view class="action-name">{{ a.deviceName ?? '设备' }}</view>
            <view class="action-cmd">{{ a.command }} · {{ JSON.stringify(a.params) }}</view>
          </view>
          <view class="action-delay" v-if="a.delayMs">延迟 {{ a.delayMs }}ms</view>
        </view>
      </view>

      <!-- 触发条件 -->
      <view class="triggers card">
        <view class="sec-title">触发条件</view>
        <view v-for="t in scene.triggers ?? []" :key="t.id" class="trigger">
          <text class="chip chip-primary">{{ t.type }}</text>
          <text class="trigger-config">{{ JSON.stringify(t.config ?? {}) }}</text>
        </view>
        <view v-if="!(scene.triggers ?? []).length" class="empty-inline">无触发条件</view>
      </view>

      <view class="danger" @click="removeScene">{{ deleting ? '删除中…' : '删除场景' }}</view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.sdetail {
  padding: 24rpx 28rpx 60rpx;
}
.loading,
.miss {
  text-align: center;
  color: #a4b0b2;
  padding: 100rpx 0;
}
.hero {
  padding: 44rpx 32rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hero-emoji {
  font-size: 80rpx;
}
.hero-name {
  margin-top: 14rpx;
  font-size: 40rpx;
  font-weight: 700;
}
.hero-tags {
  display: flex;
  gap: 14rpx;
  margin-top: 20rpx;
  flex-wrap: wrap;
  justify-content: center;
}
.run-btn {
  margin-top: 36rpx;
  width: 100%;
  text-align: center;
  background: #12bfc1;
  color: #fff;
  border-radius: 999rpx;
  padding: 26rpx 0;
  font-size: 32rpx;
  font-weight: 600;
  box-shadow: 0 12rpx 30rpx rgba(18, 191, 193, 0.3);
  &.disabled {
    opacity: 0.55;
  }
}
.run {
  margin-top: 24rpx;
  padding: 28rpx 30rpx;
}
.run-title {
  font-size: 30rpx;
  font-weight: 600;
}
.run-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f2f7f8;
  &:last-child {
    border-bottom: none;
  }
}
.run-icon {
  width: 44rpx;
  text-align: center;
  font-size: 30rpx;
  color: #a4b0b2;
  &.success {
    color: #2fc18c;
  }
  &.failed {
    color: #f5564e;
  }
  &.running {
    color: #12bfc1;
  }
}
.run-main {
  flex: 1;
}
.run-device {
  font-size: 28rpx;
  font-weight: 600;
}
.run-cmd {
  font-size: 23rpx;
  color: #8a9a9c;
  margin-top: 4rpx;
}
.run-msg {
  font-size: 22rpx;
  color: #f5564e;
  margin-top: 4rpx;
}
.run-state {
  font-size: 23rpx;
  color: #8a9a9c;
}
.actions,
.triggers {
  margin-top: 24rpx;
  padding: 28rpx 30rpx;
}
.sec-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.action {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f2f7f8;
  &:last-child {
    border-bottom: none;
  }
}
.action-idx {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #eefafa;
  color: #12bfc1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  flex-shrink: 0;
}
.action-main {
  flex: 1;
}
.action-name {
  font-size: 29rpx;
  font-weight: 600;
}
.action-cmd {
  font-size: 23rpx;
  color: #8a9a9c;
  margin-top: 4rpx;
}
.action-delay {
  font-size: 22rpx;
  color: #a4b0b2;
}
.trigger {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
}
.trigger-config {
  color: #8a9a9c;
  font-size: 24rpx;
}
.danger {
  margin-top: 32rpx;
  text-align: center;
  color: #f5564e;
  font-size: 28rpx;
  padding: 24rpx 0;
}
</style>
