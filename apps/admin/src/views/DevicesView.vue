<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import { api } from '../api';
import { hasPerm } from '../store/auth';
import type { DeviceItem, DeviceModelItem } from '../types';

const canWrite = computed(() => hasPerm('device:write'));

const loading = ref(false);
const keyword = ref('');
const items = ref<DeviceItem[]>([]);
const pager = reactive({ page: 1, pageSize: 20, total: 0 });

// 导入对话框
const importVisible = ref(false);
const importing = ref(false);
const importForm = reactive({ modelId: '', serialsText: '' });
const models = ref<DeviceModelItem[]>([]);

async function load() {
  loading.value = true;
  try {
    const data = await api.devices({
      q: keyword.value.trim() || undefined,
      page: pager.page,
      pageSize: pager.pageSize,
    });
    items.value = data.items;
    pager.total = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载设备失败');
  } finally {
    loading.value = false;
  }
}

function search() {
  pager.page = 1;
  load();
}

function onPageChange(p: number) {
  pager.page = p;
  load();
}

function onSizeChange(s: number) {
  pager.pageSize = s;
  pager.page = 1;
  load();
}

async function unbind(row: DeviceItem) {
  try {
    await ElMessageBox.confirm(
      `确认解绑设备「${row.name}」（${row.serialNo}）？此操作会写入审计日志。`,
      '解绑确认',
      { type: 'warning', confirmButtonText: '继续' },
    );
  } catch {
    return;
  }
  let reason = '';
  try {
    const result = await ElMessageBox.prompt('请输入解绑原因（必填）', '解绑原因', {
      inputValidator: (v: string) => (v && v.trim().length > 0) || '原因不能为空',
      inputPlaceholder: '如：用户申请解绑 / 设备迁移',
      confirmButtonText: '确认解绑',
      cancelButtonText: '取消',
    });
    reason = result.value;
  } catch {
    return;
  }
  try {
    await api.unbindDevice(row.id, reason.trim());
    ElMessage.success('已解绑');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '解绑失败');
  }
}

async function openImport() {
  importVisible.value = true;
  importForm.modelId = '';
  importForm.serialsText = '';
  if (!models.value.length) {
    try {
      models.value = await api.deviceModels();
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '加载型号失败');
    }
  }
}

async function submitImport() {
  if (!importForm.modelId) {
    ElMessage.warning('请选择设备型号');
    return;
  }
  const serials = importForm.serialsText
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!serials.length) {
    ElMessage.warning('请输入至少一个 serial（每行一个）');
    return;
  }
  importing.value = true;
  try {
    const result = await api.importDevices(importForm.modelId, serials);
    ElMessage.success(
      `导入完成：新增 ${result.created.length} 台，跳过重复 ${result.skipped.length} 台`,
    );
    importVisible.value = false;
    pager.page = 1;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导入失败');
  } finally {
    importing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page-card">
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索设备名 / serial"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
      <el-button v-if="canWrite" type="success" :icon="Plus" @click="openImport">
        批量导入
      </el-button>
    </div>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="name" label="设备名" min-width="150" show-overflow-tooltip />
      <el-table-column prop="serialNo" label="Serial" width="200" show-overflow-tooltip />
      <el-table-column label="型号" min-width="150">
        <template #default="{ row }">
          <el-tooltip :content="row.model?.code" placement="top">
            <span>{{ row.model?.name || '-' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="在线" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.online ? 'success' : 'danger'" size="small">
            {{ row.online ? '在线' : '离线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="绑定" min-width="180">
        <template #default="{ row }">
          <template v-if="row.boundTo">
            <div>
              {{ row.boundTo.nickname }}
              <span class="muted">（{{ row.boundTo.familyName }}）</span>
            </div>
            <div class="muted small">
              绑定于 {{ new Date(row.boundTo.boundAt).toLocaleString() }}
            </div>
          </template>
          <el-tag v-else type="info" size="small">未绑定</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="roomName" label="房间" width="100">
        <template #default="{ row }">{{ row.roomName || '-' }}</template>
      </el-table-column>
      <el-table-column prop="source" label="来源" width="90">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ row.source }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">{{ row.status }}</template>
      </el-table-column>
      <el-table-column v-if="canWrite" label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.boundTo"
            link
            type="danger"
            size="small"
            @click="unbind(row as DeviceItem)"
          >
            解绑
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="pager.page"
      v-model:page-size="pager.pageSize"
      class="pager"
      :total="pager.total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />

    <el-dialog v-model="importVisible" title="批量导入设备" width="560px">
      <el-form label-width="90px">
        <el-form-item label="设备型号" required>
          <el-select v-model="importForm.modelId" placeholder="选择型号" style="width: 100%">
            <el-option
              v-for="m in models"
              :key="m.id"
              :label="`${m.name}（${m.code}）`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Serial 列表" required>
          <el-input
            v-model="importForm.serialsText"
            type="textarea"
            :rows="8"
            placeholder="每行一个 serial，如：&#10;SN-2026-0001&#10;SN-2026-0002"
          />
        </el-form-item>
      </el-form>
      <div class="muted small">重复 serial 会自动跳过；来源标记为 admin。</div>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">
          开始导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 14px;
  justify-content: flex-end;
}
.muted {
  color: #909399;
}
.small {
  font-size: 12px;
}
</style>
