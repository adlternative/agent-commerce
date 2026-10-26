# MCP — Agent Commerce

The MCP server exposes the same `CommerceService` used by the HTTP API so agents shop and operate inventory without scraping HTML.

Also see [AI-INTEGRATION.md](./AI-INTEGRATION.md) for `/.well-known/ai-commerce.json` discovery.

## Transports

| Mode | Command | Notes |
|------|---------|--------|
| **stdio** (default) | `npm run mcp` | For Cursor / Claude Desktop |
| **Streamable HTTP** (optional) | `MCP_HTTP_PORT=8790 npm run mcp:http` | Stateless per-request demo |

Data file defaults to `data/commerce.json` (`DATA_PATH` overrides).

## Tools (16)

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

All money fields are **integer cents**. Write tools take `idempotencyKey`.

## Resources

- `catalog://products` — active catalog JSON
- `orders://{id}` — single order JSON

## Prompts

- `shopping_assistant` — args: `goal`
- `merchant_ops` — args: `task`

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

Or with Node directly:

```json
{
  "mcpServers": {
    "agent-commerce": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "--experimental-transform-types",
        "src/mcp/stdio.ts"
      ],
      "cwd": "/absolute/path/to/agent-commerce"
    }
  }
}
```

## Dependency note

`@modelcontextprotocol/sdk` is required to speak the MCP protocol (stdio + Streamable HTTP). Domain validation still uses shared **zod** schemas.
