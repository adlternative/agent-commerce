# Architecture

Agent Commerce is an AI-native commerce stack: human customers, merchants, and AI agents share one domain model exposed via HTTP, MCP, and React UIs.

## Layers

1. **Domain** (`src/domain/*`) — zod schemas, inventory math, cart/promotion quoting, order state machine, payment/return. Amounts are integer **cents**. Errors are `DomainError` → `{ code, message, hint?, retryable }`.
2. **Repository** (`src/repo/*`) — `CommerceRepository` port with JSON-file and in-memory adapters.
3. **Service** (`src/services/commerce.ts`) — use-cases; every write takes an **Idempotency-Key**.
4. **HTTP** (`src/server/*`) — `node:http` router, Bearer role auth, OpenAPI 3.1, structured JSON logs with `traceId`, Prometheus `GET /metrics`.
5. **MCP** (`src/mcp/*`) — 16 tools + resources + prompts on the same `CommerceService`.

Backend runtime is **compiled** (`npm run build:server` → `dist-server/`) so NodeNext-style `.js` import specifiers resolve to real files. Do not run `src/**/*.ts` with `--experimental-strip-types` for server/MCP entrypoints.
6. **AI adapter** (`src/ai/*`) — well-known discovery, cursor pagination, audit log, token-bucket rate limit.
7. **UIs** — customer storefront (`src/App.tsx`) and merchant console (`src/merchant/MerchantApp.tsx`).

## Storage: intentional JSON simplification

Default persistence is a **single JSON file** (`JsonFileRepository`):

- Zero native dependencies; CI and Cloud Agents run without SQLite tooling.
- Writes use an in-process mutex + atomic rename.
- Fine for demos, evals, and single-process local runs — **not** multi-node production.

### Upgrade path to SQLite

1. Keep `CommerceRepository` as the only persistence port.
2. Add `SqliteRepository` with the same `read` / `transaction` (or finer methods later).
3. Map collections to tables; unique index on idempotency `(scope, key)`.
4. Push reserve/commit into SQL `UPDATE … WHERE on_hand - reserved >= ?`.
5. Inject `SqliteRepository` at HTTP/MCP bootstrap; domain/service stay unchanged.

## Order state machine

```
created → paid → shipped → delivered
   │        │        │         │
   └─ cancelled      └─────────┴─→ refunded
            └─ cancelled / refunded
```

- `place_order` **reserves** stock  
- `pay_order` **commits** (deducts)  
- cancel-before-pay **releases**; cancel-after-pay / return **restocks**

## Concurrency & AI safety

- Repository `transaction()` serializes writes in-process (oversell-safe for one Node process).
- Token bucket rate limit per `role:subject`.
- Audit ring buffer records method/path/status/idempotency key/`traceId` for agent debugging.
- Request logs are single-line JSON; `X-Trace-Id` correlates logs, audit, and client responses.
