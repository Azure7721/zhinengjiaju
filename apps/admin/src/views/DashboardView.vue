<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  CircleCheck,
  Cpu,
  Document,
  HomeFilled,
  Odometer,
  User,
  Warning,
} from '@element-plus/icons-vue';
import { api } from '../api';
import type { DashboardData } from '../types';

const loading = ref(false);
const data = ref<DashboardData | null>(null);

async function load() {
  loading.value = true;
  try {
    data.value = await api.dashboard();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载仪表盘失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="page-card dashboard">
    <el-alert
      v-if="!loading && !data"
      type="error"
      title="指标加载失败"
      description="请确认服务端已启动后重试。"
      show-icon
      :closable="false"
    />
    <template v-else>
      <el-row :gutter="16">
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #e9f8f8; color: #12bfc1">
              <el-icon :size="22"><User /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">{{ data?.users ?? '-' }}</div>
              <div class="metric-label">用户总数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #ecf5ff; color: #409eff">
              <el-icon :size="22"><HomeFilled /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">{{ data?.families ?? '-' }}</div>
              <div class="metric-label">活跃家庭</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #f4f4f5; color: #909399">
              <el-icon :size="22"><Cpu /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">{{ data?.devices ?? '-' }}</div>
              <div class="metric-label">设备总数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #f0f9eb; color: #67c23a">
              <el-icon :size="22"><CircleCheck /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">
                {{ data ? `${data.onlineRate}%` : '-' }}
              </div>
              <div class="metric-label">设备在线率</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16" class="second-row">
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #fdf6ec; color: #e6a23c">
              <el-icon :size="22"><Odometer /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">
                {{ data ? `${data.commandSuccessRate}%` : '-' }}
              </div>
              <div class="metric-label">命令成功率（24h）</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #ecf5ff; color: #409eff">
              <el-icon :size="22"><Document /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">{{ data?.sceneRuns ?? '-' }}</div>
              <div class="metric-label">场景执行总数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #fef0f0; color: #f56c6c">
              <el-icon :size="22"><Warning /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">{{ data?.sceneFailedRuns ?? '-' }}</div>
              <div class="metric-label">场景失败/部分成功</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric">
            <div class="metric-icon" style="background: #e9f8f8; color: #12bfc1">
              <el-icon :size="22"><Cpu /></el-icon>
            </div>
            <div class="metric-body">
              <div class="metric-value">
                {{ data ? `${data.onlineDevices}/${data.devices}` : '-' }}
              </div>
              <div class="metric-label">在线设备 / 总设备</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="hint-card">
        <template #header>运营提示</template>
        <ul class="hint-list">
          <li>设备型号：新增/发布型号后，小程序端可动态渲染对应控制区。</li>
          <li>设备库存：支持批量导入 serial、绑定关系查询与带原因解绑。</li>
          <li>设备模拟器：可创建虚拟设备、注入遥测、模拟断连/重连，用于演示与联调。</li>
        </ul>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 420px;
}
.metric {
  display: flex;
  align-items: center;
}
.metric :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.metric-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}
.metric-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.second-row {
  margin-top: 16px;
}
.hint-card {
  margin-top: 16px;
}
.hint-list {
  margin: 0;
  padding-left: 18px;
  color: #606266;
  font-size: 13px;
  line-height: 1.9;
}
</style>
