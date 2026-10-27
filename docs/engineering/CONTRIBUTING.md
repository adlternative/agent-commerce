# Contributing to Agent Commerce

Engineering norms for [adlternative/agent-commerce](https://github.com/adlternative/agent-commerce). Architecture decisions live in [`adr/`](./adr/README.md). Security reporting and threat notes: [`SECURITY.md`](./SECURITY.md).

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` | Only green, squash-merged work. Default base for PRs. |
| `adl/dev/<descriptive-name>-xxxx` | Feature / fix / docs branches. Lowercase only. |

Rules:

1. Branch from an up-to-date `origin/main` (`git fetch origin main && git checkout -b … origin/main`).
2. One concern per branch/PR (feature, fix, or docs pack). Do not mix unrelated refactors.
3. Rebase onto `main` before merge when the PR is behind or conflicts; resolve `TASKS.md` / `README.md` carefully when parallel docs PRs touch them.
4. After squash-merge, delete the feature branch.
5. **Only this repo.** Never create or fork repositories for this project. If `git push` fails, stop and report the raw error — do not work around with forks or alternate remotes.

## Commit conventions

Prefer Conventional Commits scoped by ACP id when applicable:

```
feat(acp-NN): short imperative summary
fix(acp-NN): …
docs(acp-NN): …
chore(acp-NN): …
test(acp-NN): …
```

- Subject ≤ ~72 chars; body explains *why* when non-obvious.
- Claims in commit/PR bodies that describe product behavior must cite a repo path (e.g. `src/server/auth.ts`) or be labeled **尚未实现**.
- Do not commit secrets, local `data/`, or generated `dist/` / `dist-server/` artifacts (see `.gitignore`).

## Pull request checklist

Before requesting review / merge:

- [ ] `npm run typecheck` and `npm run build:server` pass
- [ ] `npm run test:unit` green; run `npm run test:e2e` when UI/server/boot paths change
- [ ] `npm run openapi:check` when touching Zod schemas, routes, or OpenAPI generation
- [ ] New/changed behavior has tests; **不许放宽已有断言** — never weaken, skip, or delete existing assertions to make CI green. Fix the product or update tests only when the contract intentionally changes (document why in the PR).
- [ ] Docs updated when contracts change (`docs/API.md`, `docs/MCP.md`, `docs/ARCHITECTURE.md`, ADRs)
- [ ] `TASKS.md` row registered / status updated for the ACP id
- [ ] No paid third-party services introduced without an explicit product decision
- [ ] PR description includes intended merge line shape: `ACP-NN + PR#N + <sha> + test counts`

Merge gate: CI green on the tip commit; squash-merge only; never merge with failing or skipped required checks.

## Review standards

Reviewers check:

1. **Correct layer** — domain purity, service orchestration, repo I/O, thin HTTP/MCP adapters (see [Code style & layering](#code-style--layering)).
2. **Auth fail-closed** — production requires `JWT_SECRET`; demo tokens gated; forged legacy secrets stay rejected (`src/server/auth.ts`).
3. **Money** — integer cents only (`src/domain/money.ts`); no floats in APIs or persistence.
4. **Idempotency** — writes go through `CommerceService` with `Idempotency-Key`.
5. **Assertions** — reject PRs that soften tests (“不许放宽已有断言”).
6. **OpenAPI sync** — Zod remains the single validation source; OpenAPI is derived (`src/server/openapi.ts`).
7. **Scope honesty** — mark gaps **尚未实现** rather than implying paid rails, multi-tenant SaaS, etc.

## Code style & layering

Runtime is **compiled** TypeScript (`npm run build:server` → `dist-server/`). Prefer ESM `.js` import specifiers in `src/**` as required by `tsconfig.server.json`.

### Layer map

| Layer | Path | Responsibility | Must not |
|-------|------|----------------|----------|
| **Domain** | `src/domain/*` | Zod schemas, pure state machines, inventory/cart/order/payment/return math, `DomainError` | Touch filesystem, HTTP, MCP SDK, env I/O |
| **Services** | `src/services/commerce.ts` | Use-cases over `CommerceRepository`; idempotent writes; shared by REST + MCP | Parse raw HTTP; duplicate Zod that belongs in domain |
| **Repo** | `src/repo/*` | `CommerceRepository` port + SQLite/JSON/memory adapters, migrations, `DATA_DIR` | Business rules beyond persistence invariants |
| **Server** | `src/server/*` | `node:http` router, auth, OpenAPI, metrics/logs, route handlers → service | Re-implement domain transitions inline |
| **MCP** | `src/mcp/*` | Tools/resources/prompts/sampling on the same `CommerceService`; HTTP/stdio transports | Separate persistence or divergent auth rules for Streamable HTTP |

Supporting packages:

- `src/ai/*` — discovery, cursor pagination, audit ring buffer, token-bucket rate limit (wired in `create-server.ts` / `router.ts`).
- `src/api/*` — browser clients for customer/merchant UIs (not the HTTP server).
- UI — `src/App.tsx` (customer), `src/merchant/MerchantApp.tsx` (merchant).

Dependency direction: **UI/api → server|mcp → services → domain ← repo adapters**. Domain never imports server/mcp/repo implementations.

### Style notes

- Validate at boundaries with Zod (`src/domain/*`, `src/server/request-schemas.ts`); derive OpenAPI via `zodToJsonSchema` (`src/server/openapi.ts`) — see [ADR 0001](./adr/0001-zod-single-validation-source.md).
- Default persistence is SQLite; JSON remains a dual backend — [ADR 0002](./adr/0002-json-then-sqlite-dual-backend.md).
- One `CommerceService` for REST and MCP — [ADR 0003](./adr/0003-shared-domain-service-rest-mcp.md).
- Auth is JWT + API Key, fail-closed in production — [ADR 0004](./adr/0004-fail-closed-auth-jwt-api-key.md).
- Monetary fields are integer cents — [ADR 0005](./adr/0005-integer-cents.md).
- E2E should match production store backend — [ADR 0006](./adr/0006-e2e-isomorphic-with-prod.md).

## Local commands (quick)

```bash
npm run typecheck
npm run build:server
npm run test:unit
npm run test:e2e
npm run openapi:check
npm run server          # after build:server; PORT default 8787
npm run mcp             # stdio MCP
npm run mcp:http        # Streamable HTTP MCP; MCP_HTTP_PORT default 8790
```
