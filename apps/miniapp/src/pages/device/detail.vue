<script setup lang="ts">
/**
 * 设备详情（P0）：头部 · 状态区 · 按 capabilities 动态控制 · 命令三态 · 更多功能弹层
 */
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import type { CapabilityDef, DeviceDto } from '@smart-home/shared';
import { useDeviceStore } from '@/core/stores/device';
import { useUserStore } from '@/core/stores/user';
import ControlHost from '@/components/device/ControlHost.vue';
import PowerSwitch from '@/components/device/PowerSwitch.vue';
import Sheet from '@/components/common/Sheet.vue';
import Empty from '@/components/common/Empty.vue';
import { toast, errorToast, vibrateShort } from '@/platform/toast';

const devices = useDeviceStore();
const user = useUserStore();

const id = ref('');
const notFound = ref(false);
const booting = ref(true);

// 更多功能弹层
const sheetShow = ref(false);
const renameText = ref('');
const roomIndex = ref(0);
const moving = ref(false);

onLoad((query) => {
  id.value = query?.id ?? '';
  void init();
});

onShow(() => {
  if (id.value && devices.byId(id.value)) void devices.load(true);
});

async function init() {
  booting.value = true;
  try {
    await Promise.all([devices.load(true), user.loadHomes(), devices.loadModels()]);
    notFound.value = !devices.byId(id.value);
  } catch {
    notFound.value = !devices.byId(id.value);
  } finally {
    booting.value = false;
  }
}

const device = computed<DeviceDto | null>(() => (id.value ? devices.byId(id.value) : null));
const caps = computed<CapabilityDef[]>(() => (device.value ? devices.capabilitiesOf(device.value) : []));
const switchCap = computed(() => caps.value.find((c) => c.key === 'switch' || c.key === 'power' || c.control === 'switch'));
const controlCaps = computed(() => caps.value.filter((c) => c !== switchCap.value));

const online = computed(() => device.value?.state?.online ?? false);
const power = computed(() => device.value?.state?.state?.power === true);

/** 状态区主数值：优先 currentTemp → pm25 → position → targetTemp → brightness */
const statusView = computed(() => {
  const s = device.value?.state?.state ?? {};
  const pick = (key: string, label: string, unit: string) =>
    typeof s[key] === 'number' ? { value: s[key] as number, label, unit, key } : null;
  return (
    pick('currentTemp', '当前温度', '℃') ??
    pick('pm25', 'PM2.5', 'μg/m³') ??
    pick('position', '开合度', '%') ??
    pick('targetTemp', '目标温度', '℃') ??
    pick('brightness', '亮度', '%') ??
    pick('fluxLevel', '通量等级', '') ??
    null
  );
});

const statusText = computed(() => {
  if (!device.value) return '';
  if (!online.value) return '设备离线';
  if (!power.value && switchCap.value) return '已关闭';
  return '运行中';
});

function valOf(cap: CapabilityDef): unknown {
  return device.value?.state?.state?.[cap.key];
}

async function onCommand(cap: CapabilityDef, value: unknown) {
  if (!device.value || cap.readonly) return;
  const ok = await devices.sendByCapability(device.value.id, cap.key, value);
  if (ok) {
    vibrateShort();
    toast('已发送', 'success');
  } else {
    const st = devices.getCmdState(device.value.id, cap.key);
    errorToast(st?.error ?? '控制失败');
  }
}

async function togglePower(v: boolean) {
  if (!device.value) return;
  const ok = await devices.sendByCapability(device.value.id, switchCap.value?.key ?? 'switch', v);
  if (ok) {
    vibrateShort();
    toast(`已${v ? '开启' : '关闭'}`, 'success');
  } else {
    errorToast(devices.getCmdState(device.value.id, switchCap.value?.key ?? 'switch')?.error ?? '控制失败');
  }
}

function retryCap(cap: CapabilityDef) {
  const st = devices.getCmdState(id.value, cap.key);
  st?.retry?.();
}

function openSheet() {
  if (!device.value) return;
  renameText.value = device.value.name;
  const rooms = user.rooms;
  roomIndex.value = Math.max(0, rooms.findIndex((r) => r.name === device.value?.roomName));
  sheetShow.value = true;
}

async function saveRename() {
  if (!device.value) return;
  const name = renameText.value.trim();
  if (!name) return;
  try {
    await devices.patchDevice(device.value.id, { name });
    sheetShow.value = false;
    toast('已保存', 'success');
  } catch (e: any) {
    errorToast(e?.message ?? '保存失败');
  }
}

