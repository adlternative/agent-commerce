---
title: API & MCP 参考
description: Auto-generated HTTP API and MCP tool reference
---

# API & MCP 参考

本分区的详细页面**全部由脚本生成**，禁止手抄接口表：

| 页面 | 源 | 命令 |
|------|----|------|
| [API（OpenAPI 生成）](./api.generated) | [`docs/openapi.json`](../openapi.json) | `npm run docs:gen` |
| [MCP Tools（代码生成）](./mcp-tools.generated) | `src/mcp/tools.ts` + `src/mcp/sampling.ts` | `npm run docs:gen` |

叙事性说明（人工维护）：

- [HTTP API 说明](/API) — 鉴权、RBAC、约定
- [MCP 说明](/MCP) — 传输、resources、prompts、客户端配置
- [AI 集成](/AI-INTEGRATION) — well-known、分页、审计、限流

```bash
npm run docs:gen     # 重写 reference/*.generated.md
npm run docs:dev     # gen + VitePress dev
npm run docs:build   # gen + VitePress build
npm run docs:check   # gen 后确认 generated 文件已提交且无漂移
```
