import { z } from 'zod'
import { CentsSchema } from './money.js'
import { DomainError } from './errors.js'
import { rankProducts } from './search.js'

export const ProductSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  priceCents: CentsSchema,
  tags: z.array(z.string()).default([]),
  /** Free-form notes for LLM / agent consumers — not shown as marketing copy. */
  agentNotes: z.string().default(''),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Product = z.infer<typeof ProductSchema>

export const UpsertProductInputSchema = z.object({
  id: z.string().min(1).optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: CentsSchema,
  tags: z.array(z.string()).optional(),
  agentNotes: z.string().optional(),
  active: z.boolean().optional(),
})

export type UpsertProductInput = z.infer<typeof UpsertProductInputSchema>

export function parseProduct(raw: unknown): Product {
  const result = ProductSchema.safeParse(raw)
  if (!result.success) {
    throw new DomainError('INVALID_PRODUCT', 'product payload failed validation', {
      hint: result.error.issues.map((i) => i.message).join('; '),
    })
  }
  return result.data
}

export function searchProducts(
  products: readonly Product[],
  query: { q?: string; tag?: string; activeOnly?: boolean },
): Product[] {
  return rankProducts(products, query).map((h) => h.product)
}
