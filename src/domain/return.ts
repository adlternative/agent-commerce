import { z } from 'zod'
import { CentsSchema } from './money.js'
import { DomainError } from './errors.js'
import { canTransition, transitionOrder, type Order } from './order.js'
import { markPaymentRefunded, type Payment } from './payment.js'

export const ReturnStatusSchema = z.enum(['requested', 'approved', 'rejected', 'refunded'])

export type ReturnStatus = z.infer<typeof ReturnStatusSchema>

export const ReturnRequestSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  reason: z.string().min(1),
  amountCents: CentsSchema,
  status: ReturnStatusSchema,
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ReturnRequest = z.infer<typeof ReturnRequestSchema>

const RETURNABLE: ReadonlySet<Order['status']> = new Set(['paid', 'shipped', 'delivered'])

export function assertOrderReturnable(order: Order): void {
  if (!RETURNABLE.has(order.status)) {
    throw new DomainError('ORDER_NOT_RETURNABLE', `order status ${order.status} cannot be returned`, {
      hint: 'returns allowed from paid, shipped, or delivered',
    })
  }
  if (!canTransition(order.status, 'refunded')) {
    throw new DomainError('ORDER_NOT_RETURNABLE', `cannot refund from ${order.status}`)
  }
}

export function createReturnRequest(input: {
  id: string
  order: Order
  reason: string
  idempotencyKey: string
  amountCents?: number
  now?: Date
}): ReturnRequest {
  assertOrderReturnable(input.order)
  const amountCents = input.amountCents ?? input.order.totalCents
  if (amountCents <= 0 || amountCents > input.order.totalCents) {
    throw new DomainError('INVALID_RETURN_AMOUNT', 'return amount must be within order total')
  }
  const now = (input.now ?? new Date()).toISOString()
  return {
    id: input.id,
    orderId: input.order.id,
    reason: input.reason,
    amountCents,
    status: 'requested',
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  }
}

export function approveReturn(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== 'requested') {
    throw new DomainError('INVALID_RETURN_STATUS', `cannot approve from ${ret.status}`)
  }
  return { ...ret, status: 'approved', updatedAt: new Date().toISOString() }
}

/**
 * Complete return: refund payment and mark order refunded.
 */
export function completeReturnRefund(
  ret: ReturnRequest,
  order: Order,
  payment: Payment,
): { return: ReturnRequest; order: Order; payment: Payment } {
  if (ret.orderId !== order.id) {
    throw new DomainError('RETURN_ORDER_MISMATCH', 'return does not belong to order')
  }
  if (ret.status !== 'approved' && ret.status !== 'requested') {
    throw new DomainError('INVALID_RETURN_STATUS', `cannot refund return in ${ret.status}`)
  }
  assertOrderReturnable(order)
  const refundedPayment = markPaymentRefunded(payment)
  const refundedOrder = transitionOrder(order, 'refunded')
  return {
    return: { ...ret, status: 'refunded', updatedAt: new Date().toISOString() },
    order: refundedOrder,
    payment: refundedPayment,
  }
}
