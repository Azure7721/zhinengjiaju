<script setup lang="ts">
/**
 * 能耗（P1）：今天/本周/本月 · 简单条形图（无第三方图表库）· 设备排名 · 建议
 * 说明：遥测接口无能耗字段，此处按规则生成演示数据；接口结构已留 telemetry 聚合点。
 */
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useDeviceStore } from '@/core/stores/device';
import { underDev } from '@/components/feedback/UnderDev';

type Range = 'day' | 'week' | 'month';

const devices = useDeviceStore();
const range = ref<Range>('day');

onShow(() => void devices.load());

const RANGES: { key: Range; label: string }[] = [
  { key: 'day', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
];

/** 确定性伪随机（同一天数据稳定） */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const series = computed<{ bars: { label: string; value: number }[]; unit: string }>(() => {
  const base = devices.devices.length || 5;
  if (range.value === 'day') {
    // 12 段 × 2h
    const bars = Array.from({ length: 12 }, (_, i) => {
      const hour = i * 2;
      const peak = hour >= 18 && hour <= 22 ? 1.8 : hour >= 8 && hour <= 17 ? 1.1 : 0.5;
      return {
        label: `${hour}`,
        value: Math.round((0.25 + seeded(i + base) * 0.9) * peak * 100) / 100,
      };
    });
    return { bars, unit: 'kWh' };
  }
  if (range.value === 'week') {
    const days = ['一', '二', '三', '四', '五', '六', '日'];
    const bars = days.map((label, i) => ({
      label,
      value: Math.round((1.6 + seeded(i * 3 + base) * 2.4) * 100) / 100,
    }));
    return { bars, unit: 'kWh' };
  }
  const bars = Array.from({ length: 30 }, (_, i) => ({
    label: String(i + 1),
    value: Math.round((1.4 + seeded(i * 7 + base) * 2.8) * 100) / 100,
  }));
  return { bars, unit: 'kWh' };
});

const total = computed(() => Math.round(series.value.bars.reduce((s, b) => s + b.value, 0) * 100) / 100);
const cost = computed(() => Math.round(total.value * 0.6 * 100) / 100);
const avg = computed(() => Math.round((total.value / series.value.bars.length) * 100) / 100);
const carbon = computed(() => Math.round(total.value * 0.556 * 100) / 100);
const maxVal = computed(() => Math.max(...series.value.bars.map((b) => b.value), 0.1));
const peakIndex = computed(() => series.value.bars.findIndex((b) => b.value === maxVal.value));

/** 设备排名（按品类基线功率 × 运行状态估算占比） */
const ranking = computed(() => {
  const CAT_POWER: Record<string, number> = {
    climate: 1200,
    tv: 150,
    cover: 30,
    purifier: 45,
    other: 20,
  };
  const rows = devices.devices.map((d) => {
    const cat = d.model?.category ?? 'other';
    const base = CAT_POWER[cat] ?? 40;
    const on = d.state?.state?.power === true ? 1 : 0.15;
    return { name: d.name, value: Math.round(base * on) };
  });
  rows.sort((a, b) => b.value - a.value);
  const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
  return rows.slice(0, 5).map((r) => ({ ...r, pct: Math.round((r.value / sum) * 100) }));
});

/** 规则化建议（不硬编码文案：按设备状态推导） */
const suggestion = computed(() => {
  const ac = devices.devices.find(
    (d) => d.model?.category === 'climate' && d.state?.state?.power === true,
  );
  const target = ac?.state?.state?.targetTemp as number | undefined;
  if (ac && typeof target === 'number' && target < 26) {
    return `「${ac.name}」当前设定 ${target}℃，调至 26℃ 可降低约 15% 制冷能耗`;
  }
  const tv = devices.devices.find((d) => d.model?.category === 'tv' && d.state?.state?.power === true);
  if (tv) return `「${tv.name}」仍在运行，离开时关闭可节省待机能耗`;
  return '当前运行设备较少，能耗处于低位，保持即可';
});
</script>

<template>
  <view class="page energy">
    <!-- 范围切换 -->
    <view class="range-tabs">
      <view
        v-for="r in RANGES"
        :key="r.key"
        class="rtab"
        :class="{ active: range === r.key }"
        @click="range = r.key"
      >
        {{ r.label }}
      </view>
    </view>

    <!-- 总览 -->
    <view class="overview card">
      <view class="ov-label">总用电量</view>
      <view class="ov-value">
        {{ total }}<text class="ov-unit">kWh</text>
      </view>
      <view class="ov-metrics">
        <view class="ov-item">
          <view class="ov-num">¥{{ cost }}</view>
          <view class="ov-key">电费估算</view>
        </view>
        <view class="ov-item">
          <view class="ov-num">{{ avg }}</view>
          <view class="ov-key">平均用电</view>
        </view>
        <view class="ov-item">
          <view class="ov-num">{{ carbon }}kg</view>
          <view class="ov-key">碳排放</view>
        </view>
      </view>
    </view>

    <!-- 条形图 -->
    <view class="chart card">
      <view class="chart-head row-between">
        <text class="chart-title">用电趋势</text>
        <text class="chart-peak" v-if="peakIndex >= 0">
          峰值 {{ series.bars[peakIndex].value }}{{ series.unit }}
        </text>
      </view>
      <view class="bars" :class="{ dense: series.bars.length > 12 }">
        <view v-for="(b, i) in series.bars" :key="i" class="bar-col">
          <view class="bar-wrap">
            <view
              class="bar"
              :class="{ peak: i === peakIndex }"
              :style="{ height: Math.max(6, (b.value / maxVal) * 160) + 'rpx' }"
            />
          </view>
          <view class="bar-label" v-if="series.bars.length <= 12 || i % 5 === 0">{{ b.label }}</view>
        </view>
      </view>
    </view>

    <!-- 设备排名 -->
    <view class="rank card">
      <view class="chart-title" style="margin-bottom: 20rpx">设备用电排名</view>
      <view v-if="!ranking.length" class="empty-inline">暂无设备数据</view>
      <view v-for="(r, i) in ranking" :key="r.name" class="rank-row">
        <view class="rank-idx" :class="{ top: i < 3 }">{{ i + 1 }}</view>
        <view class="rank-main">
          <view class="rank-name row-between">
            <text>{{ r.name }}</text>
            <text class="rank-pct">{{ r.pct }}%</text>
          </view>
          <view class="rank-track">
            <view class="rank-fill" :style="{ width: r.pct + '%' }" />
          </view>
        </view>
      </view>
    </view>

    <!-- 优化建议 -->
    <view class="tip card" @click="underDev('能耗优化详情')">
      <view class="tip-icon">💡</view>
      <view class="tip-text">
        <view class="tip-title">优化建议</view>
        <view class="tip-body">{{ suggestion }}</view>
      </view>
      <view class="tip-arrow">›</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.energy {
  padding: 24rpx 28rpx 60rpx;
}
.range-tabs {
  display: flex;
  background: #fff;
  border-radius: 999rpx;
  padding: 8rpx;
}
.rtab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 999rpx;
  font-size: 28rpx;
  color: #6b7a7c;
  &.active {
    background: #12bfc1;
    color: #fff;
    font-weight: 600;
  }
}
.overview {
  margin-top: 24rpx;
  padding: 36rpx 34rpx;
}
.ov-label {
  color: #8a9a9c;
  font-size: 25rpx;
}
.ov-value {
  font-size: 84rpx;
  font-weight: 300;
  color: #1d2526;
  line-height: 1.2;
  margin-top: 6rpx;
}
.ov-unit {
  font-size: 30rpx;
  color: #93a1a3;
  margin-left: 10rpx;
}
.ov-metrics {
  display: flex;
  margin-top: 28rpx;
}
.ov-item {
  flex: 1;
}
.ov-num {
  font-size: 34rpx;
  font-weight: 600;
  color: #12bfc1;
}
.ov-key {
  margin-top: 6rpx;
  color: #a4b0b2;
  font-size: 23rpx;
}
.chart {
  margin-top: 24rpx;
  padding: 30rpx 30rpx 24rpx;
}
.chart-head {
  margin-bottom: 24rpx;
}
.chart-title {
  font-size: 30rpx;
  font-weight: 600;
}
.chart-peak {
  font-size: 23rpx;
  color: #f5564e;
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
  &.dense {
    gap: 4rpx;
  }
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bar-wrap {
  height: 170rpx;
  display: flex;
  align-items: flex-end;
}
.bar {
  width: 100%;
  max-width: 36rpx;
  background: linear-gradient(180deg, #7bdedf, #12bfc1);
  border-radius: 999rpx;
  min-height: 6rpx;
  &.peak {
    background: linear-gradient(180deg, #ffb08a, #f5564e);
  }
}
.bar-label {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #a4b0b2;
}
.rank {
  margin-top: 24rpx;
  padding: 30rpx;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 14rpx 0;
}
.rank-idx {
  width: 48rpx;
  height: 48rpx;
  border-radius: 16rpx;
  background: #f2f7f8;
  color: #8a9a9c;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &.top {
    background: #12bfc1;
    color: #fff;
    font-weight: 600;
  }
}
.rank-main {
  flex: 1;
}
.rank-name {
  font-size: 27rpx;
  color: #1d2526;
}
.rank-pct {
  color: #12bfc1;
  font-weight: 600;
}
.rank-track {
  margin-top: 10rpx;
  height: 14rpx;
  background: #eef2f3;
  border-radius: 999rpx;
  overflow: hidden;
}
.rank-fill {
  height: 100%;
  background: linear-gradient(90deg, #12bfc1, #7bdedf);
  border-radius: 999rpx;
}
.tip {
  margin-top: 24rpx;
  padding: 30rpx 30rpx;
  display: flex;
  align-items: center;
  gap: 22rpx;
  background: linear-gradient(120deg, #fff9e8, #fffdf6);
}
.tip-icon {
  font-size: 48rpx;
}
.tip-text {
  flex: 1;
}
.tip-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1d2526;
}
.tip-body {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7a7c;
}
.tip-arrow {
  color: #c0cbcc;
  font-size: 36rpx;
}
</style>
