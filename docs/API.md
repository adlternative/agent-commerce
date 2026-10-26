# HTTP API

Base URL (local): `http://127.0.0.1:8787`  
OpenAPI 3.1: [`openapi.json`](./openapi.json) · `GET /openapi.json`  
Auth (any one):

| Scheme | Credential | Role |
|--------|------------|------|
| `Authorization: Bearer` | `customer-token` / `merchant-token` / `agent-token` | opaque demo tokens |
| `Authorization: Bearer` | HS256 JWT `{ sub, role, iat?, exp? }` | minted with server JWT secret |
| `X-API-Key` or `Authorization: ApiKey` | `customer-key` / `merchant-key` / `agent-key` | API keys |

RBAC surfaces: **customer** → customer+agent; **merchant** → merchant+agent; **agent-only** → agent; **audit** → agent+merchant. Wrong role → `403 FORBIDDEN`.

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
| POST | `/orders` | `{ cartId }` → reserve (15m hold TTL) |
| GET | `/orders/:id` | |
| POST | `/orders/:id/pay` | commit stock |
| POST | `/orders/:id/cancel` | |
| POST | `/orders/:id/receive` | shipped → delivered |
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
| GET | `/audit` | same query API as agent audit |
| POST | `/orders/:id/ship` | |
| POST | `/orders/:id/deliver` | |
| POST | `/orders/:id/receive` | alias of deliver (receive verb) |
| POST | `/reservations/release-expired` | release timed-out holds; cancel unpaid |
| POST | `/promotions` | threshold / percent / fixed |

## Webhooks

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/webhooks/payment` | body `{ eventId, type: payment.captured\|payment.failed, orderId, amountCents? }`; idempotent on `eventId` (merchant/agent Bearer) |

## Agent `/api/agent/*`

Mirrors shopping + merchant ops for LLM clients (same `CommerceService`). Extra:

| Method | Path | Notes |
|--------|------|-------|
| GET | `/audit` | query audit (`actor`, `role`, `method`, `pathPrefix`, `pathContains`, `status`, `code`, `traceId`, `since`, `until`, `limit`) |

## Public

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | liveness |
| GET | `/metrics` | Prometheus text (`http_requests_total`, duration sum/count) |
| GET | `/openapi.json` | OpenAPI 3.1 document |
| GET | `/.well-known/ai-commerce.json` | AI capability discovery |

## Observability

- Every response includes **`X-Trace-Id`**. Clients may send `X-Trace-Id` or W3C `traceparent` to continue a trace; otherwise the server mints one.
- Structured JSON logs (stdout) carry the same `traceId` on `request.start` / `request.end` / `request.error`.
- Audit events (`GET /api/agent/audit` or `/api/merchant/audit`) include `traceId` when recorded from HTTP; support filter query params.
- Rate limit: per `role:subject` token bucket; exhausted → `429 RATE_LIMITED` + `Retry-After`.

## Cursor pagination

Pass `?limit=20&cursor=<opaque>`. Response when paging:

```json
{ "items": [], "nextCursor": "...", "hasMore": true }
```

Product search cursors are **stable keysets** (`score`, `id`) over ranked results (FTS with Chinese character fallback; `agentNotes` participates in ranking). Merchant order lists still use opaque offset cursors.
