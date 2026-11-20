import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { ElMessage } from 'element-plus';
import { hasPerm } from '../store/auth';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    permission?: string;
    public?: boolean;
    icon?: string;
  }
}

export interface MenuDef {
  path: string;
  title: string;
  permission: string;
  icon: string;
}

/** 侧边栏菜单（按权限过滤，见 AdminLayout） */
export const menuRoutes: MenuDef[] = [
  { path: '/dashboard', title: '仪表盘', permission: 'dashboard:read', icon: 'Odometer' },
  { path: '/users', title: '用户管理', permission: 'user:read', icon: 'User' },
  { path: '/families', title: '家庭管理', permission: 'family:read', icon: 'HomeFilled' },
  { path: '/device-models', title: '设备型号', permission: 'device_model:read', icon: 'Box' },
  { path: '/devices', title: '设备库存', permission: 'device:read', icon: 'Cpu' },
  { path: '/logs', title: '日志', permission: 'log:read', icon: 'Document' },
  { path: '/simulator', title: '设备模拟器', permission: 'simulator:run', icon: 'Monitor' },
];

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('../layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: '仪表盘', permission: 'dashboard:read' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/UsersView.vue'),
        meta: { title: '用户管理', permission: 'user:read' },
      },
      {
        path: 'families',
        name: 'families',
        component: () => import('../views/FamiliesView.vue'),
        meta: { title: '家庭管理', permission: 'family:read' },
      },
      {
        path: 'device-models',
        name: 'device-models',
        component: () => import('../views/DeviceModelsView.vue'),
        meta: { title: '设备型号', permission: 'device_model:read' },
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('../views/DevicesView.vue'),
        meta: { title: '设备库存', permission: 'device:read' },
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('../views/LogsView.vue'),
        meta: { title: '日志', permission: 'log:read' },
      },
      {
        path: 'simulator',
        name: 'simulator',
        component: () => import('../views/SimulatorView.vue'),
        meta: { title: '设备模拟器', permission: 'simulator:run' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_access_token');
  if (to.meta.public) {
    if (token && to.path === '/login') return '/dashboard';
    return true;
  }
  if (!token) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if (to.meta.permission && !hasPerm(to.meta.permission)) {
    ElMessage.warning('没有访问该页面的权限');
    return '/dashboard';
  }
  return true;
});

export default router;
