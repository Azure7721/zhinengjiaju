import { defineStore } from 'pinia';
import { http } from '@/platform/request';
import {
  getAccessToken,
  setTokens,
  clearTokens,
  getCurrentFamilyId,
  setCurrentFamilyId,
} from '@/platform/storage';
import type {
  FamilyDto,
  FamilyRole,
  HomeDto,
  LoginResult,
  MeDto,
  RoomLite,
  UserDto,
} from '@/core/types';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getAccessToken(),
    user: null as UserDto | null,
    families: [] as FamilyDto[],
    currentFamilyId: getCurrentFamilyId(),
    homes: [] as (HomeDto & { rooms: RoomLite[] })[],
    loaded: false,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    currentFamily: (s) => s.families.find((f) => f.id === s.currentFamilyId) ?? s.families[0] ?? null,
    rooms: (s): RoomLite[] => {
      const home = s.homes[0];
      return home?.rooms ?? [];
    },
  },
  actions: {
    /** 从本地恢复会话并拉取 me */
    async restore() {
      if (!this.token) return;
      try {
        const me = await http.get<MeDto>('/auth/me');
        this.applyMe(me);
      } catch {
        // token 失效：交由 request 层 refresh；仍失败则清空
        if (!getAccessToken()) this.reset();
      }
    },

    applyMe(me: MeDto) {
      this.user = me.user;
      this.families = me.families ?? [];
      if (!this.currentFamilyId && this.families.length) {
        this.currentFamilyId = me.currentFamilyId || this.families[0].id;
        setCurrentFamilyId(this.currentFamilyId);
      }
      this.loaded = true;
    },

    /** mock 微信登录（演示：userA 有 5 台设备 + 2 场景） */
    async mockLogin(nickname = 'userA', mockOpenId?: string) {
      const data = await http.post<LoginResult>('/auth/wechat/mock', {
        nickname,
        mockOpenId: mockOpenId ?? `mock_${nickname}`,
      });
      setTokens(data.accessToken, data.refreshToken, data.expiresIn);
      this.token = data.accessToken;
      this.user = data.user;
      this.families = data.families ?? [];
      this.currentFamilyId = getCurrentFamilyId() || this.families[0]?.id || '';
      if (this.currentFamilyId) setCurrentFamilyId(this.currentFamilyId);
      this.loaded = true;
      await this.loadHomes();
    },

    async loadFamilies() {
      this.families = await http.get<FamilyDto[]>('/families');
      if (!this.currentFamilyId && this.families.length) {
        this.currentFamilyId = this.families[0].id;
        setCurrentFamilyId(this.currentFamilyId);
      }
    },

    async loadHomes() {
      this.homes = await http.get<(HomeDto & { rooms: RoomLite[] })[]>('/homes');
    },

    async ensureData() {
      await Promise.all([this.loadFamilies(), this.loadHomes()]);
    },

    switchFamily(id: string) {
      this.currentFamilyId = id;
      setCurrentFamilyId(id);
    },

    async createFamily(name: string) {
      const fam = await http.post<FamilyDto>('/families', { name });
      await this.loadFamilies();
      this.switchFamily(fam.id);
      await this.loadHomes();
      return fam;
    },

    async joinFamily(code: string) {
      const fam = await http.post<FamilyDto>('/families/join', { code });
      await this.loadFamilies();
      await this.loadHomes();
      return fam;
    },

    async createInvite(familyId: string) {
      return http.post<{ code: string; expiresAt: string }>(`/families/${familyId}/invites`);
    },

    async loadMembers(familyId: string) {
      return http.get<
        { userId: string; nickname: string; avatar?: string; role: FamilyRole; joinedAt: string }[]
      >(`/families/${familyId}/members`);
    },

    logout() {
      const refresh = uni.getStorageSync('sh.refreshToken') as string;
      if (refresh) void http.post('/auth/logout', { refreshToken: refresh }).catch(() => undefined);
      clearTokens();
      setCurrentFamilyId('');
      this.$reset();
    },

    reset() {
      clearTokens();
      setCurrentFamilyId('');
      this.token = '';
      this.user = null;
      this.families = [];
      this.currentFamilyId = '';
      this.homes = [];
      this.loaded = false;
    },
  },
});
