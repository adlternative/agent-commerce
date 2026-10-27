# Integration paths

Three runnable paths into the same `CommerceService`. Prerequisites: Node ≥ 22, `npm ci`, then `npm run build:server` (or rely on `preserver` / `premcp` hooks).

Demo auth below works only when `ALLOW_DEMO_TOKENS=1` or `NODE_ENV!=='production'` (`src/server/auth.ts`). Production: mint HS256 JWT with `JWT_SECRET` (`role` + agent `scopes`).

---

## Path 1 — REST + UI

### Start

```bash
JWT_SECRET=dev-only-change-me npm run server   # :8787, seeds demo catalog
# other terminal
npm run dev                                    # :5173 → proxies /api (E2E_API_PORT, default 8787)
```

Open:

- Customer UI: `http://localhost:5173/`
- Merchant UI: `http://localhost:5173/#/merchant`
- Discovery: `http://127.0.0.1:8787/.well-known/ai-commerce.json`
- OpenAPI: `http://127.0.0.1:8787/openapi.json` (= `docs/openapi.json`)

### Agent / script: search → cart → place → pay

```bash
export API=http://127.0.0.1:8787
export AUTH='authorization: Bearer agent-token'   # agent:customer

# 1) Discover
curl -sS "$API/.well-known/ai-commerce.json" | head -c 200; echo

# 2) List products (cursor envelope)
curl -sS -H "$AUTH" "$API/api/agent/products?limit=5"

# 3) Create cart (Idempotency-Key required on writes)
curl -sS -X POST -H "$AUTH" -H 'content-type: application/json' \
  -H 'Idempotency-Key: cart-demo-1' \
  -d '{"customerId":"agent_demo"}' \
  "$API/api/agent/carts"

# 4) Add line (use a productId from step 2; available > 0)
curl -sS -X POST -H "$AUTH" -H 'content-type: application/json' \
  -H 'Idempotency-Key: add-demo-1' \
  -d '{"productId":"PRODUCT_ID","quantity":1}' \
  "$API/api/agent/carts/CART_ID/items"

# 5) Place order (reserves stock)
curl -sS -X POST -H "$AUTH" -H 'content-type: application/json' \
  -H 'Idempotency-Key: order-demo-1' \
  -d '{"cartId":"CART_ID"}' \
  "$API/api/agent/orders"

# 6) Pay via customer surface (same domain pay)
curl -sS -X POST -H 'authorization: Bearer customer-token' \
  -H 'Idempotency-Key: pay-demo-1' \
  "$API/api/customer/orders/ORDER_ID/pay"
```

Routes live in `src/server/routes.ts`; schemas in `docs/openapi.json`.

---

## Path 2 — MCP stdio + Streamable HTTP

### Stdio (IDE hosts)

```bash
JWT_SECRET=dev-only-change-me npm run mcp
# entry: dist-server/mcp/stdio.js  (src/mcp/stdio.ts)
```

Cursor / Claude Desktop config:

```json
{
  "mcpServers": {
    "agent-commerce": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/agent-commerce",
      "env": {
        "JWT_SECRET": "dev-only-change-me",
        "DATA_DIR": "/absolute/path/to/agent-commerce/data"
      }
    }
  }
}
```

Tools: see `docs/MCP.md` and `TOOL_DESCRIPTIONS` in `src/mcp/tools.ts` (16) + `recommend_products` in `src/mcp/create-mcp-server.ts` → **17**.

### Streamable HTTP (network / CI)

```bash
JWT_SECRET=dev-only-change-me ALLOW_DEMO_TOKENS=1 MCP_HTTP_PORT=8790 npm run mcp:http
# auth matches REST: Bearer / X-API-Key  (src/mcp/http.ts)
```

Official SDK client (same pattern as `tests/mcp/http.smoke.test.ts`):

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const url = new URL(process.env.MCP_HTTP_URL ?? 'http://127.0.0.1:8790/')
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: {
    headers: {
      Authorization: `Bearer ${process.env.MCP_TOKEN ?? 'agent-token'}`,
    },
  },
})

const client = new Client({ name: 'demo-agent', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log(tools.map((t) => t.name))

const search = await client.callTool({
  name: 'search_products',
  arguments: { q: 'mug' },
})
console.log(search)
```

Smoke: `npm run test:mcp:http`.

Merchant MCP tools (`upsert_product`, `adjust_stock`, `list_orders`) require `merchant` or `agent:merchant` (`src/mcp/http.ts`, `src/mcp/tools.ts` actor checks).

---

## Path 3 — Merchant ops + payment webhooks

### Ship / stock over HTTP

```bash
export API=http://127.0.0.1:8787
export M='authorization: Bearer merchant-token'

# Adjust stock
curl -sS -X POST -H "$M" -H 'content-type: application/json' \
  -H 'Idempotency-Key: stock-1' \
  -d '{"delta":10}' \
  "$API/api/merchant/products/PRODUCT_ID/stock"

# Ship a paid order
curl -sS -X POST -H "$M" -H 'Idempotency-Key: ship-1' \
  "$API/api/merchant/orders/ORDER_ID/ship"

# Audit trail (filters: actor, pathPrefix, code, traceId, …)
curl -sS -H "$M" "$API/api/merchant/audit?limit=20"
```

### Simulated payment webhook (implemented)

Provider-shaped callback, **idempotent on `eventId`** — not a live PSP:

```bash
curl -sS -X POST -H "$M" -H 'content-type: application/json' \
  -d '{
    "eventId": "evt_demo_1",
    "type": "payment.captured",
    "orderId": "ORDER_ID",
    "amountCents": 1999
  }' \
  "$API/api/webhooks/payment"
```

Code: `POST /api/webhooks/payment` in `src/server/routes.ts` → `CommerceService.handlePaymentWebhook` (`src/services/commerce.ts`) · event schema `PaymentWebhookEventSchema` (`src/domain/payment.ts`).

### Real payment rails — **尚未实现**

| Missing | Plan (when prioritized) |
|---------|-------------------------|
| Stripe / Alipay / WeChat Pay / card vault | Adapter that verifies provider signatures, maps capture/fail to `PaymentWebhookEvent`, calls existing `handlePaymentWebhook` |
| Public unauthenticated webhook ingress | Today route requires `merchant` / `agent:merchant` auth — real PSPs need signature-verified public endpoint (**尚未实现**) |
| Settlement / payouts / tax | Out of domain today |

Until then: use `POST /api/customer/orders/:id/pay` or the simulated webhook above for demos and E2E.
