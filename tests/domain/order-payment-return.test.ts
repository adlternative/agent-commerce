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

  it('rejects duplicate open return', () => {
    let order = sampleOrder()
    order = capturePayment(
      createPendingPayment({
        id: 'pay_dup',
        orderId: order.id,
        amountCents: order.totalCents,
        idempotencyKey: 'pay-dup',
      }),
      order,
    ).order
    const first = createReturnRequest({
      id: 'ret_dup_1',
      order,
      reason: 'first',
      idempotencyKey: 'ret-dup-1',
    })
    expect(() =>
      createReturnRequest({
        id: 'ret_dup_2',
        order,
        reason: 'second',
        idempotencyKey: 'ret-dup-2',
        existingReturns: [first],
      }),
    ).toThrow(DomainError)
    try {
      createReturnRequest({
        id: 'ret_dup_2',
        order,
        reason: 'second',
        idempotencyKey: 'ret-dup-2',
        existingReturns: [first],
      })
    } catch (e) {
      expect((e as DomainError).code).toBe('DUPLICATE_RETURN')
    }
  })

  it('rejects return qty greater than ordered', () => {
    let order = sampleOrder()
    order = capturePayment(
      createPendingPayment({
        id: 'pay_qty',
        orderId: order.id,
        amountCents: order.totalCents,
        idempotencyKey: 'pay-qty',
      }),
      order,
    ).order
    expect(() =>
      createReturnRequest({
        id: 'ret_qty',
        order,
        reason: 'too many',
        lines: [{ productId: 'p1', quantity: 99 }],
        idempotencyKey: 'ret-qty',
      }),
    ).toThrow(DomainError)
    try {
      createReturnRequest({
        id: 'ret_qty',
        order,
        reason: 'too many',
        lines: [{ productId: 'p1', quantity: 99 }],
        idempotencyKey: 'ret-qty',
      })
    } catch (e) {
      expect((e as DomainError).code).toBe('RETURN_QTY_EXCEEDS_ORDERED')
    }
  })

  it('rejects return on already-refunded order', () => {
    let order = sampleOrder()
    const pending = createPendingPayment({
      id: 'pay_rf',
      orderId: order.id,
      amountCents: order.totalCents,
      idempotencyKey: 'pay-rf',
    })
    const paid = capturePayment(pending, order)
    order = paid.order
    const ret = createReturnRequest({
      id: 'ret_rf',
      order,
      reason: 'full',
      idempotencyKey: 'ret-rf',
    })
    const done = completeReturnRefund({ ...ret, status: 'approved' }, order, paid.payment)
    expect(done.order.status).toBe('refunded')
    expect(() =>
      createReturnRequest({
        id: 'ret_rf2',
        order: done.order,
        reason: 'again',
        idempotencyKey: 'ret-rf2',
        existingReturns: [done.return],
      }),
    ).toThrow(DomainError)
    try {
      createReturnRequest({
        id: 'ret_rf2',
        order: done.order,
        reason: 'again',
        idempotencyKey: 'ret-rf2',
        existingReturns: [done.return],
      })
    } catch (e) {
      expect((e as DomainError).code).toBe('ORDER_NOT_RETURNABLE')
    }
  })
})
