<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { api } from '../api';
import { hasPerm } from '../store/auth';
import type { CapabilityDef, CapabilityType, ControlKind, DeviceModelItem } from '../types';

const CAP_TYPES: CapabilityType[] = ['boolean', 'number', 'enum', 'string'];
const CONTROLS: ControlKind[] = ['switch', 'dial', 'slider', 'segmented', 'remote', 'panel', 'generic'];

interface CapRow {
  key: string;
  type: CapabilityType;
  control: ControlKind;
  min: number | undefined;
  max: number | undefined;
  step: number | undefined;
  unit: string;
  valuesText: string;
  label: string;
  readonly: boolean;
}

interface CmdRow {
  name: string;
  paramsJson: string;
}

const canWrite = computed(() => hasPerm('device_model:write'));

const loading = ref(false);
const models = ref<DeviceModelItem[]>([]);
const statusFilter = ref('');

const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);
const activeSection = ref('basic');

const form = reactive({
  code: '',
  name: '',
  category: '',
  brand: '',
  image: '',
});
const capRows = ref<CapRow[]>([]);
const cmdRows = ref<CmdRow[]>([]);
const uiJson = ref('');

function defaultCapRow(): CapRow {
  return {
    key: '',
    type: 'boolean',
    control: 'switch',
    min: undefined,
    max: undefined,
    step: undefined,
    unit: '',
    valuesText: '',
    label: '',
    readonly: false,
  };
}

async function load() {
  loading.value = true;
  try {
    models.value = await api.deviceModels(statusFilter.value || undefined);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载设备型号失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.code = '';
  form.name = '';
  form.category = '';
  form.brand = '';
  form.image = '';
  capRows.value = [defaultCapRow()];
  cmdRows.value = [{ name: '', paramsJson: '{}' }];
  uiJson.value = '';
  activeSection.value = 'basic';
  dialogVisible.value = true;
}

function openEdit(model: DeviceModelItem) {
  editingId.value = model.id;
  form.code = model.code;
  form.name = model.name;
  form.category = model.category;
  form.brand = model.brand || '';
  form.image = model.image || '';
  const meta = model.metadata || { capabilities: [], commands: [] };
  capRows.value = (meta.capabilities || []).map((c) => ({
    key: c.key || '',
    type: (c.type || 'boolean') as CapabilityType,
    control: (c.control || 'generic') as ControlKind,
    min: c.min,
    max: c.max,
    step: c.step,
    unit: c.unit || '',
    valuesText: (c.values || []).join(','),
    label: c.label || '',
    readonly: !!c.readonly,
  }));
  if (!capRows.value.length) capRows.value = [defaultCapRow()];
  cmdRows.value = (meta.commands || []).map((c) => ({
    name: c.name || '',
    paramsJson: JSON.stringify(c.params || {}, null, 2),
  }));
  if (!cmdRows.value.length) cmdRows.value = [{ name: '', paramsJson: '{}' }];
  uiJson.value = meta.ui ? JSON.stringify(meta.ui, null, 2) : '';
  activeSection.value = 'basic';
  dialogVisible.value = true;
}

function addCapRow() {
  capRows.value.push(defaultCapRow());
}

function removeCapRow(i: number) {
  capRows.value.splice(i, 1);
}

function addCmdRow() {
  cmdRows.value.push({ name: '', paramsJson: '{}' });
}

function removeCmdRow(i: number) {
  cmdRows.value.splice(i, 1);
}

function parseJson(text: string, label: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const value = JSON.parse(trimmed);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      ElMessage.error(`${label} 必须是 JSON 对象`);
      return null;
    }
    return value as Record<string, unknown>;
  } catch (e) {
    ElMessage.error(`${label} JSON 解析失败：${e instanceof Error ? e.message : e}`);
    return null;
  }
}

function buildMetadata(): Record<string, unknown> | null {
  const capabilities: CapabilityDef[] = [];
  for (let i = 0; i < capRows.value.length; i++) {
    const row = capRows.value[i];
    if (!row.key.trim()) {
      if (capRows.value.length === 1) break; // 空白单行视为无能力
      ElMessage.error(`第 ${i + 1} 行能力缺少 key`);
      return null;
    }
    const cap: CapabilityDef = {
      key: row.key.trim(),
      type: row.type,
      control: row.control,
    };
    if (row.type === 'number') {
      if (row.min !== undefined) cap.min = row.min;
      if (row.max !== undefined) cap.max = row.max;
      if (row.step !== undefined) cap.step = row.step;
    }
    if (row.unit.trim()) cap.unit = row.unit.trim();
    if (row.type === 'enum') {
      const values = row.valuesText
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (!values.length) {
        ElMessage.error(`能力「${row.key}」为 enum，需填写 values（逗号分隔）`);
        return null;
      }
      cap.values = values;
    }
    if (row.label.trim()) cap.label = row.label.trim();
    if (row.readonly) cap.readonly = true;
    capabilities.push(cap);
  }

  const commands = [];
  for (let i = 0; i < cmdRows.value.length; i++) {
    const row = cmdRows.value[i];
    if (!row.name.trim()) {
      if (cmdRows.value.length === 1) break;
      ElMessage.error(`第 ${i + 1} 行命令缺少 name`);
      return null;
    }
    const params = parseJson(row.paramsJson, `命令「${row.name.trim()}」的 params`);
    if (params === null) return null;
    commands.push({ name: row.name.trim(), params });
  }

  let ui: Record<string, unknown> | undefined;
  if (uiJson.value.trim()) {
    const parsed = parseJson(uiJson.value, 'UI Schema');
    if (parsed === null) return null;
    ui = parsed;
  }

  return {
    model: form.code,
    name: form.name,
    category: form.category,
    capabilities,
    commands,
    ...(ui ? { ui } : {}),
  };
}

