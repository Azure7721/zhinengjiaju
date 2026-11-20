<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Box,
  Cpu,
  Document,
  HomeFilled,
  Monitor,
  Odometer,
  SwitchButton,
  User,
} from '@element-plus/icons-vue';
import { hasPerm, useAuth } from '../store/auth';
import { menuRoutes } from '../router';

const iconMap = { Box, Cpu, Document, HomeFilled, Monitor, Odometer, User };

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const menus = computed(() => menuRoutes.filter((m) => hasPerm(m.permission)));
const activeMenu = computed(() => route.path);
const pageTitle = computed(() => (route.meta.title as string) || '');

async function onLogout() {
  await auth.logout();
  router.replace('/login');
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside width="220px" class="aside">
      <div class="logo">智慧屋 · 管理后台</div>
      <el-menu :default-active="activeMenu" router class="side-menu">
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <el-icon><component :is="iconMap[m.icon as keyof typeof iconMap]" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <span class="page-title">{{ pageTitle }}</span>
        <div class="user-area">
          <el-tag size="small" effect="plain">{{ auth.state.admin?.role }}</el-tag>
          <span class="user-name">{{ auth.state.admin?.name || auth.state.admin?.email }}</span>
          <el-button link type="primary" :icon="SwitchButton" @click="onLogout">
            退出登录
          </el-button>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-layout {
  height: 100vh;
}
.aside {
  background: #001529;
  overflow-y: auto;
}
.logo {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  padding: 18px 16px;
  letter-spacing: 1px;
}
.side-menu {
  border-right: none;
  background: #001529;
}
.side-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.7);
}
.side-menu .el-menu-item.is-active {
  background: #12bfc1;
  color: #fff;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
}
.user-area {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-name {
  color: #606266;
  font-size: 14px;
}
.main-content {
  background: #f5f7fa;
  overflow-y: auto;
}
</style>
