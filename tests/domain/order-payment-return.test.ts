import { describe, expect, it } from 'vitest'
import {
  canTransition,
  createOrderFromQuote,
  transitionOrder,
} from '../../src/domain/order.js'
import { capturePayment, createPendingPayment } from '../../src/domain/payment.js'
import {
  completeReturnRefund,
  createReturnRequest,
} from '../../src/domain/return.js'
import { DomainError } from '../../src/domain/errors.js'

function sampleOrder() {
  return createOrderFromQuote({
    id: 'ord_1',
    customerId: 'cust_1',
    cartId: 'cart_1',
    quote: {
      lines: [
        {
          productId: 'p1',
          quantity: 1,
          unitPriceCents: 2_000,
          lineTotalCents: 2_000,
        },
      ],
      subtotalCents: 2_000,
      discountCents: 0,
      totalCents: 2_000,
    },
    reservationIds: ['rsv_1'],
    idempotencyKey: 'ik-1',
    now: new Date('2026-01-01T00:00:00.000Z'),
  })
}

describe('order state machine', () => {
  it('follows created→paid→shipped→delivered', () => {
    let order = sampleOrder()
    expect(order.status).toBe('created')
    order = transitionOrder(order, 'paid')
    order = transitionOrder(order, 'shipped')
    order = transitionOrder(order, 'delivered')
    expect(order.status).toBe('delivered')
    expect(canTransition('delivered', 'shipped')).toBe(false)
  })

  it('allows cancel from created and paid', () => {
    expect(canTransition('created', 'cancelled')).toBe(true)
    expect(canTransition('paid', 'cancelled')).toBe(true)
    expect(canTransition('shipped', 'cancelled')).toBe(false)
  })

  it('rejects illegal transitions with structured error', () => {
    const order = sampleOrder()
    expect(() => transitionOrder(order, 'shipped')).toThrow(DomainError)
  })
})

describe('payment + return', () => {
  it('captures payment and marks order paid', () => {
    const order = sampleOrder()
    const payment = createPendingPayment({
      id: 'pay_1',
      orderId: order.id,
      amountCents: order.totalCents,
      idempotencyKey: 'pay-ik',
    })
    const result = capturePayment(payment, order)
    expect(result.payment.status).toBe('captured')
    expect(result.order.status).toBe('paid')
  })

  it('rejects amount mismatch', () => {
    const order = sampleOrder()
    const payment = createPendingPayment({
      id: 'pay_2',
      orderId: order.id,
      amountCents: 1,
      idempotencyKey: 'pay-ik-2',
    })
    expect(() => capturePayment(payment, order)).toThrow(DomainError)
    try {
      capturePayment(payment, order)
    } catch (e) {
      expect((e as DomainError).code).toBe('PAYMENT_AMOUNT_MISMATCH')
    }
  })

  it('refunds via return from paid', () => {
    let order = sampleOrder()
    const pending = createPendingPayment({
      id: 'pay_3',
      orderId: order.id,
      amountCents: order.totalCents,
      idempotencyKey: 'pay-ik-3',
    })
    const paid = capturePayment(pending, order)
    order = paid.order
    const ret = createReturnRequest({
      id: 'ret_1',
      order,
      reason: 'changed mind',
      idempotencyKey: 'ret-ik',
    })
    const approved = { ...ret, status: 'approved' as const }
    const done = completeReturnRefund(approved, order, paid.payment)
    expect(done.order.status).toBe('refunded')
    expect(done.payment.status).toBe('refunded')
    expect(done.return.status).toBe('refunded')
  })
})
