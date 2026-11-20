<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { api } from '../api';
import { hasPerm } from '../store/auth';
import type {
  AuditLogItem,
  CommandLogItem,
  Page,
  SceneRunItem,
  TelemetryItem,
} from '../types';

const tab = ref('commands');
const showAudit = hasPerm('audit:read');

interface PagedState<T> {
  loading: boolean;
  items: T[];
  pager: { page: number; pageSize: number; total: number };
}

function createState<T>(): PagedState<T> {
  return {
    loading: false,
    items: [],
    pager: { page: 1, pageSize: 20, total: 0 },
  };
}

const cmdState = createState<CommandLogItem>();
const telState = createState<TelemetryItem>();
const runState = createState<SceneRunItem>();
const auditState = createState<AuditLogItem>();

const cmdDeviceId = ref('');
const telDeviceId = ref('');
const auditAction = ref('');

async function fetchPaged<T>(
  state: PagedState<T>,
  fetcher: (params: Record<string, unknown>) => Promise<Page<T>>,
  extra: Record<string, unknown>,
) {
  state.loading = true;
  try {
    const data = await fetcher({
      ...extra,
      page: state.pager.page,
      pageSize: state.pager.pageSize,
    });
    state.items = data.items;
    state.pager.total = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载日志失败');
  } finally {
    state.loading = false;
  }
}

function loadCommands() {
  return fetchPaged(cmdState, api.commandLogs as any, {
    deviceId: cmdDeviceId.value.trim() || undefined,
  });
}
function loadTelemetry() {
  return fetchPaged(telState, api.telemetryLogs as any, {
    deviceId: telDeviceId.value.trim() || undefined,
  });
}
function loadRuns() {
  return fetchPaged(runState, api.sceneRunLogs as any, {});
}
function loadAudits() {
  return fetchPaged(auditState, api.auditLogs as any, {
    action: auditAction.value.trim() || undefined,
  });
}

function searchCommands() {
  cmdState.pager.page = 1;
  return loadCommands();
}
function searchTelemetry() {
  telState.pager.page = 1;
  return loadTelemetry();
}
function searchAudits() {
  auditState.pager.page = 1;
  return loadAudits();
}

function bindPager<T>(state: PagedState<T>, reload: () => Promise<void>) {
  return {
    onPage: (p: number) => {
      state.pager.page = p;
      return reload();
    },
    onSize: (s: number) => {
      state.pager.pageSize = s;
      state.pager.page = 1;
      return reload();
    },
  };
}

const cmdPager = bindPager(cmdState, loadCommands);
const telPager = bindPager(telState, loadTelemetry);
const runPager = bindPager(runState, loadRuns);
const auditPager = bindPager(auditState, loadAudits);

function fmtTime(iso?: string) {
  return iso ? new Date(iso).toLocaleString() : '-';
}

