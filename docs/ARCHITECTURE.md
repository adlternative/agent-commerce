# Architecture

Agent Commerce is an AI-native commerce stack: human customers, merchants, and AI agents share one domain model exposed via HTTP, MCP, and React UIs.

## Layers

1. **Domain** (`src/domain/*`) — zod schemas, inventory math, cart/promotion quoting, order state machine, payment/return. Amounts are integer **cents**. Errors are `DomainError` → `{ code, message, hint?, retryable }`.
2. **Repository** (`src/repo/*`) — `CommerceRepository` port with SQLite (default), JSON-file, and in-memory adapters.
3. **Service** (`src/services/commerce.ts`) — use-cases; every write takes an **Idempotency-Key**.
4. **HTTP** (`src/server/*`) — `node:http` router, API Key + opaque Bearer + HS256 JWT auth, three-role RBAC with agent scopes (`agent:customer` / `agent:merchant`), OpenAPI 3.1, structured JSON logs with `traceId`, Prometheus `GET /metrics`; optional `STATIC_DIR` serves the Vite `dist/` SPA.
5. **MCP** (`src/mcp/*`) — 17 tools + resources (templates + completion) + polished prompts + domain→MCP error mapping + sampling (`recommend_products`) on the same `CommerceService`.

Backend runtime is **compiled** (`npm run build:server` → `dist-server/`) so NodeNext-style `.js` import specifiers resolve to real files. Do not run `src/**/*.ts` with `--experimental-strip-types` for server/MCP entrypoints.
6. **AI adapter** (`src/ai/*`) — well-known discovery, cursor pagination, audit log, token-bucket rate limit.
7. **UIs** — customer storefront (`src/App.tsx`) and merchant console (`src/merchant/MerchantApp.tsx`).

## Storage: SQLite (default)

Default persistence is **SQLite** via Node’s built-in `node:sqlite` (`SqliteRepository`):

- Collections map to tables; unique primary key on idempotency `(scope, key)`.
- Schema versions live in `schema_migrations`; applied on open (`src/repo/schema.ts`).
- Writes use an in-process mutex + `BEGIN IMMEDIATE` (oversell-safe for one Node process).
- Path: `DATA_PATH` (explicit file) or `$DATA_DIR/commerce.sqlite`. `DATA_DIR` defaults to `./data` and is honored by HTTP, MCP, and migrate CLI. Set `STORE_BACKEND=json` or a `.json` path to keep the legacy file store.

### JSON → SQLite migration

On SQLite open, if the DB is empty and a sibling `commerce.json` (or `MIGRATE_FROM_JSON`) has data, it is imported once (`migrateJsonToSqlite`). CLI:

```bash
npm run migrate -- --sqlite data/commerce.sqlite --from-json data/commerce.json
npm run migrate -- --empty-only --sqlite data/commerce.sqlite
```

### Legacy JSON file

`JsonFileRepository` remains for demos that need zero DB surface area (atomic rename + mutex). Prefer SQLite for anything beyond single-process smoke tests.

## Docker deploy (auth)

- Compose / runtime **require** `JWT_SECRET` — no insecure default (`dev-docker-change-me` is banned from compose). Generate with `openssl rand -hex 32`.
- `NODE_ENV=production` without `JWT_SECRET` → process refuses to start and prints the openssl hint.
- `ALLOW_DEMO_TOKENS` defaults to **0** in compose; set `1` only for local demos. Production demo opaque tokens stay fail-closed unless explicitly enabled.

## Order state machine

```
created → paid → shipped → delivered (receive)
   │        │        │         │
   │        ├────────┼─────────┼─→ partially_refunded ──→ refunded
   │        └────────┴─────────┴─→ refunded
   └─ cancelled
```

- `place_order` **reserves** stock with a **15-minute TTL** (`expiresAt`)
- `pay_order` or webhook `payment.captured` **commits** (deducts)
- webhook `payment.failed` records a failed payment; order stays `created`
- unpaid holds past `expiresAt` are **auto-released** via `releaseExpiredReservations` (also cancels the order)
- closed loop: **ship → receive (delivered) → return request → merchant approve → refund**
- cancel-before-pay **releases**; cancel-after-pay / approved return **restocks**

## Return / refund state machine

```
ReturnRequest:
  requested ──approve──→ approved ──(service)──→ refunded
      │
      └──reject──→ rejected (terminal)

Order on approve:
  - full line coverage or amountCents exhausts remaining total → order.refunded (+ payment.refunded)
  - otherwise → order.partially_refunded (payment stays captured; further returns allowed for remaining qty)

Refund amounts are integer cents: never negative, never exceed order.totalCents (minus prior active returns).
Customer selects lines + reason (`POST …/returns`); merchant lists/approves/rejects (`GET/POST /api/merchant/returns…`).
Duplicate open returns for the same order are rejected (`DUPLICATE_RETURN`).
Qty above ordered (including prior non-rejected returns) → `RETURN_QTY_EXCEEDS_ORDERED`.
Already fully `refunded` orders cannot return again (`ORDER_NOT_RETURNABLE`).
```

## Concurrency & AI safety

- Repository `transaction()` serializes writes in-process (oversell-safe for one Node process).
- Token bucket rate limit per `role:subject` (pressure-tested); `Retry-After` on `429`.
- Audit ring buffer records method/path/status/idempotency key/`traceId`; query via `/api/agent/audit` or `/api/merchant/audit`.
- Request logs are single-line JSON; `X-Trace-Id` correlates logs, audit, and client responses.
- Auth credentials never require new npm deps (JWT via `node:crypto` HMAC).
