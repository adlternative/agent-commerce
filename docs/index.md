---
title: Getting Started
description: Run Agent Commerce locally — HTTP API, MCP, customer/merchant UI
---

# Getting Started

**Agent Commerce** 是面向 **人 + 商家 + AI Agent** 的开源电商运行时：同一套领域模型（`src/services/commerce.ts`），同时暴露 HTTP API、MCP 工具，以及顾客前台 / 商家后台。

## 前置

- Node.js ≥ 22
- `npm ci`

## 本地跑起来

```bash
npm ci
npx playwright install chromium   # 仅跑 E2E 需要
npm run build:server

# API（默认 :8787，SQLite → $DATA_DIR/commerce.sqlite）
JWT_SECRET=dev-only-change-me npm run server

# 另一终端：顾客 / 商家 UI（Vite :5173，代理 /api）
npm run dev
```

打开：

- 顾客 UI：`http://localhost:5173/`
- 商家 UI：`http://localhost:5173/#/merchant`
- Discovery：`http://127.0.0.1:8787/.well-known/ai-commerce.json`
- OpenAPI：`http://127.0.0.1:8787/openapi.json`

MCP：

```bash
JWT_SECRET=dev-only-change-me npm run mcp          # stdio
MCP_HTTP_PORT=8790 npm run mcp:http                # Streamable HTTP
```

## Docker

```bash
JWT_SECRET=dev-docker-change-me ALLOW_DEMO_TOKENS=1 docker compose up --build -d
curl -sS http://127.0.0.1:8787/healthz
```

生产必须设强随机 `JWT_SECRET`；演示 Bearer 仅在 `ALLOW_DEMO_TOKENS=1`（或非 production）时可用。

## 文档地图

| 分区 | 内容 |
|------|------|
| [产品价值](/product/POSITIONING) | 定位、为何开源、对比 |
| [接入指南](/product/INTEGRATION) | REST / MCP / UI 三条路径 |
| [API & MCP 参考](/reference/) | **自动生成**自 `openapi.json` 与 MCP tool table |
| [ADR](/engineering/adr/README) | 架构决策记录 |
| [应用部署](/architecture/DEPLOYMENT) | Self-host compose / gateway / backup（免费） |
| [基础设施](/architecture/INFRA) | SQLite 边界、拓扑、成本表 |
| [文档站部署](/deploy) | GitHub Pages / Cloudflare Pages（免费） |

## 硬约定

- 金额 = **整数分（cents）**
- 写操作必须带 **`Idempotency-Key`**
- 错误体：`{ code, message, hint?, retryable }`
- 三角色 + agent scopes：`customer` / `merchant` / `agent` + `agent:customer` / `agent:merchant`

更多细节见根目录 [README](https://github.com/adlternative/agent-commerce#readme)。
