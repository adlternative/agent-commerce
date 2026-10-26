# HTTP API

Base URL (local): `http://127.0.0.1:8787`  
OpenAPI 3.1: [`openapi.json`](./openapi.json) · `GET /openapi.json`  
Auth: `Authorization: Bearer <token>`

| Token | Role |
|-------|------|
| `customer-token` | customer |
| `merchant-token` | merchant |
| `agent-token` | agent |

Writes require header **`Idempotency-Key`**. Errors:

```json
{ "code": "INSUFFICIENT_STOCK", "message": "...", "hint": "...", "retryable": false }
```

## Customer `/api/customer/*`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/products` | `q`, `tag`; optional `cursor`/`limit` |
| GET | `/products/:id` | includes `agentNotes` |
| GET | `/inventory/:productId` | `available` |
| POST | `/carts` | body `{ customerId? }` |
| GET | `/carts/:id` | |
| POST | `/carts/:id/items` | `{ productId, quantity }` |
| PATCH | `/carts/:id/items/:productId` | `{ quantity }` |
| DELETE | `/carts/:id/items/:productId` | Idempotency-Key required |
| POST | `/carts/:id/promotion` | `{ code }` |
| GET | `/carts/:id/quote` | cents totals |
| POST | `/orders` | `{ cartId }` → reserve |
| GET | `/orders/:id` | |
| POST | `/orders/:id/pay` | commit stock |
| POST | `/orders/:id/cancel` | |
| POST | `/orders/:id/returns` | `{ reason }` |

## Merchant `/api/merchant/*`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/metrics` | GMV / orders / OOS |
| GET | `/products` | `activeOnly=false` for all |
| POST | `/products` | upsert |
| PUT | `/products/:id` | upsert by id |
| POST | `/products/:id/stock` | `{ delta }` |
| GET | `/inventory/:productId` | |
| GET | `/orders` | filters + optional cursor |
| POST | `/orders/:id/ship` | |
| POST | `/orders/:id/deliver` | |
| POST | `/promotions` | threshold / percent / fixed |

## Agent `/api/agent/*`

Mirrors shopping + merchant ops for LLM clients (same `CommerceService`). Extra:

| Method | Path | Notes |
|--------|------|-------|
| GET | `/audit` | recent audit events |

## Public

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/openapi.json` |
| GET | `/.well-known/ai-commerce.json` |

## Cursor pagination

Pass `?limit=20&cursor=<opaque>`. Response when paging:

```json
{ "items": [], "nextCursor": "...", "hasMore": true }
```
