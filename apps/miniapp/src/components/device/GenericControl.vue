<script setup lang="ts">
/** 未知能力降级控件：按 CapabilityDef.type 提供最小可用交互，绝不白屏 */
import { computed, ref, watch } from 'vue';
import type { CapabilityDef } from '@smart-home/shared';

const props = defineProps<{
  cap: CapabilityDef;
  value: unknown;
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [unknown] }>();

const text = ref('');
watch(
  () => props.value,
  (v) => {
    text.value = v == null ? '' : String(v);
  },
  { immediate: true },
);

const typeName = computed(() => props.cap.type ?? 'string');
const isReadonly = computed(() => !!props.cap.readonly);

const num = ref(Number(props.value) || 0);
watch(
  () => props.value,
  (v) => {
    num.value = Number(v) || 0;
  },
);

function onNumChange(e: any) {
  num.value = e.detail.value;
}
function commitNum() {
  if (props.disabled || isReadonly.value) return;
  emit('change', num.value);
}
function pick(v: string | boolean) {
  if (props.disabled || isReadonly.value) return;
  emit('change', v);
}
function commitText() {
  if (props.disabled || isReadonly.value) return;
  emit('change', text.value);
}
</script>

<template>
  <view class="generic">
    <view class="g-head row-between">
      <text class="g-label">{{ cap.label ?? cap.key }}</text>
      <text class="g-tag">通用控件</text>
    </view>

    <view v-if="isReadonly" class="g-readonly">当前值：{{ value ?? '--' }}{{ cap.unit ?? '' }}</view>

    <template v-else>
      <!-- number -->
      <view v-if="typeName === 'number'">
        <slider
          :value="num"
          :min="cap.min ?? 0"
          :max="cap.max ?? 100"
          :step="cap.step ?? 1"
          :disabled="disabled"
          activeColor="#12BFC1"
          backgroundColor="#E8EFF0"
          block-size="26"
          @changing="onNumChange"
          @change="onNumChange"
        />
        <view class="g-foot row-between">
          <text class="g-range">{{ cap.min ?? 0 }}{{ cap.unit ?? '' }} – {{ cap.max ?? 100 }}{{ cap.unit ?? '' }}</text>
          <view class="g-send" :class="{ disabled }" @click="commitNum">发送 {{ num }}{{ cap.unit ?? '' }}</view>
        </view>
      </view>

      <!-- enum -->
      <view v-else-if="typeName === 'enum'" class="g-chips">
        <view
          v-for="v in cap.values ?? []"
          :key="v"
          class="g-chip"
          :class="{ active: value === v, disabled }"
          @click="pick(v)"
        >
          {{ v }}
        </view>
      </view>

      <!-- boolean -->
      <view v-else-if="typeName === 'boolean'" class="g-chips">
        <view class="g-chip" :class="{ active: value === true, disabled }" @click="pick(true)">开</view>
        <view class="g-chip" :class="{ active: value === false, disabled }" @click="pick(false)">关</view>
      </view>

      <!-- string -->
      <view v-else class="g-text">
        <input class="g-input" v-model="text" :disabled="disabled" placeholder="输入值" />
        <view class="g-send" :class="{ disabled }" @click="commitText">发送</view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.generic {
  background: #f7fafa;
  border: 2rpx dashed #cfe3e4;
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  margin-top: 20rpx;
}
.g-label {
  font-size: 27rpx;
  font-weight: 600;
  color: #1d2526;
}
.g-tag {
  font-size: 20rpx;
  color: #a4b0b2;
  background: #eef2f3;
  border-radius: 999rpx;
  padding: 4rpx 14rpx;
}
.g-readonly {
  margin-top: 14rpx;
  font-size: 32rpx;
  color: #45585a;
}
.g-foot {
  margin-top: 8rpx;
}
.g-range {
  color: #a4b0b2;
  font-size: 22rpx;
}
.g-send {
  background: #12bfc1;
  color: #fff;
  font-size: 24rpx;
  padding: 12rpx 30rpx;
  border-radius: 999rpx;
  &.disabled {
    opacity: 0.5;
  }
}
.g-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 14rpx;
}
.g-chip {
  padding: 14rpx 34rpx;
  background: #fff;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: #6b7a7c;
  &.active {
    background: #12bfc1;
    color: #fff;
  }
  &.disabled {
    opacity: 0.5;
  }
}
.g-text {
  display: flex;
  gap: 16rpx;
  margin-top: 14rpx;
  align-items: center;
}
.g-input {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
}
</style>
