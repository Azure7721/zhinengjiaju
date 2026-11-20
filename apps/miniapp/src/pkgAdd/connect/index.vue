<script setup lang="ts">
/**
 * 配网连接（P0）：创建配网会话 → 连接步骤+倒计时 → 绑定表单 → 首页出现
 */
import { computed, onUnmounted, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import { http } from '@/platform/request';
import { errorToast, successToast, toast } from '@/platform/toast';
import type { DeviceDto, ProvisioningSessionDto } from '@smart-home/shared';

const user = useUserStore();
const devices = useDeviceStore();

const serial = ref('');
const modelCode = ref('');
const modelName = ref('');

/** 阶段：connecting（步骤+倒计时） / form（绑定表单） / error */
const phase = ref<'connecting' | 'form' | 'error'>('connecting');
const step = ref(0); // 0 数据发送 / 1 联网 / 2 添加
const countdown = ref(18);
const errMsg = ref('');

const session = ref<ProvisioningSessionDto | null>(null);

// 绑定表单
const familyIndex = ref(0);
const homeIndex = ref(0);
const roomIndex = ref(0);
const deviceName = ref('');
const submitting = ref(false);

let timer: ReturnType<typeof setInterval> | null = null;

onLoad((q) => {
  serial.value = q?.serial ?? '';
  modelCode.value = q?.modelCode ?? '';
  modelName.value = q?.modelName ?? '智能设备';
  deviceName.value = modelName.value;
  void boot();
});

onUnmounted(() => stopTimer());

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** 创建会话 + 模拟连接步骤 */
async function boot() {
  phase.value = 'connecting';
  step.value = 0;
  countdown.value = 18;
  errMsg.value = '';
  try {
    await Promise.all([user.ensureData()]);
    session.value = await http.post<ProvisioningSessionDto>('/provisioning/sessions', {
      serial: serial.value,
      familyId: user.currentFamilyId || undefined,
      modelCode: modelCode.value || undefined,
    });
    step.value = 1; // 数据发送完成
    startCountdown();
    setTimeout(() => {
      if (phase.value === 'connecting') step.value = 2; // 联网完成，等待绑定
    }, 1600);
    setTimeout(() => {
      if (phase.value === 'connecting') {
        phase.value = 'form';
        stopTimer();
      }
    }, 2800);
  } catch (e: any) {
    errMsg.value = mapError(e);
    phase.value = 'error';
  }
}

function startCountdown() {
  stopTimer();
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      stopTimer();
      errMsg.value = '连接超时，请确认设备在配网模式并靠近手机';
      phase.value = 'error';
    }
  }, 1000);
}

function mapError(e: any): string {
  const code = e?.code ?? '';
  const map: Record<string, string> = {
    CONFLICT: '设备已被绑定，请先在原家庭解绑',
    PROVISION_EXPIRED: '配网会话已过期，请重新连接',
    PROVISION_TOKEN_INVALID: '配网令牌无效，请重试',
    FAMILY_NOT_FOUND: '还没有家庭，请先创建家庭',
    NETWORK_ERROR: '网络异常，请检查服务端连接',
  };
  return map[code] ?? e?.message ?? '连接失败，请重试';
}

/** 绑定 */
async function bind() {
  if (!session.value || submitting.value) return;
  const home = user.homes[homeIndex.value];
  const room = user.rooms[roomIndex.value];
  submitting.value = true;
  try {
    const device = await http.post<DeviceDto>(`/provisioning/sessions/${session.value.id}/bind`, {
      token: session.value.token,
      homeId: home?.id,
      roomId: room?.id,
      name: deviceName.value.trim() || modelName.value,
      modelCode: modelCode.value || undefined,
    });
    step.value = 3;
    successToast('设备已添加');
    await devices.reload();
    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' });
      void device;
    }, 800);
  } catch (e: any) {
    errMsg.value = mapError(e);
    phase.value = 'error';
    errorToast(errMsg.value);
  } finally {
    submitting.value = false;
  }
}

const homeOptions = computed(() =>
  user.homes.map((h) => h.name),
);
const roomOptions = computed(() => user.rooms.map((r) => r.name));
const familyName = computed(() => user.currentFamily?.name ?? '—');

function cancel() {
  stopTimer();
  uni.navigateBack();
}
</script>

