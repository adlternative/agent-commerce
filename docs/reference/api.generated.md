---
title: API 参考（OpenAPI 生成）
description: Auto-generated from docs/openapi.json — do not hand-edit.
---

# API 参考

> **Generated** from [`docs/openapi.json`](../openapi.json) by `npm run docs:gen`.
> Do not hand-copy endpoints here — edit the OpenAPI source (or the Zod schemas that feed it) and regenerate.

- **Spec:** OpenAPI 3.1.0
- **Title:** Agent Commerce API
- **Version:** 0.3.0

AI-native commerce HTTP API. Amounts are integer cents. Writes require Idempotency-Key. Component schemas are generated from Zod.

## Endpoints (52 paths)

### GET `/.well-known/ai-commerce.json`

**AI commerce capability discovery**


#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/audit`

**Query recent audit events**

Filter in-memory audit ring buffer by actor, role, path, status, code, traceId, or time range.

- **tags:** `agent`, `security`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `limit` | query | no |  |
| `actor` | query | no |  |
| `role` | query | no |  |
| `method` | query | no |  |
| `pathPrefix` | query | no |  |
| `pathContains` | query | no |  |
| `status` | query | no |  |
| `code` | query | no |  |
| `traceId` | query | no |  |
| `since` | query | no |  |
| `until` | query | no |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/carts`

**Create cart (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {
    "customerId": {
      "type": "string",
      "minLength": 1
    }
  },
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/carts/{id}/items`

