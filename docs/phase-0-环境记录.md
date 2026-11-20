# P0 · 环境记录（phase-0 环境记录）

> 记录安装、端口、账号与降级方案；与实现同步更新。

## 探测结果（2026-11-19）

| 项 | 值 | 说明 |
|---|---|---|
| Node | v24.14.0 | ≥20 ✓ |
| pnpm | 10.31.0 | ≥9 ✓ |
| Git | 2.33.1.windows.1 | ✓ |
| Python | 3.13.9 | bleak 备用（T1） |
| Docker | **未安装** | 走降级 |
| WSL | 未安装 | 走降级 |
| PostgreSQL / Redis / Mosquitto | 本机均无 | 走兜底 |

## 采用方案：三级降级之「兜底」

- **数据库**：SQLite（`apps/server/prisma/dev.db`），Prisma provider=sqlite
- **MQTT**：Aedes 进程内 broker（`infra/src/mqtt-broker.ts`），TCP 1883 + WS 8888
- **队列/缓存**：内存（场景冷却/并发锁在 server 进程内）
- **Docker 栈**：`infra/docker-compose.yml` 已备好，装 Docker 后可切换

## 端口表

| 端口 | 服务 | 状态 |
|---|---|---|
| 3000 | server REST+WS | ✓ 运行中 |
| 1883 / 8888 | Aedes MQTT TCP/WS | ✓ 运行中 |
| 7001 | 虚拟 BLE WebSocket | ✓ 运行中（device-engine） |
| 5173 | admin Vite | 开发时启动 |
| 5432 / 6379 | PostgreSQL / Redis | 未使用（无 Docker） |

## 测试账号（本地，不入生产）

- 管理员：`root@smart.local` / `ops@smart.local` / `support@smart.local` / `viewer@smart.local`，密码均为 `Admin@123456`
- 小程序用户：`POST /api/v1/auth/wechat/mock` `{ "nickname": "userA", "mockOpenId": "mock_userA" }`（seed 用户，含 5 台设备 + 2 场景）

## Windows 特有注意

- NestJS 需要 `emitDecoratorMetadata`：开发用 **ts-node**（tsx/esbuild 不支持装饰器元数据，会 DI 失败）
- pnpm 构建脚本白名单：根 `package.json → pnpm.onlyBuiltDependencies`（esbuild/prisma/@nestjs/core）
- 环境预检：`pnpm check-env`

## 密钥

- `apps/server/.env`（不入仓，`.gitignore` 已覆盖）；样例见根 `.env.example`
- `JWT_SECRET`、`WECHAT_APPID/SECRET` 生产必须替换
