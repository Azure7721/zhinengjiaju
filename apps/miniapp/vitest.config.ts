import { defineConfig } from 'vitest/config';

/** vitest 独立配置：不加载 uni 插件（小程序编译与单测无关） */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
  },
});
