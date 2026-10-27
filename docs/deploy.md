---
title: 部署文档站
description: Free GitHub Pages or Cloudflare Pages setup for the VitePress docs site
---

# 部署（文档站）

> 这是 **文档站** 的 Pages/CF 发布说明。要自托管 **Agent Commerce 应用**（Docker / Caddy / Prometheus / SQLite backup），见 [应用部署](/architecture/DEPLOYMENT) 与 [基础设施](/architecture/INFRA)。

本仓库用 **VitePress** 把 `docs/` 编成静态站。构建产物目录：`docs/.vitepress/dist`。

代理（agent）**不能**改 GitHub / Cloudflare 仓库设置；下列步骤需仓库 **owner/admin** 完成一次。

本地预览：

```bash
npm ci
npm run docs:dev          # http://localhost:5173/agent-commerce/
DOCS_BASE=/ npm run docs:dev   # 若要以根路径预览
npm run docs:build
npm run docs:preview
```

默认 `base` 为 `/agent-commerce/`（GitHub project Pages）。根域名托管时设 `DOCS_BASE=/`。

---

## 选项 A — GitHub Pages（免费）

### 1. 启用 Pages

Repo → **Settings → Pages**：

1. **Source**: GitHub Actions（推荐；与本仓库 `.github/workflows/docs.yml` 对齐）
2. 或 Source = Deploy from branch → branch `gh-pages` / folder `/ (root)`（若改用 branch 发布）

### 2. 工作流

已提供 [`.github/workflows/docs.yml`](https://github.com/adlternative/agent-commerce/blob/main/.github/workflows/docs.yml)：

- 触发：`main` 上 `docs/**`、`src/mcp/**`、`scripts/gen-docs-reference.ts`、`package.json` 变更，或手动 `workflow_dispatch`
- 步骤：`npm ci` → `npm run docs:build` → `actions/upload-pages-artifact` → `actions/deploy-pages`

Owner 首次启用 Actions Pages 后，站点约为：

`https://adlternative.github.io/agent-commerce/`

### 3. 权限

Settings → Actions → General → Workflow permissions：允许 **Read and write**（或单独给 `pages: write` + `id-token: write`，workflow 已声明）。

---

## 选项 B — Cloudflare Pages（免费）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → Connect to Git  
2. 选中 `adlternative/agent-commerce`（只读连接即可；无需付费域名）
3. Build 配置：

| Field | Value |
|-------|--------|
| Framework preset | None / Vite |
| Build command | `npm run docs:build` |
| Build output directory | `docs/.vitepress/dist` |
| Root directory | `/` (repo root) |
| Environment variable | `DOCS_BASE=/`（使用 `*.pages.dev` 根路径时）或 `DOCS_BASE=/agent-commerce/` |

4. 保存后每次 `main` push 自动构建。免费 `*.pages.dev` 子域足够预览；自定义域名可选且非必须。

---

## 校验清单

- [ ] `npm run docs:build` 本地成功
- [ ] `npm run docs:check` 无 generated 漂移
- [ ] Pages / Cloudflare 构建日志绿色
- [ ] 打开站点：Getting Started / 产品价值 / 接入指南 / API & MCP / ADR / 部署 均可导航
- [ ] API 与 MCP 参考页含生成页眉（非手抄表）
