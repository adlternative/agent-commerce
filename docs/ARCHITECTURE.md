# Architecture

Agent Commerce is an AI-native commerce stack: human customers, merchants, and AI agents share one domain model exposed via HTTP, MCP, and React UIs.

## Layers

1. **Domain** (`src/domain/*`) — zod schemas, inventory math, cart/promotion quoting, order state machine, payment/return. Amounts are integer **cents**. Errors are `DomainError` → `{ code, message, hint?, retryable }`.
2. **Repository** (`src/repo/*`) — `CommerceRepository` port with SQLite (default), JSON-file, and in-memory adapters.
3. **Service** (`src/services/commerce.ts`) — use-cases; every write takes an **Idempotency-Key**.
4. **HTTP** (`src/server/*`) — `node:http` router, Bearer role auth, OpenAPI 3.1, structured JSON logs with `traceId`, Prometheus `GET /metrics`.
5. **MCP** (`src/mcp/*`) — 16 tools + resources + prompts on the same `CommerceService`.

Backend runtime is **compiled** (`npm run build:server` → `dist-server/`) so NodeNext-style `.js` import specifiers resolve to real files. Do not run `src/**/*.ts` with `--experimental-strip-types` for server/MCP entrypoints.
6. **AI adapter** (`src/ai/*`) — well-known discovery, cursor pagination, audit log, token-bucket rate limit.
7. **UIs** — customer storefront (`src/App.tsx`) and merchant console (`src/merchant/MerchantApp.tsx`).

## Storage: SQLite (default)

Default persistence is **SQLite** via Node’s built-in `node:sqlite` (`SqliteRepository`):

- Collections map to tables; unique primary key on idempotency `(scope, key)`.
- Schema versions live in `schema_migrations`; applied on open (`src/repo/schema.ts`).
- Writes use an in-process mutex + `BEGIN IMMEDIATE` (oversell-safe for one Node process).
- Path: `DATA_PATH` or `data/commerce.sqlite`. Set `STORE_BACKEND=json` or a `.json` path to keep the legacy file store.

### JSON → SQLite migration

On SQLite open, if the DB is empty and a sibling `commerce.json` (or `MIGRATE_FROM_JSON`) has data, it is imported once (`migrateJsonToSqlite`). CLI:

```bash
npm run migrate -- --sqlite data/commerce.sqlite --from-json data/commerce.json
npm run migrate -- --empty-only --sqlite data/commerce.sqlite
```

### Legacy JSON file

`JsonFileRepository` remains for demos that need zero DB surface area (atomic rename + mutex). Prefer SQLite for anything beyond single-process smoke tests.

## Order state machine

```
created → paid → shipped → delivered (receive)
   │        │        │         │
   └─ cancelled      └─────────┴─→ refunded
            └─ cancelled / refunded
```

- `place_order` **reserves** stock with a **15-minute TTL** (`expiresAt`)
- `pay_order` or webhook `payment.captured` **commits** (deducts)
- webhook `payment.failed` records a failed payment; order stays `created`
- unpaid holds past `expiresAt` are **auto-released** via `releaseExpiredReservations` (also cancels the order)
- closed loop: **ship → receive (delivered) → refund** (return from paid/shipped/delivered)
- cancel-before-pay **releases**; cancel-after-pay / return **restocks**

## Concurrency & AI safety

- Repository `transaction()` serializes writes in-process (oversell-safe for one Node process).
- Token bucket rate limit per `role:subject`.
- Audit ring buffer records method/path/status/idempotency key/`traceId` for agent debugging.
- Request logs are single-line JSON; `X-Trace-Id` correlates logs, audit, and client responses.
