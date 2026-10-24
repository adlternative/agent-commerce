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

/** 优惠券：固定金额（分）或百分比，二选一。 */
export interface Coupon {
  code: string
  /** 固定减免（分）；与 percentOff 互斥 */
  amountOffCents?: number
  /** 百分比减免 0–100；与 amountOffCents 互斥 */
  percentOff?: number
  /** 满额门槛（分），未达则折扣为 0 */
  minSubtotalCents?: number
}

export interface CouponApplication {
  code: string
  subtotalCents: number
  discountCents: number
  totalCents: number
}

/** 内置优惠券表（纯数据，可被测试覆盖）。 */
export const COUPONS: Record<string, Coupon> = {
  SAVE10: { code: 'SAVE10', amountOffCents: 1000, minSubtotalCents: 5000 },
  OFF15: { code: 'OFF15', percentOff: 15 },
  BIG50: { code: 'BIG50', amountOffCents: 5000, minSubtotalCents: 20000 },
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
export function checkStock(
  lines: CartLine[],
  catalog: Product[],
): Array<{ productId: string; requested: number; available: number }> {
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

/** 按 code 查找优惠券（大小写不敏感）。未知码抛错。 */
export function getCoupon(code: string, registry: Record<string, Coupon> = COUPONS): Coupon {
  const key = Object.keys(registry).find((k) => k.toLowerCase() === code.trim().toLowerCase())
  if (!key) throw new Error(`unknown coupon: ${code}`)
  return registry[key]
}

/**
 * 计算优惠券折扣（分）。纯函数：
 * - 未达门槛 → 0
 * - 折扣不超过小计
 * - 金额一律整数分
 */
export function couponDiscountCents(subtotal: number, coupon: Coupon): number {
  if (subtotal < 0) throw new Error('subtotal must be >= 0')
  if (coupon.amountOffCents != null && coupon.percentOff != null) {
    throw new Error('coupon must not set both amountOffCents and percentOff')
  }
  if (coupon.amountOffCents == null && coupon.percentOff == null) {
    throw new Error('coupon must set amountOffCents or percentOff')
  }
  const min = coupon.minSubtotalCents ?? 0
  if (subtotal < min) return 0

  let discount = 0
  if (coupon.amountOffCents != null) {
    if (coupon.amountOffCents < 0) throw new Error('amountOffCents must be >= 0')
    discount = coupon.amountOffCents
  } else if (coupon.percentOff != null) {
    if (coupon.percentOff < 0 || coupon.percentOff > 100) {
      throw new Error('percentOff must be between 0 and 100')
    }
    discount = Math.round((subtotal * coupon.percentOff) / 100)
  }
  return Math.min(discount, subtotal)
}

/**
 * 将优惠券应用到购物车小计。不修改 lines / catalog。
 * 未知优惠券码抛错。
 */
export function applyCoupon(
  lines: CartLine[],
  catalog: Product[],
  code: string,
  registry: Record<string, Coupon> = COUPONS,
): CouponApplication {
  const coupon = getCoupon(code, registry)
  const sub = subtotalCents(lines, catalog)
  const discount = couponDiscountCents(sub, coupon)
  return {
    code: coupon.code,
    subtotalCents: sub,
    discountCents: discount,
    totalCents: sub - discount,
  }
}