async function save() {
  if (!form.name.trim() || !form.category.trim()) {
    ElMessage.warning('请填写名称与品类');
    return;
  }
  if (!editingId.value && !form.code.trim()) {
    ElMessage.warning('请填写型号 code');
    return;
  }
  const metadata = buildMetadata();
  if (!metadata) return;

  saving.value = true;
  try {
    if (editingId.value) {
      await api.patchDeviceModel(editingId.value, {
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim() || undefined,
        image: form.image.trim() || undefined,
        metadata,
      });
      ElMessage.success('型号已保存');
    } else {
      await api.createDeviceModel({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim() || undefined,
        image: form.image.trim() || undefined,
        metadata,
        status: 'draft',
      });
      ElMessage.success('型号已创建（草稿）');
    }
    dialogVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(model: DeviceModelItem) {
  const next = model.status === 'published' ? 'draft' : 'published';
  const tip =
    next === 'published'
      ? `确认发布型号「${model.name}」？发布后版本号 +1，小程序端将可见。`
      : `确认将型号「${model.name}」下架为草稿？`;
  try {
    await ElMessageBox.confirm(tip, '状态切换', { type: 'warning', confirmButtonText: '确定' });
  } catch {
    return;
  }
  try {
    await api.patchDeviceModel(model.id, { status: next });
    ElMessage.success(next === 'published' ? '已发布' : '已下架');
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '状态切换失败');
  }
}

const previewCaps = computed(() => capRows.value.filter((c) => c.key.trim()));

onMounted(load);
</script>

<template>
  <div class="page-card">
    <div class="filter-bar">
      <el-select
        v-model="statusFilter"
        placeholder="全部状态"
        clearable
        style="width: 160px"
        @change="load"
      >
        <el-option label="草稿 draft" value="draft" />
        <el-option label="已发布 published" value="published" />
      </el-select>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
      <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">
        新建设备型号
      </el-button>
    </div>

    <el-table v-loading="loading" :data="models" border stripe>
      <el-table-column prop="code" label="code" width="170" show-overflow-tooltip />
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="category" label="品类" width="120" />
      <el-table-column prop="brand" label="品牌" width="120">
        <template #default="{ row }">{{ row.brand || '-' }}</template>
      </el-table-column>
      <el-table-column label="能力 / 命令" width="120">
        <template #default="{ row }">
          {{ row.metadata?.capabilities?.length || 0 }} /
          {{ row.metadata?.commands?.length || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170">
        <template #default="{ row }">
          {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column v-if="canWrite" label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as DeviceModelItem)">
            编辑
          </el-button>
          <el-button
            link
            :type="row.status === 'published' ? 'warning' : 'success'"
            @click="toggleStatus(row as DeviceModelItem)"
          >
            {{ row.status === 'published' ? '下架' : '发布' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑设备型号' : '新建设备型号'"
      width="1000px"
      top="4vh"
      destroy-on-close
    >
      <el-tabs v-model="activeSection">
        <el-tab-pane label="基础信息" name="basic">
          <el-form label-width="90px" class="editor-form">
            <el-form-item label="code" required>
              <el-input
                v-model="form.code"
                :disabled="!!editingId"
                placeholder="唯一型号标识，如 bulb.a1"
              />
            </el-form-item>
            <el-form-item label="名称" required>
              <el-input v-model="form.name" placeholder="如 智能灯泡 Pro" />
            </el-form-item>
            <el-form-item label="品类" required>
              <el-input v-model="form.category" placeholder="如 light / curtain / sensor" />
            </el-form-item>
            <el-form-item label="品牌">
              <el-input v-model="form.brand" placeholder="选填" />
            </el-form-item>
            <el-form-item label="图片 URL">
              <el-input v-model="form.image" placeholder="选填" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="能力" name="capabilities">
          <div class="section-toolbar">
            <el-button size="small" :icon="Plus" @click="addCapRow">添加能力</el-button>
            <span class="section-hint">key/type 必填；enum 需填写 values（逗号分隔）</span>
          </div>
          <el-table :data="capRows" size="small" border max-height="360">
            <el-table-column label="key" width="130">
              <template #default="{ row }">
                <el-input v-model="row.key" size="small" placeholder="power" />
              </template>
            </el-table-column>
            <el-table-column label="type" width="110">
              <template #default="{ row }">
                <el-select v-model="row.type" size="small">
                  <el-option v-for="t in CAP_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="control" width="120">
              <template #default="{ row }">
                <el-select v-model="row.control" size="small">
                  <el-option v-for="c in CONTROLS" :key="c" :label="c" :value="c" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="min" width="90">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.min"
                  size="small"
                  :controls="false"
                  placeholder="—"
                />
              </template>
            </el-table-column>
            <el-table-column label="max" width="90">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.max"
                  size="small"
                  :controls="false"
                  placeholder="—"
                />
              </template>
            </el-table-column>
            <el-table-column label="unit" width="80">
              <template #default="{ row }">
                <el-input v-model="row.unit" size="small" placeholder="℃" />
              </template>
            </el-table-column>
            <el-table-column label="values" width="130">
              <template #default="{ row }">
                <el-input
                  v-model="row.valuesText"
                  size="small"
                  placeholder="on,off"
                  :disabled="row.type !== 'enum'"
                />
              </template>
            </el-table-column>
            <el-table-column label="label" width="110">
              <template #default="{ row }">
                <el-input v-model="row.label" size="small" placeholder="显示名" />
              </template>
            </el-table-column>
            <el-table-column label="只读" width="70" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.readonly" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="" width="70" align="center">
              <template #default="{ $index }">
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="removeCapRow($index)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="命令" name="commands">
          <div class="section-toolbar">
            <el-button size="small" :icon="Plus" @click="addCmdRow">添加命令</el-button>
            <span class="section-hint">params 为 JSON 对象，保存前会校验</span>
          </div>
          <el-table :data="cmdRows" size="small" border max-height="320">
            <el-table-column label="name" width="200">
              <template #default="{ row }">
                <el-input v-model="row.name" size="small" placeholder="setBrightness" />
              </template>
            </el-table-column>
            <el-table-column label="params（JSON）">
              <template #default="{ row }">
                <el-input
                  v-model="row.paramsJson"
                  size="small"
                  type="textarea"
                  :rows="2"
                  placeholder='{"brightness": "number"}'
                />
              </template>
            </el-table-column>
            <el-table-column label="" width="70" align="center">
              <template #default="{ $index }">
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="removeCmdRow($index)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="UI Schema" name="ui">
          <el-input
            v-model="uiJson"
            type="textarea"
            :rows="14"
            placeholder='{"layout": "grid", "order": ["power", "brightness"]}'
          />
          <div class="section-hint" style="margin-top: 8px">
            可选。JSON 对象，保存前会 JSON.parse 校验。
          </div>
        </el-tab-pane>

        <el-tab-pane label="预览" name="preview">
          <div class="preview-box">
            <div class="preview-title">{{ form.name || '未命名型号' }}</div>
            <div class="preview-sub">{{ form.category || 'category' }}</div>
            <div v-if="!previewCaps.length" class="section-hint">暂无可预览的能力</div>
            <div v-for="cap in previewCaps" :key="cap.key" class="preview-item">
              <div class="preview-label">
                {{ cap.label || cap.key }}
                <span v-if="cap.unit" class="unit">({{ cap.unit }})</span>
              </div>
              <el-switch v-if="cap.type === 'boolean'" :model-value="true" disabled />
              <el-slider
                v-else-if="cap.type === 'number'"
                :model-value="cap.max ?? 50"
                :min="cap.min ?? 0"
                :max="cap.max ?? 100"
                disabled
                style="width: 220px"
              />
              <el-radio-group
                v-else-if="cap.type === 'enum'"
                :model-value="(cap.valuesText.split(',').filter(Boolean)[0] as string) || ''"
                disabled
              >
                <el-radio
                  v-for="v in cap.valuesText.split(',').filter((x) => x.trim())"
                  :key="v"
                  :value="v.trim()"
                >
                  {{ v.trim() }}
                </el-radio>
              </el-radio-group>
              <el-input v-else :model-value="cap.key" disabled style="width: 220px" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.editor-form {
  max-width: 520px;
}
.section-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.section-hint {
  font-size: 12px;
  color: #909399;
}
.preview-box {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 18px;
  max-width: 480px;
}
.preview-title {
  font-size: 16px;
  font-weight: 600;
}
.preview-sub {
  font-size: 12px;
  color: #909399;
  margin-bottom: 14px;
}
.preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f2f2f2;
}
.preview-label {
  font-size: 14px;
}
.preview-label .unit {
  color: #909399;
  font-size: 12px;
}
</style>
