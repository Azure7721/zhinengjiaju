import { defineStore } from 'pinia';
import { http } from '@/platform/request';
import type { SceneDto, SceneRunDto } from '@/core/types';

export const useSceneStore = defineStore('scene', {
  state: () => ({
    scenes: [] as SceneDto[],
    loading: false,
    error: '',
    /** sceneId → 最近一次执行（含逐项状态） */
    runs: {} as Record<string, SceneRunDto>,
    runningIds: [] as string[],
  }),
  getters: {
    byId: (s) => (id: string) => s.scenes.find((x) => x.id === id) ?? null,
  },
  actions: {
    async load(force = false) {
      if (this.loading) return;
      if (!force && this.scenes.length) return;
      this.loading = true;
      this.error = '';
      try {
        this.scenes = await http.get<SceneDto[]>('/scenes');
      } catch (e: any) {
        this.error = e?.message ?? '加载失败';
      } finally {
        this.loading = false;
      }
    },

    async detail(id: string): Promise<SceneDto> {
      const scene = await http.get<SceneDto>(`/scenes/${id}`);
      const idx = this.scenes.findIndex((s) => s.id === id);
      if (idx >= 0) this.scenes[idx] = scene;
      else this.scenes.push(scene);
      return scene;
    },

    /** 执行场景并启动逐项状态轮询 */
    async run(id: string): Promise<SceneRunDto> {
      const run = await http.post<SceneRunDto>(`/scenes/${id}/run`, {});
      this.runs[id] = run;
      if (!this.runningIds.includes(id)) this.runningIds.push(id);
      this.watchRun(id);
      return run;
    },

    /** 轮询 GET /scenes/:id/runs，直到终态 */
    watchRun(sceneId: string, maxPolls = 30) {
      let polls = 0;
      const tick = async () => {
        polls += 1;
        try {
          const runs = await http.get<SceneRunDto[]>(`/scenes/${sceneId}/runs`);
          const latest = runs?.[0];
          if (latest) this.runs[sceneId] = latest;
          const terminal = !latest || ['success', 'partial', 'failed', 'cancelled', 'timeout'].includes(latest.status);
          if (terminal || polls >= maxPolls) {
            this.runningIds = this.runningIds.filter((x) => x !== sceneId);
            return;
          }
        } catch {
          /* 网络抖动继续轮询 */
        }
        if (polls < maxPolls) {
          setTimeout(() => void tick(), 700);
        } else {
          this.runningIds = this.runningIds.filter((x) => x !== sceneId);
        }
      };
      void tick();
    },

    async create(data: { homeId: string; name: string }) {
      const scene = await http.post<SceneDto>('/scenes', {
        ...data,
        triggers: [{ type: 'manual', config: {} }],
        actions: [],
      });
      this.scenes.push(scene);
      return scene;
    },

    async remove(id: string) {
      await http.del(`/scenes/${id}`);
      this.scenes = this.scenes.filter((s) => s.id !== id);
    },
  },
});
