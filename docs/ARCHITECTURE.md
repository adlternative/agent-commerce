# Architecture

Agent Commerce is an AI-native commerce core: human customers, merchants, and AI agents share one domain model exposed later via HTTP and MCP.

## Layers

1. **Domain** (`src/domain/*`) — pure types, zod schemas, state machines, inventory math. Amounts are always integer **cents (分)**. Errors serialize to `{ code, message, hint?, retryable }`.
2. **Repository** (`src/repo/*`) — persistence port (`CommerceRepository`) with a JSON-file adapter and an in-memory adapter for tests.
3. **Service** (`src/services/commerce.ts`) — use-cases (cart, place order, pay, ship, return). Every write accepts an **Idempotency-Key**.

## Storage: intentional JSON simplification

The default store is a **single JSON file** (`JsonFileRepository`):

- Zero native dependencies; CI and Cloud Agents can run without SQLite tooling.
- Writes go through an in-process mutex and atomic rename.
- Suitable for demos, evals, and single-process local runs — **not** multi-node production.

### Upgrade path to SQLite

1. Keep `CommerceRepository` as the only persistence port.
2. Add `SqliteRepository` implementing the same `read` / `transaction` methods (or finer-grained methods once traffic demands it).
3. Map collections (`products`, `stock`, `orders`, …) to tables; put idempotency records in a unique `(scope, key)` index.
4. Move inventory reserve/commit into SQL transactions (`UPDATE … WHERE on_hand - reserved >= ?`) so multi-process safety matches the in-process mutex.
5. Swap construction site (HTTP/MCP bootstrap) to inject `SqliteRepository`; domain and service code stay unchanged.

## Order state machine

```
created → paid → shipped → delivered
   │        │        │         │
   └─ cancelled      └─────────┴─→ refunded
            └─ cancelled / refunded
```

Stock is **reserved** at `place_order`, **committed** (deducted) at `pay_order`, **released** on cancel-before-pay, and **restocked** on cancel-after-pay / return refund.

## Concurrency

`InventoryLedger` (unit tests) and repository `transaction()` serialize mutations so concurrent reserves cannot oversell within one process.
