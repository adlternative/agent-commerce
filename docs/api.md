# Agent Commerce — API 契约

面向 agent / LLM 的数据与函数契约。金额一律为**整数分**（`*Cents`）；购物车操作为纯函数，不修改入参。本文字段与仓库内实现（`Product` / `CartLine` / `PricingRules` 及对应 zod schema）对齐。

## 约定

| 约定 | 说明 |
|------|------|
| 金额单位 | 整数分（cents / 分），禁止浮点元 |
| 不可变 | `addToCart` / `removeFromCart` 等返回新数组，不改入参 |
| Agent 可读 | 商品带 `agentNotes` 与结构化 `tags`，无需解析 HTML |

---

## `Product`

商品主数据。定义见 `src/lib/cart.ts` / `src/components/ProductCard.tsx`；校验见 `src/lib/schema.ts` 的 `ProductSchema`；样例数据见 `src/lib/catalog.ts`。

| 字段 | 类型 | 约束 | 语义 |
|------|------|------|------|
| `id` | `string` | 非空 | SKU / 商品 ID（如 `sku-001`） |
| `name` | `string` | 非空 | 展示名 |
| `priceCents` | `number` | 非负整数 | 单价（分） |
| `stock` | `number` | 非负整数 | 可售库存；`0` 表示售罄 |
| `tags` | `string[]` | 元素非空 | 结构化标签，便于过滤（如 `hardware`、`gift`） |
| `agentNotes` | `string` | 非空 | **面向 LLM 的卖点说明**（见下） |

### `agentNotes` 语义

- **受众**：agent / LLM，不是给 HTML 解析器用的副文本。
- **内容**：结构化卖点与履约提示（材质/兼容性、数字商品发证、订阅额度、库存风险等），应用层应原样暴露，勿要求 agent 从页面 DOM 抽取。
- **必填**：schema 与类型均要求非空字符串；缺字段或空串为非法 payload。
- **UI**：`ProductCard` 会渲染该字段，但契约上它首先是 agent 消费字段。

样例（与 `catalog` 一致）：

```json
{
  "id": "sku-001",
  "name": "Agent 键帽套装",
  "priceCents": 12900,
  "stock": 7,
  "tags": ["hardware", "gift"],
  "agentNotes": "ABS 材质，兼容 MX 轴；适合作为开发者礼物。库存低，节假日易售罄。"
}
```

---

## `CartLine`

购物车行。

| 字段 | 类型 | 约束 | 语义 |
|------|------|------|------|
| `productId` | `string` | 非空 | 对应 `Product.id` |
| `qty` | `number` | 正整数 | 行数量 |

### 加购 payload `AddToCartPayload`

| 字段 | 类型 | 约束 | 语义 |
|------|------|------|------|
| `productId` | `string` | 非空 | 目标 SKU |
| `qty` | `number` | 正整数；省略时默认 `1` | 本次加购数量 |

---

## 购物车函数（`src/lib/cart.ts`）

### `addToCart(lines, catalog, productId, qty = 1): CartLine[]`

- 未知 `productId` → 抛错（`unknown product: …`）。
- `qty <= 0` → 抛错。
- 行数量钳制到 `product.stock`（`Math.min(existing + qty, stock)`）。
- 返回新数组；不修改 `lines`。

### `removeFromCart(lines, productId): CartLine[]`

- 过滤掉匹配行；返回新数组。

### `subtotalCents(lines, catalog): number`

- 按目录单价累加 `priceCents * qty`。
- 未知 SKU → 抛错。

### `checkStock(lines, catalog): Array<{ productId, requested, available }>`

- `qty > stock` 时写入缺货明细；空数组表示可下单。
- 未知 SKU → 抛错。

---

## `PricingRules` / `totalCents`（`src/lib/pricing.ts`）

| 字段 | 类型 | 约束 | 语义 |
|------|------|------|------|
| `thresholdCents` | `number` | 非负整数 | 满减门槛（分） |
| `discountCents` | `number` | 非负整数 | 满减金额（分） |
| `memberRate` | `number` | `0`–`1` | 会员额外折扣比例 |
| `shippingCents` | `number` | 非负整数 | 基础运费（分） |
| `freeShippingCents` | `number` | 非负整数 | 包邮门槛（按满减/会员后的金额比较） |

默认规则 `DEFAULT_RULES`：门槛 `20000`、满减 `3000`、会员 `0.05`、运费 `800`、包邮门槛 `9900`。

### `totalCents(subtotalCents, isMember, rules = DEFAULT_RULES): number`

计算顺序：

1. `subtotalCents < 0` → 抛错。
2. 小计 ≥ `thresholdCents` 则减去 `discountCents`。
3. 若会员，对上一步结果乘 `(1 - memberRate)` 并 `Math.round`。
4. 若上一步结果 ≥ `freeShippingCents` 则运费 `0`，否则加 `shippingCents`。
5. 返回 `Math.max(0, …)`。

---

## 校验入口（`src/lib/schema.ts`）

| 函数 | Schema | 用途 |
|------|--------|------|
| `parseProduct` | `ProductSchema` | 商品 payload |
| `parseCartLine` | `CartLineSchema` | 购物车行 |
| `parseAddToCartPayload` | `AddToCartPayloadSchema` | 加购请求（`qty` 默认 1） |
| `parsePricingRules` | `PricingRulesSchema` | 定价规则 |

非法 payload（缺 `agentNotes`、负分金额、非整数库存、`memberRate` 越界等）由 zod 拒绝。

---

## UI 契约摘要

| 组件 | 行为 |
|------|------|
| `ProductCard` | `stock === 0` → 文案「已售罄」且加购按钮 `disabled`；展示 `agentNotes` |
| `CheckoutPage` | 结算展示用分单位金额（`*Fen` 命名与库内 `*Cents` 同义：均为分） |

---

## 模块对照

| 路径 | 职责 |
|------|------|
| `src/lib/catalog.ts` | 结构化商品数据（含 `agentNotes`） |
| `src/lib/cart.ts` | 加购、库存钳制、缺货校验 |
| `src/lib/pricing.ts` | 满减 / 会员 / 包邮 |
| `src/lib/schema.ts` | zod 校验与类型导出 |
| `src/components/ProductCard.tsx` | 单商品卡片 |
| `src/components/CheckoutPage.tsx` | 结算页 |
