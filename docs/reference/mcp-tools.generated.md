---
title: MCP Tools 参考（代码生成）
description: Auto-generated from src/mcp/tools.ts + sampling.ts — do not hand-edit.
---

# MCP Tools 参考

> **Generated** from `TOOL_DESCRIPTIONS` / `ToolSchemas` in [`src/mcp/tools.ts`](../../src/mcp/tools.ts)
> plus `recommend_products` / `RecommendProductsSchema` in [`src/mcp/sampling.ts`](../../src/mcp/sampling.ts).
> Do not hand-copy the tool table — change the code and run `npm run docs:gen`.

## Tools (17)

| Tool | Purpose |
|------|---------|
| [`search_products`](#search_products) | Search the active catalog. Prefer this before creating a cart. Returns products with priceCents (integer 分) and agentNotes for LLM-friendly selling points. |
| [`get_product`](#get_product) | Fetch one product by id, including agentNotes and priceCents. Use after search_products when you need full detail. |
| [`check_inventory`](#check_inventory) | Return onHand, reserved, and available units for a product. Call before add_cart_item when quantity is large. |
| [`create_cart`](#create_cart) | Create an empty shopping cart for a customer. Always pass a fresh Idempotency key unless intentionally replaying. |
| [`add_cart_item`](#add_cart_item) | Add (or increase) a product line on a cart. Fails with INSUFFICIENT_STOCK if quantity exceeds available. |
| [`update_cart_item`](#update_cart_item) | Set absolute quantity for a cart line. Quantity 0 removes the item. Stock-checked against available. |
| [`remove_cart_item`](#remove_cart_item) | Remove a product line from the cart entirely. |
| [`apply_promotion`](#apply_promotion) | Attach a promotion/coupon code to the cart. Quote afterward with quote_cart to see discountCents. |
| [`quote_cart`](#quote_cart) | Price the cart: subtotalCents, discountCents, totalCents. Does not reserve stock. |
| [`place_order`](#place_order) | Convert a cart into an order (status=created) and reserve inventory. Use a stable idempotencyKey to safely retry. |
| [`get_order`](#get_order) | Fetch order status and totals by id. |
| [`cancel_order`](#cancel_order) | Cancel an order. Releases reservations when status=created; restocks when status=paid. |
| [`request_return`](#request_return) | Request a return for a paid/shipped/delivered order (status=requested). Merchant must approve to refund + restock. |
| [`upsert_product`](#upsert_product) | Merchant: create or update a product (sku, name, priceCents, tags, agentNotes). Creates zero stock row if new. |
| [`adjust_stock`](#adjust_stock) | Merchant: adjust onHand by a signed delta. Cannot go negative or below reserved. |
| [`list_orders`](#list_orders) | Merchant/agent: list orders, optionally filtered by customerId and status. |
| [`recommend_products`](#recommend_products) | Ask the client LLM (MCP sampling/createMessage) for product recommendations given a shopper goal. Falls back to catalog context when sampling is unavailable. |

## `search_products`

Search the active catalog. Prefer this before creating a cart. Returns products with priceCents (integer 分) and agentNotes for LLM-friendly selling points.

### Input schema

```json
{
  "$ref": "#/definitions/search_products",
  "definitions": {
    "search_products": {
      "type": "object",
      "properties": {
        "q": {
          "type": "string",
          "description": "Free-text query matched against name, sku, tags, description, agentNotes"
        },
        "tag": {
          "type": "string",
          "description": "Exact tag filter (case-insensitive)"
        }
      },
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `get_product`

Fetch one product by id, including agentNotes and priceCents. Use after search_products when you need full detail.

### Input schema

```json
{
  "$ref": "#/definitions/get_product",
  "definitions": {
    "get_product": {
      "type": "object",
      "properties": {
        "productId": {
          "type": "string",
          "minLength": 1,
          "description": "Product id returned by search_products / upsert_product"
        }
      },
      "required": [
        "productId"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `check_inventory`

Return onHand, reserved, and available units for a product. Call before add_cart_item when quantity is large.

### Input schema

```json
{
  "$ref": "#/definitions/check_inventory",
  "definitions": {
    "check_inventory": {
      "type": "object",
      "properties": {
        "productId": {
          "type": "string",
          "minLength": 1,
          "description": "Product id to inspect onHand / reserved / available"
        }
      },
      "required": [
        "productId"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `create_cart`

Create an empty shopping cart for a customer. Always pass a fresh Idempotency key unless intentionally replaying.

### Input schema

```json
{
  "$ref": "#/definitions/create_cart",
  "definitions": {
    "create_cart": {
      "type": "object",
      "properties": {
        "customerId": {
          "type": "string",
          "minLength": 1,
          "default": "mcp_shopper",
          "description": "Customer subject owning the cart"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1,
          "description": "Unique key for this create_cart call; replay returns the same cart"
        }
      },
      "required": [
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `add_cart_item`

Add (or increase) a product line on a cart. Fails with INSUFFICIENT_STOCK if quantity exceeds available.

### Input schema

```json
{
  "$ref": "#/definitions/add_cart_item",
  "definitions": {
    "add_cart_item": {
      "type": "object",
      "properties": {
        "cartId": {
          "type": "string",
          "minLength": 1
        },
        "productId": {
          "type": "string",
          "minLength": 1
        },
        "quantity": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "description": "Units to add (positive integer)"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "cartId",
        "productId",
        "quantity",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `update_cart_item`

Set absolute quantity for a cart line. Quantity 0 removes the item. Stock-checked against available.

### Input schema

```json
{
  "$ref": "#/definitions/update_cart_item",
  "definitions": {
    "update_cart_item": {
      "type": "object",
      "properties": {
        "cartId": {
          "type": "string",
          "minLength": 1
        },
        "productId": {
          "type": "string",
          "minLength": 1
        },
        "quantity": {
          "type": "integer",
          "minimum": 0,
          "description": "New absolute quantity; 0 removes the line"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "cartId",
        "productId",
        "quantity",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `remove_cart_item`

Remove a product line from the cart entirely.

### Input schema

```json
{
  "$ref": "#/definitions/remove_cart_item",
  "definitions": {
    "remove_cart_item": {
      "type": "object",
      "properties": {
        "cartId": {
          "type": "string",
          "minLength": 1
        },
        "productId": {
          "type": "string",
          "minLength": 1
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "cartId",
        "productId",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `apply_promotion`

Attach a promotion/coupon code to the cart. Quote afterward with quote_cart to see discountCents.

### Input schema

```json
{
  "$ref": "#/definitions/apply_promotion",
  "definitions": {
    "apply_promotion": {
      "type": "object",
      "properties": {
        "cartId": {
          "type": "string",
          "minLength": 1
        },
        "code": {
          "type": "string",
          "minLength": 1,
          "description": "Promotion / coupon code such as SAVE200"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "cartId",
        "code",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `quote_cart`

Price the cart: subtotalCents, discountCents, totalCents. Does not reserve stock.

### Input schema

```json
{
  "$ref": "#/definitions/quote_cart",
  "definitions": {
    "quote_cart": {
      "type": "object",
      "properties": {
        "cartId": {
          "type": "string",
          "minLength": 1,
          "description": "Cart to price; includes discounts if a promo is applied"
        }
      },
      "required": [
        "cartId"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `place_order`

Convert a cart into an order (status=created) and reserve inventory. Use a stable idempotencyKey to safely retry.

### Input schema

```json
{
  "$ref": "#/definitions/place_order",
  "definitions": {
    "place_order": {
      "type": "object",
      "properties": {
        "cartId": {
          "type": "string",
          "minLength": 1,
          "description": "Cart to convert into an order (reserves stock)"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "cartId",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `get_order`

Fetch order status and totals by id.

### Input schema

```json
{
  "$ref": "#/definitions/get_order",
  "definitions": {
    "get_order": {
      "type": "object",
      "properties": {
        "orderId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "orderId"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `cancel_order`

Cancel an order. Releases reservations when status=created; restocks when status=paid.

### Input schema

```json
{
  "$ref": "#/definitions/cancel_order",
  "definitions": {
    "cancel_order": {
      "type": "object",
      "properties": {
        "orderId": {
          "type": "string",
          "minLength": 1
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "orderId",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `request_return`

Request a return for a paid/shipped/delivered order (status=requested). Merchant must approve to refund + restock.

### Input schema

```json
{
  "$ref": "#/definitions/request_return",
  "definitions": {
    "request_return": {
      "type": "object",
      "properties": {
        "orderId": {
          "type": "string",
          "minLength": 1,
          "description": "Paid/shipped/delivered order to request a return on"
        },
        "reason": {
          "type": "string",
          "minLength": 1,
          "description": "Human-readable return reason"
        },
        "lines": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "productId": {
                "type": "string",
                "minLength": 1
              },
              "quantity": {
                "type": "integer",
                "exclusiveMinimum": 0
              }
            },
            "required": [
              "productId",
              "quantity"
            ],
            "additionalProperties": false
          },
          "minItems": 1,
          "description": "Optional line selection; omit to return all lines"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "orderId",
        "reason",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `upsert_product`

Merchant: create or update a product (sku, name, priceCents, tags, agentNotes). Creates zero stock row if new.

### Input schema

```json
{
  "$ref": "#/definitions/upsert_product",
  "definitions": {
    "upsert_product": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "sku": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "description": {
          "type": "string"
        },
        "priceCents": {
          "type": "integer",
          "minimum": 0
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "agentNotes": {
          "type": "string"
        },
        "active": {
          "type": "boolean"
        },
        "stock": {
          "type": "integer",
          "minimum": 0
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "sku",
        "name",
        "priceCents",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `adjust_stock`

Merchant: adjust onHand by a signed delta. Cannot go negative or below reserved.

### Input schema

```json
{
  "$ref": "#/definitions/adjust_stock",
  "definitions": {
    "adjust_stock": {
      "type": "object",
      "properties": {
        "productId": {
          "type": "string",
          "minLength": 1
        },
        "delta": {
          "type": "integer",
          "description": "Signed integer delta applied to onHand (e.g. +10 restock, -3 write-off)"
        },
        "idempotencyKey": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "productId",
        "delta",
        "idempotencyKey"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `list_orders`

Merchant/agent: list orders, optionally filtered by customerId and status.

### Input schema

```json
{
  "$ref": "#/definitions/list_orders",
  "definitions": {
    "list_orders": {
      "type": "object",
      "properties": {
        "customerId": {
          "type": "string"
        },
        "status": {
          "type": "string",
          "enum": [
            "created",
            "paid",
            "shipped",
            "delivered",
            "cancelled",
            "partially_refunded",
            "refunded"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## `recommend_products`

Ask the client LLM (MCP sampling/createMessage) for product recommendations given a shopper goal. Falls back to catalog context when sampling is unavailable.

Registered in `src/mcp/create-mcp-server.ts` (not in `ToolSchemas`).

### Input schema

```json
{
  "$ref": "#/definitions/recommend_products",
  "definitions": {
    "recommend_products": {
      "type": "object",
      "properties": {
        "goal": {
          "type": "string",
          "minLength": 1,
          "description": "Shopper intent used to ask the client LLM for a short product recommendation"
        },
        "limit": {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 8,
          "default": 3,
          "description": "Max catalog rows to include as sampling context"
        }
      },
      "required": [
        "goal"
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

## Source

```bash
npm run docs:gen
```
