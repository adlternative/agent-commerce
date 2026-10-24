export interface Product {
  id: string
  name: string
  priceCents: number
  stock: number
  tags: string[]
  /** 面向 agent 的结构化卖点，供 LLM 直接消费 */
  agentNotes: string
}

export interface CartLine {
  productId: string
  qty: number
}

export function subtotalCents(lines: CartLine[], catalog: Product[]): number {
  return lines.reduce((sum, line) => {
    const product = catalog.find((p) => p.id === line.productId)
    if (!product) throw new Error(`unknown product: ${line.productId}`)
    return sum + product.priceCents * line.qty
  }, 0)
}

/** 加购：受库存约束，返回新购物车，不修改入参。 */
export function addToCart(lines: CartLine[], catalog: Product[], productId: string, qty = 1): CartLine[] {
  const product = catalog.find((p) => p.id === productId)
  if (!product) throw new Error(`unknown product: ${productId}`)
  if (qty <= 0) throw new Error('qty must be positive')
  const existing = lines.find((l) => l.productId === productId)
  const nextQty = Math.min((existing?.qty ?? 0) + qty, product.stock)
  if (existing) {
    return lines.map((l) => (l.productId === productId ? { ...l, qty: nextQty } : l))
  }
  return [...lines, { productId, qty: nextQty }]
}

export function removeFromCart(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((l) => l.productId !== productId)
}

/** 库存校验：返回缺货明细，空数组表示可下单。 */
export function checkStock(lines: CartLine[], catalog: Product[]): Array<{ productId: string; requested: number; available: number }> {
  const shortages: Array<{ productId: string; requested: number; available: number }> = []
  for (const line of lines) {
    const product = catalog.find((p) => p.id === line.productId)
    if (!product) throw new Error(`unknown product: ${line.productId}`)
    if (line.qty > product.stock) {
      shortages.push({ productId: line.productId, requested: line.qty, available: product.stock })
    }
  }
  return shortages
}
