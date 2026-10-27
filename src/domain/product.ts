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

/**
 * List responses may include sellable qty. Optional so get-by-id / upsert stay valid.
 * `available > 0` ⇒ sellable; add-to-cart at 0 ⇒ 409 INSUFFICIENT_STOCK.
 */
export const ProductWithOptionalAvailableSchema = ProductSchema.extend({
  available: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Sellable units (onHand − reserved). Present on GET /api/agent/products and GET /api/customer/products list items.',
    ),
})

export const UpsertProductInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    sku: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    priceCents: CentsSchema,
    tags: z.array(z.string()).optional(),
    agentNotes: z.string().optional(),
    active: z.boolean().optional(),
    /**
     * Initial onHand when creating a product. Omitted → 0.
     * On update, when provided, sets absolute onHand (must be ≥ reserved).
     */
    stock: z.number().int().nonnegative().optional(),
  })
  .strict()

export type UpsertProductInput = z.infer<typeof UpsertProductInputSchema>

/** Parse upsert body; unknown keys → structured UNKNOWN_FIELD 400 (not silent drop). */
export function parseUpsertProductInput(raw: unknown): UpsertProductInput {
  const result = UpsertProductInputSchema.safeParse(raw)
  if (result.success) return result.data

  const unknown = result.error.issues.filter((i) => i.code === 'unrecognized_keys')
  if (unknown.length > 0) {
    const keys = unknown
      .flatMap((i) => ('keys' in i && Array.isArray(i.keys) ? (i.keys as string[]) : []))
      .filter(Boolean)
    throw new DomainError('UNKNOWN_FIELD', 'request contains unknown fields', {
      hint: keys.length > 0 ? `unknown fields: ${keys.join(', ')}` : result.error.message,
    })
  }
  throw result.error
}

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