<template>
  <view class="page connect">
    <!-- 连接中：步骤 + 倒计时 -->
    <template v-if="phase === 'connecting'">
      <view class="count card">
        <view class="count-ring">
          <view class="count-num">{{ countdown }}</view>
          <view class="count-unit">秒</view>
        </view>
        <view class="count-title">正在连接设备</view>
        <view class="count-sub">{{ modelName }} · {{ serial }}</view>
      </view>

      <view class="steps card">
        <view v-for="(s, i) in ['数据发送', '设备联网', '绑定添加']" :key="s" class="step">
          <view class="step-dot" :class="{ done: step > i, active: step === i }">
            <text v-if="step > i">✓</text>
            <text v-else class="step-idx">{{ i + 1 }}</text>
          </view>
          <view class="step-text">
            <view class="step-name">{{ s }}</view>
            <view class="step-state">
              {{ step > i ? '已完成' : step === i ? '进行中…' : '等待中' }}
            </view>
          </view>
        </view>
      </view>

      <view class="cancel" @click="cancel">取消</view>
    </template>

    <!-- 绑定表单 -->
    <template v-else-if="phase === 'form'">
      <view class="form card">
        <view class="form-title">绑定设备</view>
        <view class="form-sub">{{ modelName }} · {{ serial }}</view>

        <view class="f-label">家庭</view>
        <view class="f-picker">{{ familyName }}</view>

        <view class="f-label">住宅</view>
        <picker :range="homeOptions" :value="homeIndex" @change="(e: any) => (homeIndex = Number(e.detail.value))">
          <view class="f-picker">{{ homeOptions[homeIndex] ?? '选择住宅' }}</view>
        </picker>

        <view class="f-label">房间</view>
        <picker :range="roomOptions" :value="roomIndex" @change="(e: any) => (roomIndex = Number(e.detail.value))">
          <view class="f-picker">{{ roomOptions[roomIndex] ?? '选择房间（可选）' }}</view>
        </picker>

        <view class="f-label">设备名称</view>
        <input class="f-input" v-model="deviceName" maxlength="20" placeholder="输入设备名称" />

        <view class="f-submit" :class="{ disabled: submitting }" @click="bind">
          {{ submitting ? '绑定中…' : '完成绑定' }}
        </view>
      </view>
    </template>

    <!-- 错误引导 -->
    <template v-else>
      <view class="err card">
        <view class="err-icon">⚠️</view>
        <view class="err-msg">{{ errMsg }}</view>
        <view class="err-actions">
          <view class="err-btn primary" @click="boot">重新连接</view>
          <view class="err-btn" @click="cancel">返回</view>
        </view>
      </view>
      <view class="err-tips card">
        <view class="tips-title">排查建议</view>
        <view class="tips-item">· 确认设备指示灯进入慢闪（配网模式）</view>
        <view class="tips-item">· 手机与设备保持 1 米内</view>
        <view class="tips-item">· 已绑定设备需先在原家庭解绑</view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.connect {
  padding: 24rpx 28rpx 60rpx;
}
.count {
  padding: 56rpx 32rpx 44rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.count-ring {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  border: 10rpx solid #e5f7f7;
  border-top-color: #12bfc1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: spin 1.2s linear infinite;
}
.count-num {
  font-size: 72rpx;
  font-weight: 300;
  color: #12bfc1;
  animation: spin-rev 1.2s linear infinite;
}
.count-unit {
  font-size: 24rpx;
  color: #8a9a9c;
  animation: spin-rev 1.2s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes spin-rev {
  to {
    transform: rotate(-360deg);
  }
}
.count-title {
  margin-top: 32rpx;
  font-size: 34rpx;
  font-weight: 600;
}
.count-sub {
  margin-top: 10rpx;
  color: #a4b0b2;
  font-size: 24rpx;
}
.steps {
  margin-top: 28rpx;
  padding: 32rpx 34rpx;
}
.step {
  display: flex;
  gap: 24rpx;
  align-items: center;
  padding: 18rpx 0;
}
.step-dot {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f2f7f8;
  color: #a4b0b2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  flex-shrink: 0;
  &.done {
    background: #12bfc1;
    color: #fff;
  }
  &.active {
    background: #d8f4f4;
    color: #12bfc1;
    box-shadow: 0 0 0 8rpx rgba(18, 191, 193, 0.15);
  }
}
.step-idx {
  font-size: 28rpx;
}
.step-name {
  font-size: 30rpx;
  font-weight: 600;
}
.step-state {
  font-size: 23rpx;
  color: #a4b0b2;
  margin-top: 4rpx;
}
.cancel {
  margin-top: 40rpx;
  text-align: center;
  color: #8a9a9c;
  font-size: 29rpx;
  padding: 20rpx 0;
}
.form {
  padding: 36rpx 34rpx;
}
.form-title {
  font-size: 36rpx;
  font-weight: 700;
}
.form-sub {
  color: #a4b0b2;
  font-size: 24rpx;
  margin-top: 8rpx;
}
.f-label {
  font-size: 25rpx;
  color: #a4b0b2;
  margin: 28rpx 0 12rpx;
}
.f-picker,
.f-input {
  background: #f2f7f8;
  border-radius: 16rpx;
  padding: 22rpx 26rpx;
  font-size: 29rpx;
}
.f-submit {
  margin-top: 44rpx;
  background: #12bfc1;
  color: #fff;
  text-align: center;
  border-radius: 999rpx;
  padding: 26rpx 0;
  font-size: 31rpx;
  font-weight: 600;
  box-shadow: 0 12rpx 30rpx rgba(18, 191, 193, 0.3);
  &.disabled {
    opacity: 0.55;
  }
}
.err {
  padding: 56rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.err-icon {
  font-size: 80rpx;
}
.err-msg {
  margin-top: 24rpx;
  color: #f5564e;
  font-size: 28rpx;
  text-align: center;
}
.err-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 40rpx;
}
.err-btn {
  padding: 20rpx 56rpx;
  border-radius: 999rpx;
  background: #f2f7f8;
  color: #45585a;
  font-size: 28rpx;
  &.primary {
    background: #12bfc1;
    color: #fff;
  }
}
.err-tips {
  margin-top: 28rpx;
  padding: 28rpx 32rpx;
}
.tips-title {
  font-weight: 600;
  font-size: 28rpx;
  margin-bottom: 12rpx;
}
.tips-item {
  color: #6b7a7c;
  font-size: 25rpx;
  margin-top: 8rpx;
}
</style>
