import { z } from 'zod'

/** Product: prices in integer cents; agentNotes for LLM consumers. */
export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  tags: z.array(z.string().min(1)),
  agentNotes: z.string().min(1),
})

export type Product = z.infer<typeof ProductSchema>

/** Cart line: qty must be a positive integer. */
export const CartLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
})

export type CartLine = z.infer<typeof CartLineSchema>

/** Order request payload: cart lines + membership flag. */
export const OrderPayloadSchema = z.object({
  lines: z.array(CartLineSchema).min(1),
  isMember: z.boolean(),
})

export type OrderPayload = z.infer<typeof OrderPayloadSchema>

export function parseProduct(input: unknown): Product {
  return ProductSchema.parse(input)
}

export function parseCartLine(input: unknown): CartLine {
  return CartLineSchema.parse(input)
}

export function parseOrderPayload(input: unknown): OrderPayload {
  return OrderPayloadSchema.parse(input)
}

export function safeParseProduct(input: unknown) {
  return ProductSchema.safeParse(input)
}

export function safeParseOrderPayload(input: unknown) {
  return OrderPayloadSchema.safeParse(input)
}
