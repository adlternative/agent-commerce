# ADR 0006: E2E isomorphic with production store

- **Status:** Accepted (implementation on `main` incomplete — see below)
- **Date:** 2026-10-27

## Context

Production and Docker default to **SQLite** (`createRepository` → `STORE_BACKEND` default sqlite, `#634`). Playwright on `main` still boots the API with a temp **`.json`** `DATA_PATH` (`playwright.config.ts`), so e2e can miss SQLite-only bugs (migrations, `/readyz` RW checks, `BEGIN IMMEDIATE`). Issue [#677](https://github.com/adlternative/agent-commerce/issues/677) tracks fidelity; PR [#679](https://github.com/adlternative/agent-commerce/pull/679) (ACP-29) implements the switch.

## Decision

**End-to-end tests should use the same store backend as production (SQLite)** unless a test explicitly opts into the legacy JSON adapter.

Target shape (ACP-29 / #677):

- Default `playwright.config.ts`: `STORE_BACKEND=sqlite`, per-worker `DATA_DIR` under tmp, no `.json` `DATA_PATH`.
- Assert store identity (e.g. `/healthz` `store === 'sqlite'` and `commerce.sqlite` present) when exposed.
- Keep a **dedicated** JSON legacy config/spec for regression of `STORE_BACKEND=json`, not as the default path.

## Consequences

- E2E failures more closely match deploy reality (schema migrations, readiness, file layout under `DATA_DIR`).
- Slightly heavier fixtures (SQLite file lifecycle + teardown).
- **尚未实现 on `main` as of this ADR:** default Playwright still sets `DATA_PATH` to a `*.json` temp file in `playwright.config.ts`. Until [#679](https://github.com/adlternative/agent-commerce/pull/679) merges, treat SQLite-default e2e as in progress.

## Alternatives

1. **Keep JSON-only e2e** — rejected: false confidence vs prod SQLite.
2. **Hit a shared remote DB in CI** — rejected: flaky, not self-contained; paid services disallowed for norms.
3. **In-memory SQLite only** — acceptable subset for unit tests; full e2e should still exercise on-disk `DATA_DIR` like Docker.
