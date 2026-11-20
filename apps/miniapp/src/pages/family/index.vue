<script setup lang="ts">
/**
 * 家庭管理（A 类）：列表 / 创建 / 邀请码 / 加入 / 成员查看
 */
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/core/stores/user';
import { useDeviceStore } from '@/core/stores/device';
import Sheet from '@/components/common/Sheet.vue';
import { errorToast, successToast, toast } from '@/platform/toast';

const user = useUserStore();
const devices = useDeviceStore();

const createShow = ref(false);
const joinShow = ref(false);
const newName = ref('');
const joinCode = ref('');
const inviteCode = ref('');
const busy = ref(false);
const members = ref<{ userId: string; nickname: string; role: string }[]>([]);

onShow(async () => {
  if (!user.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  await user.loadFamilies();
  await loadMembers();
});

async function loadMembers() {
  const fam = user.currentFamily;
  if (!fam) return;
  try {
    members.value = await user.loadMembers(fam.id);
  } catch {
    members.value = [];
  }
}

function selectFamily(id: string) {
  user.switchFamily(id);
  void devices.reload();
  void loadMembers();
  void user.loadHomes();
}

async function createFamily() {
  const name = newName.value.trim();
  if (!name) return;
  busy.value = true;
  try {
    await user.createFamily(name);
    createShow.value = false;
    newName.value = '';
    successToast('家庭已创建');
    await loadMembers();
  } catch (e: any) {
    errorToast(e?.message ?? '创建失败');
  } finally {
    busy.value = false;
  }
}

async function joinFamily() {
  const code = joinCode.value.trim().toUpperCase();
  if (code.length < 6) {
    errorToast('请输入 6 位以上邀请码');
    return;
  }
  busy.value = true;
  try {
    const fam = await user.joinFamily(code);
    joinShow.value = false;
    joinCode.value = '';
    successToast(`已加入「${fam.name}」`);
    await loadMembers();
  } catch (e: any) {
    errorToast(e?.message ?? '加入失败');
  } finally {
    busy.value = false;
  }
}

async function makeInvite() {
  const fam = user.currentFamily;
  if (!fam) return;
  busy.value = true;
  try {
    const res = await user.createInvite(fam.id);
    inviteCode.value = res.code;
    uni.setClipboardData({
      data: res.code,
      success: () => toast('邀请码已复制', 'success'),
    });
  } catch (e: any) {
    errorToast(e?.message ?? '生成失败');
  } finally {
    busy.value = false;
  }
}

const ROLE_TEXT: Record<string, string> = {
  owner: '房主',
  admin: '管理员',
  member: '成员',
  viewer: '访客',
};
</script>

<template>
  <view class="page family">
    <!-- 当前家庭列表 -->
    <view class="section-title">我的家庭</view>
    <view
      v-for="f in user.families"
      :key="f.id"
      class="fam card"
      :class="{ active: f.id === user.currentFamilyId }"
      @click="selectFamily(f.id)"
    >
      <view class="fam-icon">🏠</view>
      <view class="fam-main">
        <view class="fam-name">{{ f.name }}</view>
        <view class="fam-role">{{ ROLE_TEXT[f.role] ?? f.role }}</view>
      </view>
      <view v-if="f.id === user.currentFamilyId" class="fam-check">✓</view>
    </view>

    <view class="actions">
      <view class="act" @click="createShow = true">＋ 创建家庭</view>
      <view class="act" @click="joinShow = true">加入家庭</view>
    </view>

    <!-- 邀请码 -->
    <view class="section-title">邀请码</view>
    <view class="invite card">
      <view class="invite-code" :class="{ empty: !inviteCode }">
        {{ inviteCode || '未生成' }}
      </view>
      <view class="invite-btn" :class="{ disabled: busy }" @click="makeInvite">
        {{ busy ? '生成中…' : inviteCode ? '重新生成' : '生成邀请码' }}
      </view>
      <view class="invite-hint">邀请码 24 小时内有效，分享给家人加入</view>
    </view>

    <!-- 成员 -->
    <view class="section-title">家庭成员（{{ members.length }}）</view>
    <view class="members card">
      <view v-if="!members.length" class="empty-inline">加载中或暂无成员</view>
      <view v-for="m in members" :key="m.userId" class="member">
        <view class="member-avatar">{{ m.nickname.slice(0, 1).toUpperCase() }}</view>
        <view class="member-name">{{ m.nickname }}</view>
        <view class="member-role chip" :class="m.role === 'owner' ? 'chip-primary' : ''">
          {{ ROLE_TEXT[m.role] ?? m.role }}
        </view>
      </view>
    </view>

    <!-- 创建弹层 -->
    <Sheet :show="createShow" title="创建家庭" @close="createShow = false">
      <view class="form">
        <input class="form-input" v-model="newName" placeholder="家庭名称，如：幸福小家" maxlength="16" />
        <view class="form-btn" :class="{ disabled: busy || !newName.trim() }" @click="createFamily">
          {{ busy ? '创建中…' : '创建' }}
        </view>
      </view>
    </Sheet>

    <!-- 加入弹层 -->
    <Sheet :show="joinShow" title="加入家庭" @close="joinShow = false">
      <view class="form">
        <input
          class="form-input"
          v-model="joinCode"
          placeholder="输入邀请码"
          maxlength="16"
          @confirm="joinFamily"
        />
        <view class="form-btn" :class="{ disabled: busy }" @click="joinFamily">
          {{ busy ? '加入中…' : '加入' }}
        </view>
      </view>
    </Sheet>
  </view>
</template>

<style scoped lang="scss">
.family {
  padding: 24rpx 28rpx 60rpx;
}
.fam {
  display: flex;
  align-items: center;
  padding: 28rpx 28rpx;
  margin-bottom: 20rpx;
  border: 3rpx solid transparent;
  &.active {
    border-color: #12bfc1;
    background: #f8fefe;
  }
}
.fam-icon {
  width: 84rpx;
  height: 84rpx;
  border-radius: 24rpx;
  background: #eefafa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  margin-right: 24rpx;
}
.fam-main {
  flex: 1;
}
.fam-name {
  font-size: 31rpx;
  font-weight: 600;
}
.fam-role {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #8a9a9c;
}
.fam-check {
  color: #12bfc1;
  font-size: 40rpx;
}
.actions {
  display: flex;
  gap: 20rpx;
}
.act {
  flex: 1;
  text-align: center;
  background: #fff;
  border: 2rpx dashed #12bfc1;
  color: #12bfc1;
  border-radius: 24rpx;
  padding: 26rpx 0;
  font-size: 29rpx;
}
.invite {
  padding: 32rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.invite-code {
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
  color: #12bfc1;
  &.empty {
    color: #c0cbcc;
    font-weight: 400;
    font-size: 36rpx;
    letter-spacing: 0;
  }
}
.invite-btn {
  margin-top: 28rpx;
  background: #12bfc1;
  color: #fff;
  border-radius: 999rpx;
  padding: 20rpx 64rpx;
  font-size: 28rpx;
  &.disabled {
    opacity: 0.55;
  }
}
.invite-hint {
  margin-top: 18rpx;
  color: #a4b0b2;
  font-size: 23rpx;
}
.members {
  padding: 12rpx 30rpx;
}
.member {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 24rpx 0;
  border-bottom: 2rpx solid #f4f8f8;
  &:last-child {
    border-bottom: none;
  }
}
.member-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #12bfc1, #7bdedf);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
}
.member-name {
  flex: 1;
  font-size: 29rpx;
}
.form {
  padding-bottom: 24rpx;
}
.form-input {
  background: #f2f7f8;
  border-radius: 16rpx;
  padding: 24rpx 26rpx;
  font-size: 30rpx;
}
.form-btn {
  margin-top: 32rpx;
  background: #12bfc1;
  color: #fff;
  text-align: center;
  border-radius: 999rpx;
  padding: 24rpx 0;
  font-size: 30rpx;
  &.disabled {
    opacity: 0.55;
  }
}
</style>
