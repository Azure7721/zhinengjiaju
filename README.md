# 全屋智能小程序系统（smart-home）

微信小程序用户端 + PC 管理后台 + NestJS 服务端 + 模拟设备引擎。按 `docs/` 中 P0–P5 开发计划实现。

## 快速开始（本机兜底方案：SQLite + Aedes，无需 Docker）

```bash
pnpm install
pnpm --filter @smart-home/server exec prisma db push   # 建库
pnpm db:seed                                            # 种子数据
pnpm dev:mqtt                                           # 终端1：MQTT broker (1883/8888)
pnpm dev:server                                         # 终端2：API (3000)
pnpm dev:engine                                         # 终端3：模拟设备引擎
pnpm dev:admin                                          # 终端4：管理后台 (5173)
pnpm dev:mp-weixin                                      # 终端5：小程序编译，开发者工具打开 dist/dev/mp-weixin
```

健康检查：`GET http://127.0.0.1:3000/api/v1/health`

环境预检：`pnpm check-env`

## 端口表

| 服务 | 端口 | 说明 |
|---|---|---|
| server (NestJS) | 3000 | REST `/api/v1` + WS `/ws` |
| MQTT (Aedes) | 1883 / 8888 | TCP / WS |
| device-engine | 7001 | 虚拟 BLE WebSocket |
| admin (Vite) | 5173 | 管理后台 |
| SQLite | 文件 | `apps/server/prisma/dev.db` |

## 测试账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 super_admin | root@smart.local | Admin@123456 |
| 管理员 ops | ops@smart.local | Admin@123456 |
| 管理员 support | support@smart.local | Admin@123456 |
| 管理员 viewer | viewer@smart.local | Admin@123456 |
| 小程序用户 | `POST /api/v1/auth/wechat/mock` `{ "nickname": "userA" }` | — |

## 常用脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 并行启动 server/admin/engine/MQTT |
| `pnpm build` | 构建全部包 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | 质量门禁 |
| `pnpm db:migrate` / `db:seed` / `db:reset` | 数据库迁移/种子/重置 |
| `pnpm check-env` | 端口/版本/健康预检 |
| `pnpm ci` | lint + typecheck + test + build |

## 环境降级（docs/phase-0 · 4）

1. **首选** Docker Compose（`infra/docker-compose.yml`：PostgreSQL/Redis/Mosquitto）
2. **降级** 本机服务
3. **兜底（当前默认）** SQLite + Aedes + 内存 —— `pnpm dev:lite`

切换 PostgreSQL：改 `apps/server/prisma/schema.prisma` 的 `provider = "postgresql"` 并配置 `DATABASE_URL`。

## 目录结构

```
apps/
  server/          NestJS API / WS / MQTT 桥接
  device-engine/   模拟设备引擎 + 虚拟 BLE (7001)
  admin/           PC 管理后台 (Vue3 + Element Plus)
  miniapp/         微信小程序 (uni-app + Vue3)
packages/
  shared/          类型、错误码、RBAC、能力注册表
  contracts/       WS/MQTT/虚拟 BLE 消息契约
infra/             Aedes broker + docker-compose
scripts/           check-env
docs/              开发计划文档集
```

## 关键设计

- **元数据驱动**：设备型号/能力/命令存 `device_model.metadata_json`，小程序按 capability 动态渲染，未知能力走通用控件（不白屏）。
- **命令总线**：REST → 校验/幂等(cmdId) → 落库 → MQTT → 设备 ack → WS 推送；超时标记 timeout。
- **信号链路**：device-engine → MQTT `device/{id}/telemetry` → server 订阅落库 → WS → 前端。
- **权限**：家庭 owner/admin/member 服务端校验；管理员 RBAC(super_admin/ops/support/viewer) 守卫到按钮。
- **空缺入口**：A 类（设置/家庭管理等）新设计最小页；B 类（商城/发现）点击提示"正在开发中"。

## 环境记录

- Node 24.14 / pnpm 10.31 / Git 2.33；无 Docker、无 WSL → 走兜底方案
- Windows + ts-node（NestJS 需 `emitDecoratorMetadata`，tsx/esbuild 不支持）
- `.env` 不入仓；样例见 `.env.example`
