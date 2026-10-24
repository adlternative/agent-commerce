import { z } from 'zod'

/** 商品：金额为整数分；agentNotes 供 LLM 直接消费。 */
export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  tags: z.array(z.string().min(1)),
  agentNotes: z.string().min(1),
})

export type Product = z.infer<typeof ProductSchema>

/** 购物车行。 */
export const CartLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
})

export type CartLine = z.infer<typeof CartLineSchema>

/** 加购请求 payload。 */
export const AddToCartPayloadSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive().default(1),
})

export type AddToCartPayload = z.infer<typeof AddToCartPayloadSchema>

/** 定价规则：金额为整数分；memberRate 为 0–1。 */
export const PricingRulesSchema = z.object({
  thresholdCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  memberRate: z.number().min(0).max(1),
  shippingCents: z.number().int().nonnegative(),
  freeShippingCents: z.number().int().nonnegative(),
})

export type PricingRules = z.infer<typeof PricingRulesSchema>

export function parseProduct(input: unknown): Product {
  return ProductSchema.parse(input)
}

export function parseCartLine(input: unknown): CartLine {
  return CartLineSchema.parse(input)
}

export function parseAddToCartPayload(input: unknown): AddToCartPayload {
  return AddToCartPayloadSchema.parse(input)
}

export function parsePricingRules(input: unknown): PricingRules {
  return PricingRulesSchema.parse(input)
}
