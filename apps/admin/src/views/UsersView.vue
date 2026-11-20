<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { api } from '../api';
import type { UserItem } from '../types';

const loading = ref(false);
const keyword = ref('');
const items = ref<UserItem[]>([]);
const pager = reactive({ page: 1, pageSize: 20, total: 0 });

async function load() {
  loading.value = true;
  try {
    const data = await api.users({
      q: keyword.value.trim() || undefined,
      page: pager.page,
      pageSize: pager.pageSize,
    });
    items.value = data.items;
    pager.total = data.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载用户失败');
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

onMounted(load);
</script>

<template>
  <div class="page-card">
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索昵称 / 手机号 / ID"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="items" border stripe>
      <el-table-column prop="id" label="用户 ID" width="240" show-overflow-tooltip />
      <el-table-column prop="nickname" label="昵称" min-width="120" />
      <el-table-column prop="phone" label="手机号" width="140">
        <template #default="{ row }">{{ row.phone || '-' }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="所属家庭" min-width="200">
        <template #default="{ row }">
          <template v-if="row.families?.length">
            <el-tag
              v-for="f in row.families"
              :key="f.id"
              size="small"
              effect="plain"
              class="fam-tag"
            >
              {{ f.name }}（{{ f.role }}）
            </el-tag>
          </template>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
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
  </div>
</template>

<style scoped>
.pager {
  margin-top: 14px;
  justify-content: flex-end;
}
.fam-tag {
  margin-right: 6px;
}
</style>