async function moveRoom() {
  if (!device.value) return;
  const room = user.rooms[roomIndex.value];
  if (!room) return;
  moving.value = true;
  try {
    await devices.patchDevice(device.value.id, { roomId: room.id });
    sheetShow.value = false;
    toast(`已移动到${room.name}`, 'success');
  } catch (e: any) {
    errorToast(e?.message ?? '移动失败');
  } finally {
    moving.value = false;
  }
}

function confirmUnbind() {
  if (!device.value) return;
  uni.showModal({
    title: '解绑设备',
    content: `确定解绑「${device.value.name}」？解绑后需重新配网。`,
    confirmColor: '#F5564E',
    success: async (res) => {
      if (!res.confirm || !device.value) return;
      try {
        await devices.unbind(device.value.id);
        toast('已解绑', 'success');
        uni.navigateBack();
      } catch (e: any) {
        errorToast(e?.message ?? '解绑失败');
      }
    },
  });
}

function retryLoad() {
  notFound.value = false;
  void init();
}
</script>

<template>
  <view class="page detail">
    <view v-if="booting" class="loading">加载中…</view>

    <view v-else-if="notFound || !device" class="card miss">
      <Empty text="设备不存在或已解绑" action-text="重新加载" @action="retryLoad" />
    </view>

    <template v-else>
      <!-- 头部 -->
      <view class="head card">
        <view class="head-main">
          <view class="head-name">{{ device.name }}</view>
          <view class="head-chips">
            <text class="chip">{{ device.roomName || '未分配' }}</text>
            <text class="chip" :class="online ? 'chip-primary' : 'chip-danger'">
              {{ online ? '● 在线' : '○ 离线' }}
            </text>
            <text v-if="power && online" class="chip chip-primary">运行中</text>
          </view>
        </view>
        <PowerSwitch
          v-if="switchCap"
          variant="circle"
          :model-value="power"
          :disabled="!online"
          @toggle="togglePower"
        />
      </view>

      <!-- 状态区：大字 + 单位 -->
      <view class="status card">
        <template v-if="statusView">
          <view class="status-label">{{ statusView.label }}</view>
          <view class="status-value">
            {{ online ? statusView.value : '--' }}
            <text class="status-unit">{{ statusView.unit }}</text>
          </view>
        </template>
        <template v-else>
          <view class="status-label">设备状态</view>
          <view class="status-value small">{{ statusText }}</view>
        </template>
        <view class="status-foot">
          <text class="status-state" :class="{ off: !online || !power }">{{ statusText }}</text>
          <text class="status-time" v-if="device.state?.updatedAt">
            更新于 {{ device.state.updatedAt.replace('T', ' ').slice(5, 16) }}
          </text>
        </view>
      </view>

      <!-- 控制区：按 capabilities 动态渲染 -->
      <view class="controls card">
        <view class="controls-title">控制</view>

        <view v-if="!controlCaps.length && !switchCap" class="empty-inline">该设备无可控制能力</view>

        <view v-for="cap in controlCaps" :key="cap.key" class="cap-block">
          <view class="cap-head row-between">
            <text class="cap-name">{{ cap.label ?? cap.key }}</text>
            <text v-if="cap.readonly" class="chip">只读</text>
          </view>

          <ControlHost
            :cap="cap"
            :value="valOf(cap)"
            :disabled="!online || devices.getCmdState(device.id, cap.key)?.status === 'pending'"
            @change="(v: unknown) => onCommand(cap, v)"
          />

          <!-- 命令三态 -->
          <view
            v-if="devices.getCmdState(device.id, cap.key)?.status === 'pending'"
            class="cmd-state pending"
          >
            控制中…
          </view>
          <view
            v-else-if="devices.getCmdState(device.id, cap.key)?.status === 'failed'"
            class="cmd-state failed"
          >
            <text class="cmd-error">失败：{{ devices.getCmdState(device.id, cap.key)?.error }}</text>
            <view class="cmd-retry" @click="retryCap(cap)">重试</view>
          </view>
          <view
            v-else-if="devices.getCmdState(device.id, cap.key)?.status === 'success'"
            class="cmd-state success"
          >
            ✓ 已下发
          </view>
        </view>
      </view>

      <!-- 更多功能 -->
      <view class="more-btn" @click="openSheet">⚙ 更多功能</view>

      <!-- 底部弹层：改名 / 移房间 / 解绑 -->
      <Sheet :show="sheetShow" title="更多功能" @close="sheetShow = false">
        <view class="sheet-form">
          <view class="form-label">设备名称</view>
          <view class="form-row">
            <input class="form-input" v-model="renameText" placeholder="输入新名称" maxlength="20" />
            <view class="form-save" @click="saveRename">保存</view>
          </view>

          <view class="form-label">所在房间</view>
          <view class="form-row">
            <picker
              mode="selector"
              :range="user.rooms.map((r) => r.name)"
              :value="roomIndex"
              @change="(e: any) => (roomIndex = Number(e.detail.value))"
            >
              <view class="form-picker">{{ user.rooms[roomIndex]?.name ?? '选择房间' }}</view>
            </picker>
            <view class="form-save" :class="{ disabled: moving }" @click="moveRoom">
              {{ moving ? '移动中…' : '移动' }}
            </view>
          </view>

          <view class="form-label">解绑</view>
          <view class="form-danger" @click="confirmUnbind">解绑设备</view>
        </view>
      </Sheet>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail {
  padding: 24rpx 28rpx 60rpx;
}
.loading {
  text-align: center;
  color: #a4b0b2;
  padding: 120rpx 0;
}
.miss {
  padding: 20rpx;
}
.head {
  display: flex;
  align-items: center;
  padding: 32rpx 30rpx;
}
.head-main {
  flex: 1;
}
.head-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #1d2526;
}
.head-chips {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
}
.status {
  margin-top: 24rpx;
  padding: 36rpx 32rpx 28rpx;
  text-align: center;
}
.status-label {
  color: #93a1a3;
  font-size: 26rpx;
}
.status-value {
  font-size: 112rpx;
  font-weight: 200;
  color: #1d2526;
  line-height: 1.15;
  margin-top: 8rpx;
  &.small {
    font-size: 56rpx;
    font-weight: 400;
  }
}
.status-unit {
  font-size: 34rpx;
  color: #93a1a3;
  font-weight: 300;
}
.status-foot {
  margin-top: 18rpx;
  display: flex;
  justify-content: center;
  gap: 24rpx;
  align-items: center;
}
.status-state {
  color: #12bfc1;
  font-size: 26rpx;
  background: #eefafa;
  border-radius: 999rpx;
  padding: 6rpx 22rpx;
  &.off {
    color: #8a9a9c;
    background: #f2f7f8;
  }
}
.status-time {
  color: #c0cbcc;
  font-size: 22rpx;
}
.controls {
  margin-top: 24rpx;
  padding: 30rpx 30rpx 36rpx;
}
.controls-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.cap-block {
  padding-top: 16rpx;
}
.cap-head {
  margin-bottom: 8rpx;
}
.cap-name {
  font-size: 28rpx;
  color: #45585a;
  font-weight: 600;
}
.cmd-state {
  margin-top: 12rpx;
  font-size: 24rpx;
  border-radius: 14rpx;
  padding: 12rpx 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  &.pending {
    background: #f2f7f8;
    color: #8a9a9c;
  }
  &.failed {
    background: #ffeceb;
    color: #f5564e;
  }
  &.success {
    background: #e9f9f3;
    color: #2fc18c;
  }
}
.cmd-error {
  flex: 1;
}
.cmd-retry {
  background: #f5564e;
  color: #fff;
  border-radius: 999rpx;
  padding: 8rpx 28rpx;
  font-size: 24rpx;
}
.more-btn {
  margin-top: 32rpx;
  text-align: center;
  padding: 26rpx 0;
  background: #fff;
  border-radius: 999rpx;
  color: #45585a;
  font-size: 30rpx;
  box-shadow: 0 8rpx 32rpx rgba(29, 37, 38, 0.05);
}
.sheet-form {
  padding-bottom: 16rpx;
}
.form-label {
  font-size: 25rpx;
  color: #a4b0b2;
  margin: 24rpx 0 12rpx;
}
.form-row {
  display: flex;
  gap: 20rpx;
  align-items: center;
}
.form-input {
  flex: 1;
  background: #f2f7f8;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 29rpx;
}
.form-picker {
  flex: 1;
  background: #f2f7f8;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 29rpx;
  min-width: 320rpx;
}
.form-save {
  background: #12bfc1;
  color: #fff;
  border-radius: 999rpx;
  padding: 18rpx 40rpx;
  font-size: 27rpx;
  &.disabled {
    opacity: 0.5;
  }
}
.form-danger {
  text-align: center;
  background: #ffeceb;
  color: #f5564e;
  border-radius: 16rpx;
  padding: 24rpx 0;
  font-size: 29rpx;
}
</style>
