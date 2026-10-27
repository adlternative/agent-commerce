# MCP — Agent Commerce

The MCP server exposes the same `CommerceService` used by the HTTP API so agents shop and operate inventory without scraping HTML.

Also see [AI-INTEGRATION.md](./AI-INTEGRATION.md) for `/.well-known/ai-commerce.json` discovery.

## Transports

| Mode | Command | Notes |
|------|---------|--------|
| **stdio** (default) | `npm run mcp` | For Cursor / Claude Desktop |
| **Streamable HTTP** (optional) | `MCP_HTTP_PORT=8790 npm run mcp:http` | Stateless per-request demo (`sessionIdGenerator: undefined`) |

Data file defaults to `data/commerce.json` (`DATA_PATH` overrides).

CI runs a real-client smoke with the official SDK: `npm run test:mcp:http` (also wired in GitHub Actions).

### Streamable HTTP client (official SDK)

Prefer **stdio** for local IDE hosts; use **Streamable HTTP** when the agent talks over the network (or CI).

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const url = new URL(process.env.MCP_HTTP_URL ?? 'http://127.0.0.1:8790/')

// Auth headers travel on every request via requestInit (Bearer JWT and/or API key).
// This demo HTTP transport accepts them; wire verification when you front MCP with a gateway.
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: {
    headers: {
      Authorization: `Bearer ${process.env.MCP_TOKEN ?? ''}`,
      'X-API-Key': process.env.MCP_API_KEY ?? '',
    },
  },
})

const client = new Client({ name: 'my-agent', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
const search = await client.callTool({
  name: 'search_products',
  arguments: { q: 'mug' },
})
```

Transport choice:

- **stdio** — subprocess, no HTTP auth headers; use env / process identity.
- **Streamable HTTP** — pass credentials in `requestInit.headers` as above (`Authorization`, `X-API-Key`, or both).

## Tools (17)

| Tool | Purpose |
|------|---------|
| `search_products` | Catalog search (`q`, `tag`) |
| `get_product` | Product detail + `agentNotes` |
| `check_inventory` | `onHand` / `reserved` / `available` |
| `create_cart` | Empty cart (`idempotencyKey` required) |
| `add_cart_item` | Add/increase line |
| `update_cart_item` | Set absolute qty (`0` removes) |
| `remove_cart_item` | Drop line |
| `apply_promotion` | Attach coupon / 满减 code |
| `quote_cart` | Subtotal / discount / total (cents) |
| `place_order` | Reserve stock → `created` |
| `get_order` | Order status |
| `cancel_order` | Cancel + release/restock |
| `request_return` | Refund paid/shipped/delivered |
| `upsert_product` | Merchant create/update |
| `adjust_stock` | Merchant stock delta |
| `list_orders` | Filter by customer/status |
| `recommend_products` | MCP **sampling** (`createMessage`) recommendation; catalog fallback if client has no sampling |

All money fields are **integer cents**. Write tools take `idempotencyKey`.

Tool errors return `{ code, message, hint?, retryable, mcpErrorCode }` where `mcpErrorCode` is the mapped JSON-RPC code (`InvalidParams` / `InvalidRequest` / `InternalError`).

## Resources

- `catalog://products` — active catalog JSON
- `products://{id}` — single product JSON (**list** + **completion** on `id`)
- `orders://{id}` — single order JSON (**list** + **completion** on `id`)

Missing ids throw MCP `InvalidParams` with domain body in `error.data`.

## Prompts

- `shopping_assistant` — args: `goal` (completable suggestions); user + assistant turns with cents / idempotency rules
- `merchant_ops` — args: `task` (completable); requires `check_inventory` after stock changes

## Cursor / client config (paste)

```json
{
  "mcpServers": {
    "agent-commerce": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/agent-commerce",
      "env": {
        "DATA_PATH": "/absolute/path/to/agent-commerce/data/commerce.json"
      }
    }
  }
}
```

Or with the compiled entrypoint (preferred; `npm run mcp` builds first):

```json
{
  "mcpServers": {
    "agent-commerce": {
      "command": "node",
      "args": ["dist-server/mcp/stdio.js"],
      "cwd": "/absolute/path/to/agent-commerce",
      "env": {
        "DATA_PATH": "/absolute/path/to/agent-commerce/data/commerce.json"
      }
    }
  }
}
```

Do **not** run TypeScript sources with `node --experimental-strip-types`: relative `.js` imports are not rewritten to `.ts`, so runtime fails with `ERR_MODULE_NOT_FOUND`.

## Dependency note

`@modelcontextprotocol/sdk` is required to speak the MCP protocol (stdio + Streamable HTTP). Domain validation still uses shared **zod** schemas.
