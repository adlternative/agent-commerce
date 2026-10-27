# ADR 0007: VitePress for the previewable docs site

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

ACP-35 needs a **previewable static docs site** sourced from `docs/`, with local `docs:dev` / `docs:build`, free hosting (GitHub Pages or Cloudflare Pages), and **auto-generated** API + MCP reference pages (no hand-copied endpoint/tool tables).

Candidates: **Docusaurus**, **VitePress**, **Astro**.

Constraints: same repo only; Node 22 + existing Vite toolchain; no paid services/domains; keep the site thin enough that CI can `docs:build` without a second package manager.

## Decision

Use **VitePress** (`vitepress` as a root `devDependency`) with content root = repo `docs/`.

- Config: `docs/.vitepress/config.mts`
- Scripts: `npm run docs:gen` / `docs:dev` / `docs:build` / `docs:check`
- API ref generated from `docs/openapi.json`; MCP tools ref generated from `ToolSchemas` + `TOOL_DESCRIPTIONS` (+ `recommend_products`)
- Default `base` = `/agent-commerce/` for GitHub project Pages; override with `DOCS_BASE`

## Consequences

- Reuses the repo’s Vite mental model; one `npm ci` installs app + docs tooling.
- Markdown already under `docs/` becomes pages with minimal relocation.
- Generated files live in `docs/reference/*.generated.md` and must stay in sync via `docs:check`.
- Docusaurus/Astro remain viable later if we need versioned docs or MDX-heavy marketing pages.

## Alternatives

| Option | Why not now |
|--------|-------------|
| **Docusaurus** | Heavier React docs framework; stronger versioning, but more deps and config than we need for a single-version reference site. |
| **Astro** | Excellent content sites, but less “docs-native” (sidebar/nav/search) out of the box than VitePress; would invent more structure. |
