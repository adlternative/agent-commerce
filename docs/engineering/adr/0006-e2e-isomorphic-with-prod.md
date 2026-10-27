# ADR 0006: E2E isomorphic with production store

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Production and Docker default to **SQLite** (`createRepository` → `STORE_BACKEND` default sqlite, `#634`). Early Playwright boots used a temp **`.json`** `DATA_PATH`, so e2e could miss SQLite-only bugs (migrations, `/readyz` RW checks, `BEGIN IMMEDIATE`). Issue [#677](https://github.com/adlternative/agent-commerce/issues/677) / ACP-29 [#679](https://github.com/adlternative/agent-commerce/pull/679) aligned default e2e with production.

## Decision

**End-to-end tests use the same store backend as production (SQLite)** unless a test explicitly opts into the legacy JSON adapter.

Implemented shape (`playwright.config.ts` on `main` @ `#679`):

- Default config: `STORE_BACKEND=sqlite`, per-worker `DATA_DIR` under tmp, `DATA_PATH` cleared (empty), no `.json` store path.
- `/healthz` may expose `store`; specs assert SQLite when checking fidelity (`e2e/store-backend-sqlite.spec.ts`).
- Dedicated `playwright.json-legacy.config.ts` + `e2e/json-legacy-store.spec.ts` (ignored by default `testIgnore`) for `STORE_BACKEND=json` regression.
- `e2e/global-teardown.ts` removes recorded `DATA_DIR` trees under `/tmp`.

## Consequences

- E2E failures more closely match deploy reality (schema migrations, readiness, file layout under `DATA_DIR`).
- Slightly heavier fixtures (SQLite file lifecycle + teardown).
- JSON remains available for explicit legacy coverage, not as the default CI path.

## Alternatives

1. **Keep JSON-only e2e** — rejected: false confidence vs prod SQLite.
2. **Hit a shared remote DB in CI** — rejected: flaky, not self-contained; paid services disallowed for norms.
3. **In-memory SQLite only** — acceptable subset for unit tests; full e2e should still exercise on-disk `DATA_DIR` like Docker.
