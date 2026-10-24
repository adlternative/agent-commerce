/** Line item for order summary. Amounts are integer cents (分). */
export interface OrderLine {
  productId: string
  name: string
  qty: number
  unitPriceCents: number
}

/** Deterministic order totals breakdown (integer cents). */
export interface OrderSummary {
  lines: OrderLine[]
  itemCount: number
  subtotalCents: number
  discountCents: number
  shippingCents: number
  totalCents: number
}

export interface OrderSummaryRules {
  /** 满减门槛（分） */
  thresholdCents: number
  /** 满减金额（分） */
  discountCents: number
  /** 运费（分） */
  shippingCents: number
  /** 满包邮门槛（分，基于满减后金额） */
  freeShippingCents: number
}

export const DEFAULT_ORDER_RULES: OrderSummaryRules = {
  thresholdCents: 20000,
  discountCents: 3000,
  shippingCents: 800,
  freeShippingCents: 9900,
}

function assertValidLines(lines: OrderLine[]): void {
  for (const line of lines) {
    if (line.qty <= 0) throw new Error('qty must be positive')
    if (line.unitPriceCents < 0) throw new Error('unitPriceCents must be >= 0')
  }
}

/** Pure order summary: subtotal → 满减 → shipping. Does not mutate input. */
export function summarizeOrder(
  lines: OrderLine[],
  rules: OrderSummaryRules = DEFAULT_ORDER_RULES,
): OrderSummary {
  assertValidLines(lines)

  const snapshot = lines.map((l) => ({ ...l }))
  const itemCount = snapshot.reduce((n, l) => n + l.qty, 0)
  const subtotalCents = snapshot.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0)
  const discountCents = subtotalCents >= rules.thresholdCents ? rules.discountCents : 0
  const afterDiscount = Math.max(0, subtotalCents - discountCents)
  const shippingCents = afterDiscount >= rules.freeShippingCents ? 0 : rules.shippingCents

  return {
    lines: snapshot,
    itemCount,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: afterDiscount + shippingCents,
  }
}
