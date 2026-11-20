<script setup lang="ts">
/** 电视遥控：方向键 + OK + 常用键（remote 能力 → sendKey） */
const props = defineProps<{ disabled?: boolean; label?: string; value?: string }>();
const emit = defineEmits<{ change: [string] }>();

function press(key: string) {
  if (props.disabled) return;
  emit('change', key);
}
</script>

<template>
  <view class="remote">
    <view class="remote-label">{{ label ?? '遥控' }}</view>
    <view class="remote-pad">
      <view class="r-btn r-up" :class="{ disabled }" @click="press('up')">▲</view>
      <view class="r-btn r-left" :class="{ disabled }" @click="press('left')">◀</view>
      <view class="r-btn r-ok" :class="{ disabled }" @click="press('ok')">OK</view>
      <view class="r-btn r-right" :class="{ disabled }" @click="press('right')">▶</view>
      <view class="r-btn r-down" :class="{ disabled }" @click="press('down')">▼</view>
    </view>
    <view class="remote-extra">
      <view class="r-chip" :class="{ disabled }" @click="press('menu')">菜单</view>
      <view class="r-chip" :class="{ disabled }" @click="press('back')">返回</view>
      <view class="r-chip" :class="{ disabled }" @click="press('volumeUp')">音量＋</view>
      <view class="r-chip" :class="{ disabled }" @click="press('volumeDown')">音量−</view>
    </view>
    <view class="remote-hint" v-if="value">上次按键：{{ value }}</view>
  </view>
</template>

<style scoped lang="scss">
.remote {
  padding: 12rpx 0;
}
.remote-label {
  font-size: 26rpx;
  color: #6b7a7c;
  margin-bottom: 16rpx;
}
.remote-pad {
  position: relative;
  width: 360rpx;
  height: 360rpx;
  margin: 0 auto;
  background: #f6fafa;
  border-radius: 50%;
}
.r-btn {
  position: absolute;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4rpx 14rpx rgba(29, 37, 38, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  color: #45585a;
  &.disabled {
    opacity: 0.5;
  }
}
.r-up {
  top: 16rpx;
  left: 132rpx;
}
.r-down {
  bottom: 16rpx;
  left: 132rpx;
}
.r-left {
  left: 16rpx;
  top: 132rpx;
}
.r-right {
  right: 16rpx;
  top: 132rpx;
}
.r-ok {
  left: 132rpx;
  top: 132rpx;
  background: #12bfc1;
  color: #fff;
  font-weight: 600;
}
.remote-extra {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  margin-top: 24rpx;
  flex-wrap: wrap;
}
.r-chip {
  padding: 14rpx 30rpx;
  background: #f2f7f8;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: #45585a;
  &.disabled {
    opacity: 0.5;
  }
}
.remote-hint {
  text-align: center;
  color: #a4b0b2;
  font-size: 22rpx;
  margin-top: 16rpx;
}
</style>
