import { z } from 'zod'
import { CentsSchema } from './money.js'
import { DomainError } from './errors.js'
import { assertOrderPayable, transitionOrder, type Order } from './order.js'

export const PaymentStatusSchema = z.enum(['pending', 'captured', 'failed', 'refunded'])

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

export const PaymentSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  amountCents: CentsSchema,
  status: PaymentStatusSchema,
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Payment = z.infer<typeof PaymentSchema>

export function createPendingPayment(input: {
  id: string
  orderId: string
  amountCents: number
  idempotencyKey: string
  now?: Date
}): Payment {
  const now = (input.now ?? new Date()).toISOString()
  return {
    id: input.id,
    orderId: input.orderId,
    amountCents: input.amountCents,
    status: 'pending',
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Capture payment and move order created → paid.
 * Returns updated payment + order. Idempotent caller should short-circuit on key.
 */
export function capturePayment(
  payment: Payment,
  order: Order,
): { payment: Payment; order: Order } {
  if (payment.orderId !== order.id) {
    throw new DomainError('PAYMENT_ORDER_MISMATCH', 'payment does not belong to order')
  }
  if (payment.amountCents !== order.totalCents) {
    throw new DomainError('PAYMENT_AMOUNT_MISMATCH', 'payment amount must equal order total', {
      hint: `payment=${payment.amountCents} order=${order.totalCents}`,
    })
  }
  assertOrderPayable(order)
  if (payment.status === 'captured') {
    return { payment, order }
  }
  if (payment.status !== 'pending') {
    throw new DomainError('PAYMENT_NOT_CAPTURABLE', `payment status ${payment.status}`)
  }
  const now = new Date().toISOString()
  return {
    payment: { ...payment, status: 'captured', updatedAt: now },
    order: transitionOrder(order, 'paid'),
  }
}

export function markPaymentRefunded(payment: Payment): Payment {
  if (payment.status !== 'captured') {
    throw new DomainError('PAYMENT_NOT_REFUNDABLE', `payment status ${payment.status}`)
  }
  return { ...payment, status: 'refunded', updatedAt: new Date().toISOString() }
}
