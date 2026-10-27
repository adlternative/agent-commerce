# ADR 0002: JSON then SQLite dual backend

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Early demos needed zero-DB persistence (`JsonFileRepository` / `MemoryRepository` in `src/repo/json-repository.ts`). Production-shaped concurrency, migrations, and readiness probes need SQLite. Callers (HTTP, MCP, migrate CLI) must share one factory and path rules (`DATA_DIR` / `DATA_PATH`).

## Decision

Keep a **dual backend** behind `CommerceRepository` (`src/repo/types.ts`):

- **Default:** SQLite via Node `node:sqlite` (`src/repo/sqlite-repository.ts`), opened by `createRepository()` in `src/repo/create-repository.ts`.
- **Legacy / explicit:** JSON file when `STORE_BACKEND=json` or the path ends with `.json`.
- Path order: `dataPath` → `DATA_PATH` → `$DATA_DIR/commerce.sqlite` (or `.json`); `DATA_DIR` defaults to `./data` (`src/repo/data-dir.ts`).
- Empty SQLite may one-shot import sibling `commerce.json` / `MIGRATE_FROM_JSON` (`migrate-json.ts`); CLI: `npm run migrate`.

## Consequences

- Prod and Docker prefer SQLite; demos can still use JSON without a second codebase.
- Schema versions live in `schema_migrations` (`src/repo/schema.ts`); JSON has no SQL migrations — feature work must not assume JSON-only semantics.
- Concurrency model is single Node process (mutex + `BEGIN IMMEDIATE`); multi-process writers are **尚未实现**.

## Alternatives

1. **SQLite only, delete JSON** — deferred: still useful for ultra-light demos and regression of file store.
2. **Postgres / remote DB** — **尚未实现**; out of scope for self-hosted single-node MVP; would replace the port implementation, not the service layer.
3. **ORM (Drizzle/Prisma)** — rejected for now: `node:sqlite` + explicit SQL keeps the dependency surface paid-service-free and small.
