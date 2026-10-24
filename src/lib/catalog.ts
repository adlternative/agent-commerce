import type { Product } from './cart'

export const catalog: Product[] = [
  {
    id: 'sku-001',
    name: 'Agent 键帽套装',
    priceCents: 12900,
    stock: 7,
    tags: ['hardware', 'gift'],
    agentNotes: 'ABS 材质，兼容 MX 轴；适合作为开发者礼物。库存低，节假日易售罄。',
  },
  {
    id: 'sku-002',
    name: 'MCP 调试器（虚拟）',
    priceCents: 4990,
    stock: 120,
    tags: ['software', 'devtool'],
    agentNotes: '数字商品，下单后立刻签发 license key；无物流，可重复购买。',
  },
  {
    id: 'sku-003',
    name: '结构化购物车 API 订阅（年）',
    priceCents: 39900,
    stock: 30,
    tags: ['subscription', 'api'],
    agentNotes: '面向 agent 的 JSON-first 下单接口，含 10 万次/月调用额度。',
  },
]
