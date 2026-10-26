# Agent Commerce

面向 **人 + 商家 + AI Agent** 的完整电商服务：同一套领域模型，同时提供 HTTP API、MCP 工具，以及顾客前台 / 商家后台。

## 快速开始

```bash
npm ci
npm test
npm run build

# API（默认 :8787，写入 data/commerce.json，并种子演示商品）
npm run server

# 顾客前台 + 商家后台（Vite :5173，代理 /api → :8787）
npm run dev
# 打开 http://localhost:5173/ 与 http://localhost:5173/#/merchant

# MCP stdio
npm run mcp
```

演示 Bearer Token：`customer-token` / `merchant-token` / `agent-token`。

## 能力一览

| 调用方 | 入口 |
|--------|------|
| 顾客 | Web UI · `/api/customer/*` |
| 商家 | `#/merchant` · `/api/merchant/*` |
| AI Agent | MCP（16 tools）· `/api/agent/*` · `/.well-known/ai-commerce.json` |

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

## 脚本

| 命令 | 作用 |
|------|------|
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | typecheck + Vite build |
| `npm run openapi` | 重新生成 `docs/openapi.json` |
| `npm run openapi:check` | 校验已提交的 OpenAPI 与生成结果一致 |
| `npm run server` | HTTP API |
| `npm run mcp` / `mcp:http` | MCP stdio / Streamable HTTP |

## 技术栈

TypeScript strict · Node 22 · zod · Vitest · React 18 · Vite · `@modelcontextprotocol/sdk` · 零原生依赖的 JSON 仓储。
