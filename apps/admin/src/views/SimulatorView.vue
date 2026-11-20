<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { api } from '../api';
import type { DeviceItem, DeviceModelItem } from '../types';

const loadingModels = ref(false);
const models = ref<DeviceModelItem[]>([]);
const createForm = reactive({ modelCode: '', name: '' });
const creating = ref(false);

const loadingDevices = ref(false);
const devices = ref<DeviceItem[]>([]);

const telemetryDialog = ref(false);
const sending = ref(false);
const currentDevice = ref<DeviceItem | null>(null);
const metricsText = ref('{"power": true, "temperature": 24.5}');

interface LogEntry {
  time: string;
  text: string;
  ok: boolean;
}
const logs = ref<LogEntry[]>([]);

function pushLog(text: string, ok = true) {
  logs.value.unshift({ time: new Date().toLocaleTimeString(), text, ok });
  if (logs.value.length > 50) logs.value.length = 50;
}

async function loadModels() {
  loadingModels.value = true;
  try {
    models.value = await api.deviceModels();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载型号失败');
  } finally {
    loadingModels.value = false;
  }
}

async function loadDevices() {
  loadingDevices.value = true;
  try {
    const data = await api.devices({ q: 'SIM', page: 1, pageSize: 50 });
    devices.value = data.items.filter((d) => d.source === 'sim');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载模拟设备失败');
  } finally {
    loadingDevices.value = false;
  }
}

async function createDevice() {
  if (!createForm.modelCode) {
    ElMessage.warning('请选择设备型号');
    return;
  }
  creating.value = true;
  try {
    const device = await api.simCreate(
      createForm.modelCode,
      createForm.name.trim() || undefined,
    );
    ElMessage.success(`虚拟设备已创建：${device.serialNo}`);
    pushLog(`创建虚拟设备 ${device.name}（${device.serialNo}）`, true);
    createForm.name = '';
    await loadDevices();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败';
    ElMessage.error(msg);
    pushLog(`创建失败：${msg}`, false);
  } finally {
    creating.value = false;
  }
}

function openTelemetry(device: DeviceItem) {
  currentDevice.value = device;
  metricsText.value = '{"power": true, "temperature": 24.5}';
  telemetryDialog.value = true;
}

async function sendTelemetry() {
  if (!currentDevice.value) return;
  let metrics: Record<string, unknown>;
  try {
    const parsed = JSON.parse(metricsText.value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      ElMessage.error('metrics 必须是 JSON 对象');
      return;
    }
    metrics = parsed as Record<string, unknown>;
  } catch (e) {
    ElMessage.error(`JSON 解析失败：${e instanceof Error ? e.message : e}`);
    return;
  }
  sending.value = true;
  try {
    await api.simTelemetry(currentDevice.value.id, metrics);
    ElMessage.success('遥测已发送');
    pushLog(`遥测 → ${currentDevice.value.name}: ${JSON.stringify(metrics)}`, true);
    telemetryDialog.value = false;
    await loadDevices();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '发送失败';
    ElMessage.error(msg);
    pushLog(`遥测失败：${msg}`, false);
  } finally {
    sending.value = false;
  }
}

async function disconnect(device: DeviceItem) {
  try {
    await api.simDisconnect(device.id);
    ElMessage.success(`${device.name} 已断连`);
    pushLog(`断连 → ${device.name}`, true);
    await loadDevices();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '操作失败';
    ElMessage.error(msg);
    pushLog(`断连失败：${msg}`, false);
  }
}

async function reconnect(device: DeviceItem) {
  try {
    await api.simReconnect(device.id);
    ElMessage.success(`${device.name} 已重连`);
    pushLog(`重连 → ${device.name}`, true);
    await loadDevices();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '操作失败';
    ElMessage.error(msg);
    pushLog(`重连失败：${msg}`, false);
  }
}

onMounted(() => {
  loadModels();
  loadDevices();
});
</script>

<template>
  <div class="sim-page">
    <div class="left-col">
      <el-card shadow="never" class="page-card">
        <template #header>创建虚拟设备</template>
        <el-form label-width="80px" @submit.prevent>
          <el-form-item label="型号" required>
            <el-select
              v-model="createForm.modelCode"
              placeholder="选择设备型号"
              style="width: 100%"
              :loading="loadingModels"
            >
              <el-option
                v-for="m in models"
                :key="m.id"
                :label="`${m.name}（${m.code}）`"
                :value="m.code"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="createForm.name" placeholder="选填，如 模拟-客厅灯" />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :icon="Plus"
              :loading="creating"
              @click="createDevice"
            >
              创建
            </el-button>
            <el-button :icon="Refresh" @click="loadDevices">刷新列表</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="never" class="page-card log-card">
        <template #header>操作结果</template>
        <div v-if="!logs.length" class="muted">暂无操作记录</div>
        <ul class="log-list">
          <li v-for="(l, i) in logs" :key="i">
            <span class="log-time">{{ l.time }}</span>
            <el-tag :type="l.ok ? 'success' : 'danger'" size="small">
              {{ l.ok ? 'OK' : 'FAIL' }}
            </el-tag>
            <span class="log-text">{{ l.text }}</span>
          </li>
        </ul>
      </el-card>
    </div>

    <el-card shadow="never" class="page-card devices-card">
      <template #header>
        <div class="devices-head">
          <span>模拟设备（source=sim）</span>
          <el-button link type="primary" :icon="Refresh" @click="loadDevices">
            刷新
          </el-button>
        </div>
      </template>
      <el-table
        v-loading="loadingDevices"
        :data="devices"
        border
        size="small"
        max-height="640"
      >
        <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="serialNo" label="Serial" width="220" show-overflow-tooltip />
        <el-table-column label="型号" min-width="130">
          <template #default="{ row }">{{ row.model?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="在线" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'success' : 'danger'" size="small">
              {{ row.online ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="绑定" min-width="140">
          <template #default="{ row }">
            <span v-if="row.boundTo">{{ row.boundTo.nickname }}</span>
            <span v-else class="muted">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openTelemetry(row as DeviceItem)">
              发遥测
            </el-button>
            <el-button link type="warning" size="small" @click="disconnect(row as DeviceItem)">
              断连
            </el-button>
            <el-button link type="success" size="small" @click="reconnect(row as DeviceItem)">
              重连
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!loadingDevices && !devices.length" class="empty muted">
        暂无模拟设备，先在左侧选择型号创建一台。
      </div>
    </el-card>

    <el-dialog
      v-model="telemetryDialog"
      :title="`发送遥测 · ${currentDevice?.name || ''}`"
      width="560px"
    >
      <el-form label-width="80px">
        <el-form-item label="metrics" required>
          <el-input
            v-model="metricsText"
            type="textarea"
            :rows="8"
            placeholder='{"power": true, "temperature": 24.5}'
          />
        </el-form-item>
      </el-form>
      <div class="muted">JSON 对象；保存前会 JSON.parse 校验，成功后写入遥测并推送在线状态。</div>
      <template #footer>
        <el-button @click="telemetryDialog = false">取消</el-button>
        <el-button type="primary" :loading="sending" @click="sendTelemetry">
          发送
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sim-page {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.left-col {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.devices-card {
  flex: 1;
  min-width: 0;
}
.devices-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.log-card {
  max-height: 320px;
  overflow-y: auto;
}
.log-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.log-list li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}
.log-time {
  color: #909399;
  font-family: Consolas, monospace;
  font-size: 12px;
}
.log-text {
  color: #303133;
  word-break: break-all;
}
.empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
}
.muted {
  color: #909399;
}
</style>
