import { z } from 'zod'
import { CentsSchema, type Cents } from './money.js'
import { DomainError } from './errors.js'
import type { CartQuote } from './promotion.js'

export const OrderStatusSchema = z.enum([
  'created',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
])

export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: CentsSchema,
  lineTotalCents: CentsSchema,
})

export type OrderLine = z.infer<typeof OrderLineSchema>

export const OrderSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  cartId: z.string().min(1),
  status: OrderStatusSchema,
  lines: z.array(OrderLineSchema),
  subtotalCents: CentsSchema,
  discountCents: CentsSchema,
  totalCents: CentsSchema,
  promotionCode: z.string().optional(),
  /** Reservation ids holding stock until paid/cancelled. */
  reservationIds: z.array(z.string()),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Order = z.infer<typeof OrderSchema>

/** Allowed transitions for the order state machine. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function transitionOrder(order: Order, to: OrderStatus): Order {
  if (!canTransition(order.status, to)) {
    throw new DomainError('INVALID_TRANSITION', `cannot transition ${order.status} → ${to}`, {
      hint: `allowed: ${TRANSITIONS[order.status].join(', ') || '(terminal)'}`,
    })
  }
  return { ...order, status: to, updatedAt: new Date().toISOString() }
}

export function createOrderFromQuote(input: {
  id: string
  customerId: string
  cartId: string
  quote: CartQuote
  reservationIds: string[]
  idempotencyKey: string
  now?: Date
}): Order {
  if (input.quote.lines.length === 0) {
    throw new DomainError('EMPTY_CART', 'cannot place order with empty cart')
  }
  const now = (input.now ?? new Date()).toISOString()
  return {
    id: input.id,
    customerId: input.customerId,
    cartId: input.cartId,
    status: 'created',
    lines: input.quote.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      lineTotalCents: l.lineTotalCents,
    })),
    subtotalCents: input.quote.subtotalCents,
    discountCents: input.quote.discountCents,
    totalCents: input.quote.totalCents,
    promotionCode: input.quote.promotionCode,
    reservationIds: [...input.reservationIds],
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  }
}

export function assertOrderPayable(order: Order): void {
  if (order.status !== 'created') {
    throw new DomainError('ORDER_NOT_PAYABLE', `order status ${order.status} is not payable`)
  }
}

export function orderTotal(order: Order): Cents {
  return order.totalCents
}
