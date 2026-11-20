<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Lock, User as UserIcon } from '@element-plus/icons-vue';
import { useAuth } from '../store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const form = reactive({
  email: 'root@smart.local',
  password: '',
});
const loading = ref(false);

async function submit() {
  if (!form.email || !form.password) {
    ElMessage.warning('请输入邮箱和密码');
    return;
  }
  loading.value = true;
  try {
    await auth.login(form.email, form.password);
    ElMessage.success('登录成功');
    const redirect = (route.query.redirect as string) || '/dashboard';
    router.replace(redirect);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="login-title">智慧屋 · 管理后台</div>
      <el-form :model="form" label-position="top" @keyup.enter="submit">
        <el-form-item label="邮箱">
          <el-input
            v-model="form.email"
            :prefix-icon="UserIcon"
            placeholder="admin@example.com"
            size="large"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            :prefix-icon="Lock"
            placeholder="请输入密码"
            size="large"
            show-password
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="submit"
        >
          登 录
        </el-button>
      </el-form>
      <div class="login-hint">测试账号：root@smart.local / Admin@123456</div>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #003d40 0%, #12bfc1 100%);
}
.login-card {
  width: 380px;
  padding: 8px 12px 4px;
}
.login-title {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 18px;
  color: #303133;
}
.login-btn {
  width: 100%;
  margin-top: 4px;
}
.login-hint {
  margin-top: 14px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>