**Add cart item (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "productId": {
      "type": "string",
      "minLength": 1
    },
    "quantity": {
      "type": "integer",
      "exclusiveMinimum": true,
      "minimum": 0
    }
  },
  "required": [
    "productId",
    "quantity"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### DELETE `/api/agent/carts/{id}/items/{productId}`

**Remove cart item (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `productId` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### PATCH `/api/agent/carts/{id}/items/{productId}`

**Update cart item (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `productId` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "quantity": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": [
    "quantity"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/carts/{id}/promotion`

**Apply promotion (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "code"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/carts/{id}/quote`

**Quote cart (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/inventory/{productId}`

**Check inventory (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `productId` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/orders`

**List orders (agent:merchant)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `customerId` | query | no |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/orders`

**Agent place order**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "cartId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "cartId"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/orders/{id}`

**Get order (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/orders/{id}/cancel`

**Cancel order (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/orders/{id}/pay`

**Pay order (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/orders/{id}/returns`

**Request return (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "minLength": 1
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
            "exclusiveMinimum": true,
            "minimum": 0
          }
        },
        "required": [
          "productId",
          "quantity"
        ],
        "additionalProperties": false
      },
      "minItems": 1
    }
  },
  "required": [
    "reason"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/products`

**Agent product search (each item includes available sellable qty)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `q` | query | no |  |
| `tag` | query | no |  |
| `cursor` | query | no | Opaque pagination cursor from a previous nextCursor |
| `limit` | query | no | Page size when paging (1–100; default 20). When omitted (and no cursor), all matching products are returned. |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/products`

**Agent upsert product (requires agent:merchant)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
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
      "minimum": 0,
      "description": "Integer cents (分). Never floats."
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
    }
  },
  "required": [
    "sku",
    "name",
    "priceCents"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/agent/products/{id}`

**Get product (agent)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/agent/products/{id}/stock`

**Adjust stock (agent:merchant)**

- **tags:** `agent`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "delta": {
      "type": "integer"
    }
  },
  "required": [
    "delta"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/carts`

**Create cart**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {
    "customerId": {
      "type": "string",
      "minLength": 1
    }
  },
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/customer/carts/{id}`

**Get cart**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/carts/{id}/items`

**Add cart item**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "productId": {
      "type": "string",
      "minLength": 1
    },
    "quantity": {
      "type": "integer",
      "exclusiveMinimum": true,
      "minimum": 0
    }
  },
  "required": [
    "productId",
    "quantity"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### DELETE `/api/customer/carts/{id}/items/{productId}`

**Remove cart item**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `productId` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### PATCH `/api/customer/carts/{id}/items/{productId}`

**Update cart item quantity**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `productId` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "quantity": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": [
    "quantity"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/carts/{id}/promotion`

**Apply promotion code to cart**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "code"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/customer/carts/{id}/quote`

**Quote cart totals (integer cents)**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/customer/inventory/{productId}`

**Check inventory availability**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `productId` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/orders`

**Place order (reserves stock)**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "cartId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "cartId"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/customer/orders/{id}`

**Get order**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/orders/{id}/cancel`

**Cancel unpaid order and release holds**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/orders/{id}/pay`

**Pay order (commits stock)**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/orders/{id}/receive`

**Confirm goods received (shipped → delivered)**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/customer/orders/{id}/returns`

**Request a return / refund**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "minLength": 1
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
            "exclusiveMinimum": true,
            "minimum": 0
          }
        },
        "required": [
          "productId",
          "quantity"
        ],
        "additionalProperties": false
      },
      "minItems": 1
    }
  },
  "required": [
    "reason"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/customer/products`

**List / search products (each item includes available sellable qty)**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `q` | query | no |  |
| `tag` | query | no |  |
| `cursor` | query | no | Opaque pagination cursor from a previous nextCursor |
| `limit` | query | no | Page size when paging (1–100; default 20). When omitted (and no cursor), all matching products are returned. |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/customer/products/{id}`

**Get product**

- **tags:** `customer`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/audit`

**Query audit events (merchant)**

- **tags:** `merchant`, `security`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `limit` | query | no |  |
| `actor` | query | no |  |
| `role` | query | no |  |
| `method` | query | no |  |
| `pathPrefix` | query | no |  |
| `pathContains` | query | no |  |
| `status` | query | no |  |
| `code` | query | no |  |
| `traceId` | query | no |  |
| `since` | query | no |  |
| `until` | query | no |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/inventory/{productId}`

**Check inventory (merchant)**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `productId` | path | yes |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/metrics`

**Merchant business metrics (GMV, orders, OOS)**

- **tags:** `merchant`

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/orders`

**List orders**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `customerId` | query | no |  |
| `status` | query | no |  |
| `cursor` | query | no |  |
| `limit` | query | no |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/orders/{id}/deliver`

**Mark order delivered**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/orders/{id}/receive`

**Mark order received/delivered (alias)**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/orders/{id}/ship`

**Ship a paid order**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/products`

**List products (merchant)**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `q` | query | no |  |
| `tag` | query | no |  |
| `activeOnly` | query | no |  |
| `cursor` | query | no | Opaque pagination cursor from a previous nextCursor |
| `limit` | query | no | Page size when paging (1–100; default 20). When omitted (and no cursor), all matching products are returned. |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/products`

**Upsert product**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
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
      "minimum": 0,
      "description": "Integer cents (分). Never floats."
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
    }
  },
  "required": [
    "sku",
    "name",
    "priceCents"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### PUT `/api/merchant/products/{id}`

**Upsert product by id**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
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
      "minimum": 0,
      "description": "Integer cents (分). Never floats."
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
    }
  },
  "required": [
    "sku",
    "name",
    "priceCents"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/products/{id}/stock`

**Adjust stock onHand by delta**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "delta": {
      "type": "integer"
    }
  },
  "required": [
    "delta"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/promotions`

**List promotions**

- **tags:** `merchant`

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/promotions`

**Upsert promotion (threshold / percent / fixed; amounts in cents)**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `undefined` | undefined | no |  |

#### Request body

_required_

```json
{
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "enum": [
            "threshold_off"
          ]
        },
        "thresholdCents": {
          "type": "integer",
          "minimum": 0
        },
        "offCents": {
          "type": "integer",
          "minimum": 0
        },
        "active": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "code",
        "type",
        "thresholdCents",
        "offCents"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "enum": [
            "coupon_percent"
          ]
        },
        "percentOff": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "maxOffCents": {
          "type": "integer",
          "minimum": 0
        },
        "active": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "code",
        "type",
        "percentOff"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "enum": [
            "coupon_fixed"
          ]
        },
        "offCents": {
          "type": "integer",
          "minimum": 0
        },
        "active": {
          "type": "boolean",
          "default": true
        }
      },
      "required": [
        "code",
        "type",
        "offCents"
      ],
      "additionalProperties": false
    }
  ]
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/reservations/release-expired`

**Auto-release timed-out inventory holds and cancel unpaid orders**

- **tags:** `merchant`

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/api/merchant/returns`

**List return requests**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `status` | query | no |  |
| `orderId` | query | no |  |

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/returns/{id}/approve`

**Approve return: refund by line + restock; order refunded or partially_refunded**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/merchant/returns/{id}/reject`

**Reject a requested return**

- **tags:** `merchant`

#### Parameters

| Name | In | Required | Description |
|------|----|----------|-------------|
| `id` | path | yes |  |
| `undefined` | undefined | no |  |

#### Request body

_optional_

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### POST `/api/webhooks/payment`

**Payment provider webhook (idempotent on eventId)**

- **tags:** `webhooks`

#### Request body

_required_

```json
{
  "type": "object",
  "properties": {
    "eventId": {
      "type": "string",
      "minLength": 1
    },
    "type": {
      "type": "string",
      "enum": [
        "payment.captured",
        "payment.failed"
      ]
    },
    "orderId": {
      "type": "string",
      "minLength": 1
    },
    "amountCents": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": [
    "eventId",
    "type",
    "orderId"
  ],
  "additionalProperties": false
}
```

#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/health`

**Liveness (legacy alias of /healthz)**


#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/healthz`

**Liveness probe (no auth)**


#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `default` | Structured error |

### GET `/metrics`

**Prometheus HTTP metrics**

Text exposition of http_requests_total and http_request_duration_ms_* counters. No auth.


#### Responses

| Status | Description |
|--------|-------------|
| `200` | Prometheus text exposition format 0.0.4 |

### GET `/openapi.json`

**OpenAPI 3.1 document**


#### Responses

| Status | Description |
|--------|-------------|
| `200` | OpenAPI document |

### GET `/readyz`

**Readiness probe — verifies store is readable and writable (no auth)**


#### Responses

| Status | Description |
|--------|-------------|
| `200` | OK |
| `503` | Store not ready |

## Source

Regenerate with:

```bash
npm run docs:gen
```
