# Agent Commerce — 为 Agent 设计的网购平台

用于 Cursor Cloud Agents / Projects 并发实测的**真实负载仓库**。不是 demo：有确定性定价、库存约束、单元测试与 CI。

## 命令

```bash
npm ci
npm test        # vitest
npm run build   # tsc --noEmit && vite build
npm run dev     # 本地预览 http://localhost:5173
```

## 结构

- `src/lib/pricing.ts` — 满减/会员/包邮的确定性定价（整数分）
- `src/lib/cart.ts` — 加购、库存钳制、缺货校验（纯函数）
- `src/lib/catalog.ts` — 结构化商品数据，含 `agentNotes`（面向 LLM 的卖点）
- `src/components/` — ProductCard / CartPanel
- `tests/` — 定价与购物车单测

## 设计取向

金额一律整数分；购物车逻辑纯函数、不改入参；商品带 `agentNotes` 与结构化 `tags`，便于 agent 直接消费而无需解析 HTML。
