export interface PricingRules {
  /** 满减门槛（分） */
  thresholdCents: number
  /** 满减金额（分） */
  discountCents: number
  /** 会员额外折扣（0-1） */
  memberRate: number
  /** 运费（分），满包邮门槛免运费 */
  shippingCents: number
  freeShippingCents: number
}

export const DEFAULT_RULES: PricingRules = {
  thresholdCents: 20000,
  discountCents: 3000,
  memberRate: 0.05,
  shippingCents: 800,
  freeShippingCents: 9900,
}

/** 计算应付总额（分）。金额一律用整数分，避免浮点误差。 */
export function totalCents(subtotalCents: number, isMember: boolean, rules: PricingRules = DEFAULT_RULES): number {
  if (subtotalCents < 0) throw new Error('subtotal must be >= 0')
  const afterThreshold = subtotalCents >= rules.thresholdCents ? subtotalCents - rules.discountCents : subtotalCents
  const afterMember = isMember ? Math.round(afterThreshold * (1 - rules.memberRate)) : afterThreshold
  const shipping = afterMember >= rules.freeShippingCents ? 0 : rules.shippingCents
  return Math.max(0, afterMember + shipping)
}
