# Architecture Decision Records

Lightweight ADRs for Agent Commerce. Each record captures **Context**, **Decision**, **Consequences**, and **Alternatives**. Status claims cite code paths or are marked **尚未实现**.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-zod-single-validation-source.md) | Zod as single validation source → OpenAPI | Accepted |
| [0002](./0002-json-then-sqlite-dual-backend.md) | JSON then SQLite dual backend | Accepted |
| [0003](./0003-shared-domain-service-rest-mcp.md) | Shared domain service for REST + MCP | Accepted |
| [0004](./0004-fail-closed-auth-jwt-api-key.md) | Fail-closed auth (JWT + API Key) | Accepted |
| [0005](./0005-integer-cents.md) | Integer cents for money | Accepted |
| [0006](./0006-e2e-isomorphic-with-prod.md) | E2E isomorphic with production store | Accepted (landed [#679](https://github.com/adlternative/agent-commerce/pull/679) / [#677](https://github.com/adlternative/agent-commerce/issues/677); `playwright.config.ts` defaults to SQLite) |
| [0007](./0007-vitepress-docs-site.md) | VitePress for previewable docs site | Accepted |
| [0008](./0008-pwa-first-mobile.md) | PWA-first mobile (defer Expo / React Native) | Accepted |

## Template

Copy into `NNNN-slug.md`:

```markdown
# ADR NNNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD

## Context

What forces the decision? Cite relevant code or mark gaps **尚未实现**.

## Decision

What we chose and where it lives in the repo.

## Consequences

Positive and negative outcomes; operational constraints.

## Alternatives

Options considered and why they were rejected.
```

Number ADRs monotonically (`0009-…` next). Link new records from this index table.
