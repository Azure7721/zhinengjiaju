<script setup lang="ts">
/**
 * 场景列表（P1）：chips 筛选 · 执行按钮 · 创建入口
 */
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSceneStore } from '@/core/stores/scene';
import { useUserStore } from '@/core/stores/user';
import Empty from '@/components/common/Empty.vue';
import Sheet from '@/components/common/Sheet.vue';
import { errorToast, successToast, toast } from '@/platform/toast';

const scenes = useSceneStore();
const user = useUserStore();

const filter = ref<'all' | 'auto' | 'manual'>('all');
const createShow = ref(false);
const newName = ref('');
const creating = ref(false);

onShow(async () => {
  if (!user.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  await Promise.all([scenes.load(), user.ensureData()]);
});

const filtered = computed(() => {
  const list = scenes.scenes;
  if (filter.value === 'all') return list;
  const manual = list.filter((s) => (s.triggers ?? []).every((t) => t.type === 'manual'));
  if (filter.value === 'manual') return manual;
  return list.filter((s) => !(s.triggers ?? []).every((t) => t.type === 'manual'));
});

const CHIPS = [
  { key: 'all', label: '全部' },
  { key: 'auto', label: '自动' },
  { key: 'manual', label: '手动' },
] as const;

const EMOJIS = ['🎬', '🛋️', '🌤', '🌙', '🧹', '☕'];

function emojiOf(name: string, idx: number): string {
  if (name.includes('观影')) return '🎬';
  if (name.includes('舒适') || name.includes('宜人')) return '🌤';
  if (name.includes('清洁')) return '🧹';
  if (name.includes('晚安') || name.includes('睡眠')) return '🌙';
  return EMOJIS[idx % EMOJIS.length];
}

function isManual(s: { triggers?: { type: string }[] }): boolean {
  return (s.triggers ?? []).every((t) => t.type === 'manual');
}

async function runScene(id: string, name: string) {
  try {
    await scenes.run(id);
    toast(`「${name}」执行中…`);
  } catch (e: any) {
    errorToast(e?.message ?? '执行失败');
  }
}

function openDetail(id: string) {
  uni.navigateTo({ url: `/pages/scene/detail?id=${id}` });
}

async function createScene() {
  const name = newName.value.trim();
  if (!name) return;
  const home = user.homes[0];
  if (!home) {
    errorToast('还没有住宅，请先登录初始化');
    return;
  }
  creating.value = true;
  try {
    await scenes.create({ homeId: home.id, name });
    createShow.value = false;
    newName.value = '';
    successToast('已创建');
    await scenes.load(true);
  } catch (e: any) {
    errorToast(e?.message ?? '创建失败');
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <view class="page scene-page">
    <view class="head row-between">
      <view class="head-title">场景</view>
      <view class="head-add" @click="createShow = true">＋ 创建</view>
    </view>

    <!-- chips -->
    <view class="chips">
      <view
        v-for="c in CHIPS"
        :key="c.key"
        class="fchip"
        :class="{ active: filter === c.key }"
        @click="filter = c.key"
      >
        {{ c.label }}
      </view>
    </view>

    <view v-if="scenes.loading && !scenes.scenes.length" class="loading">加载中…</view>

    <Empty
      v-else-if="!filtered.length"
      text="还没有场景，创建一个一键联动吧"
      action-text="创建场景"
      @action="createShow = true"
    />

    <view v-for="(s, i) in filtered" :key="s.id" class="scard card" @click="openDetail(s.id)">
      <view class="scard-cover">{{ emojiOf(s.name, i) }}</view>
      <view class="scard-main">
        <view class="scard-name">{{ s.name }}</view>
        <view class="scard-meta">
          <text class="chip" :class="isManual(s) ? '' : 'chip-primary'">
            {{ isManual(s) ? '手动执行' : '自动触发' }}
          </text>
          <text class="scard-actions">{{ (s.actions ?? []).length }} 个动作</text>
          <text v-if="!s.enabled" class="chip chip-danger">已停用</text>
        </view>
        <view class="scard-progress" v-if="scenes.runs[s.id] && scenes.runningIds.includes(s.id)">
          执行中 · {{ scenes.runs[s.id].status }}…
        </view>
        <view
          class="scard-progress done"
          v-else-if="scenes.runs[s.id] && ['success', 'partial'].includes(scenes.runs[s.id].status)"
        >
          上次执行：{{ scenes.runs[s.id].status === 'success' ? '全部成功' : '部分成功' }}
        </view>
      </view>
      <view
        class="scard-run"
        :class="{ running: scenes.runningIds.includes(s.id) }"
        @click.stop="runScene(s.id, s.name)"
      >
        {{ scenes.runningIds.includes(s.id) ? '执行中' : '执行' }}
      </view>
    </view>

    <!-- 创建弹层 -->
    <Sheet :show="createShow" title="创建场景" @close="createShow = false">
      <view class="create-form">
        <input class="create-input" v-model="newName" placeholder="场景名称，如：起床模式" maxlength="16" />
        <view class="create-tip">创建后为手动触发场景，可在详情中查看动作列表</view>
        <view class="create-btn" :class="{ disabled: creating || !newName.trim() }" @click="createScene">
          {{ creating ? '创建中…' : '创建' }}
        </view>
      </view>
    </Sheet>
  </view>
</template>

<style scoped lang="scss">
.scene-page {
  padding: 24rpx 28rpx 60rpx;
}
.head-title {
  font-size: 44rpx;
  font-weight: 700;
}
.head-add {
  color: #12bfc1;
  font-size: 28rpx;
  background: #eefafa;
  border-radius: 999rpx;
  padding: 12rpx 30rpx;
}
.chips {
  display: flex;
  gap: 18rpx;
  margin-top: 28rpx;
}
.fchip {
  padding: 14rpx 40rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #6b7a7c;
  font-size: 27rpx;
  &.active {
    background: #12bfc1;
    color: #fff;
    font-weight: 600;
  }
}
.loading {
  text-align: center;
  color: #a4b0b2;
  padding: 100rpx 0;
}
.scard {
  display: flex;
  align-items: center;
  padding: 28rpx 26rpx;
  margin-top: 22rpx;
}
.scard-cover {
  width: 100rpx;
  height: 100rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #e5f8f8, #f2fbfb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  margin-right: 26rpx;
  flex-shrink: 0;
}
.scard-main {
  flex: 1;
  min-width: 0;
}
.scard-name {
  font-size: 32rpx;
  font-weight: 600;
}
.scard-meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}
.scard-actions {
  font-size: 23rpx;
  color: #a4b0b2;
}
.scard-progress {
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #12bfc1;
  &.done {
    color: #2fc18c;
  }
}
.scard-run {
  background: #12bfc1;
  color: #fff;
  border-radius: 999rpx;
  padding: 16rpx 40rpx;
  font-size: 27rpx;
  margin-left: 16rpx;
  flex-shrink: 0;
  &.running {
    background: #9adfdf;
  }
}
.create-form {
  padding-bottom: 24rpx;
}
.create-input {
  background: #f2f7f8;
  border-radius: 16rpx;
  padding: 24rpx 26rpx;
  font-size: 30rpx;
}
.create-tip {
  margin-top: 16rpx;
  color: #a4b0b2;
  font-size: 23rpx;
}
.create-btn {
  margin-top: 32rpx;
  background: #12bfc1;
  color: #fff;
  text-align: center;
  border-radius: 999rpx;
  padding: 24rpx 0;
  font-size: 30rpx;
  &.disabled {
    opacity: 0.5;
  }
}
</style>
