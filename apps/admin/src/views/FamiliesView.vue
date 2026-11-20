<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { api } from '../api';
import type { FamilyItem } from '../types';

const loading = ref(false);
const keyword = ref('');
const items = ref<FamilyItem[]>([]);
const pager = reactive({ page: 1, pageSize: 20, total: 0 });

const memberDialog = ref(false);
const currentFamily = ref<FamilyItem | null>(null);

async function load() {
  loading.value = true;
  try {
    const data = await api.families({
      q: keyword.value.trim() || undefined,
      page: pager.page,
      pageSize: pager.pageSize,
    });
    items.value = data.items;
    pager.total = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载家庭失败');
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

function viewMembers(row: FamilyItem) {
  currentFamily.value = row;
  memberDialog.value = true;
}

onMounted(load);
</script>

<template>
  <div class="page-card">
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索家庭名称"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="name" label="家庭名称" min-width="160" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="memberCount" label="成员数" width="90" />
      <el-table-column prop="homeCount" label="住宅数" width="90" />
      <el-table-column prop="deviceCount" label="设备数" width="90" />
      <el-table-column prop="ownerId" label="Owner ID" width="240" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewMembers(row as FamilyItem)">
            成员
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

    <el-dialog
      v-model="memberDialog"
      :title="`成员 · ${currentFamily?.name || ''}`"
      width="560px"
    >
      <el-table :data="currentFamily?.members || []" border size="small">
        <el-table-column prop="nickname" label="昵称" min-width="140" />
        <el-table-column prop="userId" label="用户 ID" min-width="220" show-overflow-tooltip />
        <el-table-column label="角色" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.role }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="memberDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 14px;
  justify-content: flex-end;
}
</style>