function pretty(value: unknown): string {
  if (value === undefined || value === null) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const statusType = (s: string) => {
  if (['acked', 'success'].includes(s)) return 'success';
  if (['failed', 'timeout', 'partial'].includes(s)) return 'danger';
  if (['pending', 'sent', 'running', 'queued'].includes(s)) return 'warning';
  return 'info';
};

function loadActive() {
  if (tab.value === 'commands') return loadCommands();
  if (tab.value === 'telemetry') return loadTelemetry();
  if (tab.value === 'runs') return loadRuns();
  if (tab.value === 'audit') return loadAudits();
}

watch(tab, loadActive);
onMounted(() => {
  loadCommands();
});
</script>

<template>
  <div class="page-card">
    <el-tabs v-model="tab">
      <!-- 命令日志 -->
      <el-tab-pane label="命令日志" name="commands">
        <div class="filter-bar">
          <el-input
            v-model="cmdDeviceId"
            placeholder="按 deviceId 筛选"
            clearable
            style="width: 260px"
            @keyup.enter="searchCommands"
            @clear="searchCommands"
          />
          <el-button type="primary" :icon="Search" @click="searchCommands">查询</el-button>
        </div>
        <el-table
          v-loading="cmdState.loading"
          :data="cmdState.items"
          border
          stripe
          size="small"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <pre class="json-preview expand-body">params: {{ pretty(row.params) }}</pre>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="cmdId" label="cmdId" width="240" show-overflow-tooltip />
          <el-table-column prop="deviceName" label="设备" width="140" show-overflow-tooltip />
          <el-table-column label="命令" min-width="160">
            <template #default="{ row }">
              {{ row.capability }} / {{ row.name }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="error" label="错误" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.error || '-' }}</template>
          </el-table-column>
          <el-table-column prop="source" label="来源" width="100" />
          <el-table-column prop="finishedAt" label="完成时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.finishedAt) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="cmdState.pager.page"
          v-model:page-size="cmdState.pager.pageSize"
          class="pager"
          :total="cmdState.pager.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="cmdPager.onPage"
          @size-change="cmdPager.onSize"
        />
      </el-tab-pane>

      <!-- 遥测日志 -->
      <el-tab-pane label="遥测日志" name="telemetry">
        <div class="filter-bar">
          <el-input
            v-model="telDeviceId"
            placeholder="按 deviceId 筛选"
            clearable
            style="width: 260px"
            @keyup.enter="searchTelemetry"
            @clear="searchTelemetry"
          />
          <el-button type="primary" :icon="Search" @click="searchTelemetry">查询</el-button>
        </div>
        <el-table
          v-loading="telState.loading"
          :data="telState.items"
          border
          stripe
          size="small"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <pre class="json-preview expand-body">{{ pretty(row.metrics) }}</pre>
            </template>
          </el-table-column>
          <el-table-column prop="ts" label="时间" width="180">
            <template #default="{ row }">{{ fmtTime(row.ts) }}</template>
          </el-table-column>
          <el-table-column prop="deviceName" label="设备" min-width="160" show-overflow-tooltip />
          <el-table-column prop="deviceId" label="deviceId" min-width="240" show-overflow-tooltip />
          <el-table-column label="metrics" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <code>{{ JSON.stringify(row.metrics) }}</code>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="telState.pager.page"
          v-model:page-size="telState.pager.pageSize"
          class="pager"
          :total="telState.pager.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="telPager.onPage"
          @size-change="telPager.onSize"
        />
      </el-tab-pane>

      <!-- 场景执行 -->
      <el-tab-pane label="场景执行" name="runs">
        <div class="filter-bar">
          <el-button type="primary" :icon="Search" @click="loadRuns">刷新</el-button>
        </div>
        <el-table v-loading="runState.loading" :data="runState.items" border stripe size="small">
          <el-table-column type="expand">
            <template #default="{ row }">
              <ul class="action-list">
                <li v-for="a in row.actions" :key="a.id">
                  <el-tag :type="statusType(a.status)" size="small">{{ a.status }}</el-tag>
                  <span class="action-id">{{ a.id }}</span>
                  <span v-if="a.message" class="muted">{{ a.message }}</span>
                </li>
                <li v-if="!row.actions.length" class="muted">无动作记录</li>
              </ul>
            </template>
          </el-table-column>
          <el-table-column prop="sceneName" label="场景" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="triggerType" label="触发" width="120" />
          <el-table-column prop="startedAt" label="开始时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.startedAt) }}</template>
          </el-table-column>
          <el-table-column prop="finishedAt" label="结束时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.finishedAt) }}</template>
          </el-table-column>
          <el-table-column label="动作数" width="90">
            <template #default="{ row }">{{ row.actions.length }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="runState.pager.page"
          v-model:page-size="runState.pager.pageSize"
          class="pager"
          :total="runState.pager.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="runPager.onPage"
          @size-change="runPager.onSize"
        />
      </el-tab-pane>

      <!-- 审计日志 -->
      <el-tab-pane v-if="showAudit" label="审计日志" name="audit">
        <div class="filter-bar">
          <el-input
            v-model="auditAction"
            placeholder="按 action 模糊筛选，如 device_model"
            clearable
            style="width: 300px"
            @keyup.enter="searchAudits"
            @clear="searchAudits"
          />
          <el-button type="primary" :icon="Search" @click="searchAudits">查询</el-button>
        </div>
        <el-table
          v-loading="auditState.loading"
          :data="auditState.items"
          border
          stripe
          size="small"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-body">
                <div class="audit-json">
                  <span class="muted">before：</span>
                  <pre class="json-preview">{{ pretty(row.before) }}</pre>
                </div>
                <div class="audit-json">
                  <span class="muted">after：</span>
                  <pre class="json-preview">{{ pretty(row.after) }}</pre>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="时间" width="170">
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作人" width="200" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.actorType }}<span v-if="row.actorId">:{{ row.actorId }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="action" label="action" min-width="180" show-overflow-tooltip />
          <el-table-column prop="resource" label="resource" width="140" />
          <el-table-column prop="resourceId" label="resourceId" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.resourceId || '-' }}</template>
          </el-table-column>
          <el-table-column prop="ip" label="IP" width="130">
            <template #default="{ row }">{{ row.ip || '-' }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="auditState.pager.page"
          v-model:page-size="auditState.pager.pageSize"
          class="pager"
          :total="auditState.pager.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="auditPager.onPage"
          @size-change="auditPager.onSize"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 14px;
  justify-content: flex-end;
}
.expand-body {
  padding: 10px 40px;
  background: #fafafa;
}
.action-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.action-list li {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 4px 0;
}
.action-id {
  font-family: Consolas, monospace;
  font-size: 12px;
  color: #606266;
}
.audit-json {
  margin-bottom: 8px;
}
.muted {
  color: #909399;
}
</style>
