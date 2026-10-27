/** Shared Zod request-body schemas for HTTP routes and OpenAPI generation. */
import { z } from 'zod'
import { UpsertProductInputSchema } from '../domain/product.js'
import { PromotionSchema } from '../domain/promotion.js'

export const AddItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

export const UpdateItemSchema = z.object({
  quantity: z.number().int().nonnegative(),
})

export const PromoCodeSchema = z.object({
  code: z.string().min(1),
})

export const AdjustStockSchema = z.object({
  delta: z.number().int(),
})

export const CreateReturnBodySchema = z.object({
  reason: z.string().min(1),
})

export const CreateCartBodySchema = z.object({
  customerId: z.string().min(1).optional(),
})

/** Body may be omitted or `{}`; optional customerId when present. */
export const CreateCartSchema = CreateCartBodySchema.optional()

export const PlaceOrderBodySchema = z.object({
  cartId: z.string().min(1),
})

export const PaymentWebhookBodySchema = z.object({
  eventId: z.string().min(1),
  type: z.enum(['payment.captured', 'payment.failed']),
  orderId: z.string().min(1),
  amountCents: z.number().int().nonnegative().optional(),
})

/** Bodyless write ops still document an empty JSON object. */
export const EmptyBodySchema = z.object({}).strict()

export {
  UpsertProductInputSchema,
  PromotionSchema,
}
