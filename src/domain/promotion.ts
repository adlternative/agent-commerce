import { z } from 'zod'
import { CentsSchema, type Cents, assertCents, subCents } from './money.js'
import { DomainError } from './errors.js'

export const PromotionSchema = z.discriminatedUnion('type', [
  z.object({
    code: z.string().min(1),
    type: z.literal('threshold_off'),
    /** Subtotal must be >= thresholdCents to apply. */
    thresholdCents: CentsSchema,
    /** Flat discount in cents when threshold met. */
    offCents: CentsSchema,
    active: z.boolean().default(true),
  }),
  z.object({
    code: z.string().min(1),
    type: z.literal('coupon_percent'),
    /** Integer percent 1–100. */
    percentOff: z.number().int().min(1).max(100),
    /** Optional max discount cap in cents. */
    maxOffCents: CentsSchema.optional(),
    active: z.boolean().default(true),
  }),
  z.object({
    code: z.string().min(1),
    type: z.literal('coupon_fixed'),
    offCents: CentsSchema,
    active: z.boolean().default(true),
  }),
])

export type Promotion = z.infer<typeof PromotionSchema>

export type QuoteLine = {
  productId: string
  quantity: number
  unitPriceCents: Cents
  lineTotalCents: Cents
}

export type CartQuote = {
  lines: QuoteLine[]
  subtotalCents: Cents
  discountCents: Cents
  totalCents: Cents
  promotionCode?: string
}

export function lineTotal(unitPriceCents: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', 'line quantity must be a positive integer')
  }
  return assertCents(unitPriceCents * quantity)
}

export function quoteSubtotal(lines: readonly QuoteLine[]): Cents {
  return assertCents(lines.reduce((sum, l) => sum + l.lineTotalCents, 0))
}

/** Compute discount for a promotion against subtotal. Returns 0 if inactive / unmet. */
export function computeDiscount(subtotalCents: Cents, promo: Promotion | undefined): Cents {
  if (!promo || !promo.active) return 0
  switch (promo.type) {
    case 'threshold_off': {
      if (subtotalCents < promo.thresholdCents) return 0
      return assertCents(Math.min(promo.offCents, subtotalCents))
    }
    case 'coupon_percent': {
      const raw = Math.floor((subtotalCents * promo.percentOff) / 100)
      const capped =
        promo.maxOffCents !== undefined ? Math.min(raw, promo.maxOffCents) : raw
      return assertCents(Math.min(capped, subtotalCents))
    }
    case 'coupon_fixed': {
      return assertCents(Math.min(promo.offCents, subtotalCents))
    }
    default: {
      const _exhaustive: never = promo
      return _exhaustive
    }
  }
}

export function applyPromotionToQuote(
  lines: QuoteLine[],
  promo: Promotion | undefined,
): CartQuote {
  const subtotalCents = quoteSubtotal(lines)
  const discountCents = computeDiscount(subtotalCents, promo)
  const totalCents = subCents(subtotalCents, discountCents)
  return {
    lines,
    subtotalCents,
    discountCents,
    totalCents,
    promotionCode: promo?.code,
  }
}

export function requirePromotion(
  promos: readonly Promotion[],
  code: string,
): Promotion {
  const found = promos.find((p) => p.code.toUpperCase() === code.toUpperCase())
  if (!found) {
    throw new DomainError('PROMO_NOT_FOUND', `promotion code not found: ${code}`)
  }
  if (!found.active) {
    throw new DomainError('PROMO_INACTIVE', `promotion code inactive: ${code}`)
  }
  return found
}
