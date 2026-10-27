# Agent Commerce

面向 **人 + 商家 + AI Agent** 的完整电商服务：同一套领域模型，同时提供 HTTP API、MCP 工具，以及顾客前台 / 商家后台。

## Docker 一条命令跑起来

```bash
# 本地演示：JWT_SECRET + 演示 token；数据落在 named volume → /app/data
JWT_SECRET=dev-docker-change-me ALLOW_DEMO_TOKENS=1 docker compose up --build -d

# 健康检查 + 烟雾
curl -sS http://127.0.0.1:8787/healthz
curl -sS -H 'authorization: Bearer customer-token' http://127.0.0.1:8787/api/customer/products
curl -sS http://127.0.0.1:8787/   # Vite dist（API 同进程静态托管）

docker compose down
```

- 镜像：多阶段构建（`npm ci` → frontend `build` + `build:server`）；运行时仅 `dist/` + `dist-server/` + `node_modules` + **tini**。
- 持久化：`DATA_DIR=/app/data`（volume `commerce-data`）；SQLite 默认 `$DATA_DIR/commerce.sqlite`。
- **生产必须设强随机 `JWT_SECRET`**；演示 Bearer 仅在 `ALLOW_DEMO_TOKENS=1`（或非 production）时可用。

## 快速开始（本地 npm）

```bash
npm ci
# 本地 E2E 需要 Chromium；CI 已在 workflow 里安装（playwright install --with-deps chromium）
npx playwright install chromium
npm test
npm run build

# 先编译后端到 dist-server/（server / mcp 脚本会自动 prebuild）
npm run build:server

# API（默认 :8787，写入 $DATA_DIR/commerce.sqlite，DATA_DIR 默认 ./data，并种子演示商品）
# 若存在旧的 commerce.json 且 SQLite 为空，启动时自动导入一次
# 非 production：未设 JWT_SECRET 时使用进程内随机 secret（不对外暴露）
JWT_SECRET=dev-only-change-me npm run server
# 例：DATA_DIR=/tmp/ac-data JWT_SECRET=dev-only-change-me npm run server

# 顾客前台 + 商家后台（Vite :5173，代理 /api → API）
# Vite 代理读 E2E_API_PORT（默认 8787）；E2E / 改端口时请与 API 的 PORT 对齐
npm run dev
# 打开 http://localhost:5173/ 与 http://localhost:5173/#/merchant

# MCP stdio（同样跑编译产物；同样尊重 DATA_DIR）
npm run mcp
```

`DATA_DIR`（默认 `./data`）：HTTP / MCP / migrate 的存储根目录；未设 `DATA_PATH` 时 SQLite 为 `$DATA_DIR/commerce.sqlite`。`DATA_PATH` 仍可强制指定文件路径。

`E2E_API_PORT`：Vite 开发代理与 Playwright E2E 用它定位 API 源（默认 **8787**）。跑 `npm test` / `test:e2e` 时 Playwright 会自动解析空闲端口并注入；本地 `npm run server` + `npm run dev` 若 API 不在 8787，两边都要设同一值（例如 `E2E_API_PORT=8790 PORT=8790`）。

**生产部署必须设置 `JWT_SECRET`**（强随机值）。`NODE_ENV=production` 且未设置时进程**拒绝启动**。切勿使用仓库历史中的 `agent-commerce-dev-jwt-secret`。

演示 Bearer Token（仅当 `ALLOW_DEMO_TOKENS=1` 或 `NODE_ENV!=='production'`）：`customer-token` / `merchant-token` / `agent-token`（`agent:customer`）/ `agent-merchant-token`（`agent:merchant`）。生产默认关闭；关闭时 `/.well-known/ai-commerce.json` 也不再列出这些凭据。

## 能力一览

| 调用方 | 入口 |
|--------|------|
| 顾客 | Web UI · `/api/customer/*` |
| 商家 | `#/merchant` · `/api/merchant/*` |
| AI Agent | MCP（17 tools · sampling）· `/api/agent/*` · `/.well-known/ai-commerce.json` |

约定：

- 金额一律 **整数分（cents）**
- 写操作必须带 **`Idempotency-Key`**
- 错误体：`{ code, message, hint?, retryable }`
- OpenAPI 3.1：`docs/openapi.json` / `GET /openapi.json`

## 文档

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — 分层、JSON 存储与 SQLite 升级路径
- [API.md](docs/API.md) — HTTP 路由与鉴权
- [MCP.md](docs/MCP.md) — 工具 / resources / prompts 与客户端配置
- [AI-INTEGRATION.md](docs/AI-INTEGRATION.md) — 能力发现、分页、审计、限流
- [ISSUES-legacy.md](docs/history/ISSUES-legacy.md) — 历史压测负载定义（已不适用；原根目录 `ISSUES.md`）

## 脚本

| 命令 | 作用 |
|------|------|
| `npm run test:unit` | Vitest only（`vitest run`） |
| `npm run test:e2e` | Playwright E2E（需先 `npx playwright install chromium`） |
| `npm test` | `vitest run && playwright test`（unit + e2e） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | typecheck + Vite build |
| `npm run openapi` | 重新生成 `docs/openapi.json` |
| `npm run openapi:check` | 校验已提交的 OpenAPI 与生成结果一致 |
| `npm run server` | HTTP API |
| `npm run mcp` / `mcp:http` | MCP stdio / Streamable HTTP |
| `npm run migrate` | 对 SQLite 跑 schema migration；可选从 JSON 导入 |

## 技术栈

TypeScript strict · Node 22 · zod · Vitest · React 18 · Vite · `@modelcontextprotocol/sdk` · `node:sqlite` 仓储（可回退 JSON）。
