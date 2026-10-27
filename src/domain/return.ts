import { z } from 'zod'
import { CentsSchema, assertCents } from './money.js'
import { DomainError } from './errors.js'
import { canTransition, transitionOrder, type Order, type OrderLine } from './order.js'
import { markPaymentRefunded, type Payment } from './payment.js'

export const ReturnStatusSchema = z.enum(['requested', 'approved', 'rejected', 'refunded'])

export type ReturnStatus = z.infer<typeof ReturnStatusSchema>

export const ReturnLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

export type ReturnLine = z.infer<typeof ReturnLineSchema>

export const ReturnRequestSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  reason: z.string().min(1),
  lines: z.array(ReturnLineSchema).min(1),
  amountCents: CentsSchema,
  status: ReturnStatusSchema,
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ReturnRequest = z.infer<typeof ReturnRequestSchema>

const RETURNABLE: ReadonlySet<Order['status']> = new Set([
  'paid',
  'shipped',
  'delivered',
  'partially_refunded',
])

/** Statuses that consume returnable quantity / refund budget. */
const ACTIVE_RETURN: ReadonlySet<ReturnStatus> = new Set(['requested', 'approved', 'refunded'])

export function assertOrderReturnable(order: Order): void {
  if (!RETURNABLE.has(order.status)) {
    throw new DomainError('ORDER_NOT_RETURNABLE', `order status ${order.status} cannot be returned`, {
      hint: 'returns allowed from paid, shipped, delivered, or partially_refunded',
    })
  }
  if (order.status === 'refunded') {
    throw new DomainError('ORDER_NOT_RETURNABLE', 'order already fully refunded')
  }
}

/**
 * Qty already claimed by non-rejected returns for a product on this order.
 */
export function returnedQtyForProduct(
  returns: readonly ReturnRequest[],
  orderId: string,
  productId: string,
): number {
  let qty = 0
  for (const ret of returns) {
    if (ret.orderId !== orderId) continue
    if (!ACTIVE_RETURN.has(ret.status)) continue
    for (const line of ret.lines) {
      if (line.productId === productId) qty += line.quantity
    }
  }
  return qty
}

/** Cents already allocated by non-rejected returns on this order. */
export function refundedCentsForOrder(
  returns: readonly ReturnRequest[],
  orderId: string,
): number {
  let sum = 0
  for (const ret of returns) {
    if (ret.orderId !== orderId) continue
    if (!ACTIVE_RETURN.has(ret.status)) continue
    sum += ret.amountCents
  }
  return sum
}

export function computeReturnAmountCents(
  order: Order,
  lines: readonly ReturnLine[],
  alreadyRefundedCents = 0,
): number {
  if (lines.length === 0) {
    throw new DomainError('INVALID_RETURN_LINES', 'return must include at least one line')
  }
  const seen = new Set<string>()
  let amount = 0
  for (const line of lines) {
    if (seen.has(line.productId)) {
      throw new DomainError('DUPLICATE_RETURN_LINE', `duplicate product ${line.productId} in return`)
    }
    seen.add(line.productId)
    if (line.quantity <= 0) {
      throw new DomainError('INVALID_RETURN_QTY', 'return quantity must be positive')
    }
    const orderLine = order.lines.find((l) => l.productId === line.productId)
    if (!orderLine) {
      throw new DomainError('RETURN_LINE_NOT_IN_ORDER', `product ${line.productId} not on order`)
    }
    if (line.quantity > orderLine.quantity) {
      throw new DomainError(
        'RETURN_QTY_EXCEEDS_ORDERED',
        `return qty ${line.quantity} exceeds ordered ${orderLine.quantity} for ${line.productId}`,
      )
    }
    amount += lineRefundCents(orderLine, line.quantity)
  }
  const remaining = order.totalCents - alreadyRefundedCents
  if (remaining < 0) {
    throw new DomainError('INVALID_RETURN_AMOUNT', 'already refunded exceeds order total')
  }
  if (amount > remaining) {
    amount = remaining
  }
  if (amount < 0) {
    throw new DomainError('INVALID_RETURN_AMOUNT', 'return amount cannot be negative')
  }
  // Full-order return with zero remaining is not returnable; zero after clamp is invalid.
  if (amount <= 0) {
    throw new DomainError('INVALID_RETURN_AMOUNT', 'return amount must be within order total')
  }
  return assertCents(amount)
}

function lineRefundCents(orderLine: OrderLine, qty: number): number {
  // Proportional share of line total (integer cents, floor).
  return Math.floor((orderLine.lineTotalCents * qty) / orderLine.quantity)
}

export function assertReturnLinesAllowed(
  order: Order,
  lines: readonly ReturnLine[],
  existingReturns: readonly ReturnRequest[],
): void {
  for (const line of lines) {
    const orderLine = order.lines.find((l) => l.productId === line.productId)
    if (!orderLine) {
      throw new DomainError('RETURN_LINE_NOT_IN_ORDER', `product ${line.productId} not on order`)
    }
    const already = returnedQtyForProduct(existingReturns, order.id, line.productId)
    if (already + line.quantity > orderLine.quantity) {
      throw new DomainError(
        'RETURN_QTY_EXCEEDS_ORDERED',
        `return qty ${already + line.quantity} exceeds ordered ${orderLine.quantity} for ${line.productId}`,
      )
    }
  }
}

export function assertNoOpenReturn(
  existingReturns: readonly ReturnRequest[],
  orderId: string,
): void {
  const open = existingReturns.find(
    (r) => r.orderId === orderId && (r.status === 'requested' || r.status === 'approved'),
  )
  if (open) {
    throw new DomainError('DUPLICATE_RETURN', `order ${orderId} already has an open return`, {
      hint: `existing return ${open.id} status=${open.status}`,
    })
  }
}

export function createReturnRequest(input: {
  id: string
  order: Order
  reason: string
  lines?: ReturnLine[]
  idempotencyKey: string
  existingReturns?: readonly ReturnRequest[]
  amountCents?: number
  now?: Date
}): ReturnRequest {
  assertOrderReturnable(input.order)
  const canFull = canTransition(input.order.status, 'refunded')
  const canPartial = canTransition(input.order.status, 'partially_refunded')
  if (!canFull && !canPartial) {
    throw new DomainError('ORDER_NOT_RETURNABLE', `cannot refund from ${input.order.status}`)
  }

  const existing = input.existingReturns ?? []
  assertNoOpenReturn(existing, input.order.id)

  const lines: ReturnLine[] =
    input.lines && input.lines.length > 0
      ? input.lines
      : input.order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }))

  assertReturnLinesAllowed(input.order, lines, existing)
  const alreadyRefunded = refundedCentsForOrder(existing, input.order.id)
  const amountCents =
    input.amountCents !== undefined
      ? (() => {
          if (input.amountCents! <= 0 || input.amountCents! > input.order.totalCents - alreadyRefunded) {
            throw new DomainError('INVALID_RETURN_AMOUNT', 'return amount must be within order total')
          }
          return assertCents(input.amountCents!)
        })()
      : computeReturnAmountCents(input.order, lines, alreadyRefunded)

  const now = (input.now ?? new Date()).toISOString()
  return {
    id: input.id,
    orderId: input.order.id,
    reason: input.reason,
    lines,
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

export function rejectReturn(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== 'requested') {
    throw new DomainError('INVALID_RETURN_STATUS', `cannot reject from ${ret.status}`)
  }
  return { ...ret, status: 'rejected', updatedAt: new Date().toISOString() }
}

/**
 * Whether this return covers the full remaining order (all qty or full remaining cents).
 */
export function isFullReturn(
  order: Order,
  ret: ReturnRequest,
  existingReturns: readonly ReturnRequest[],
): boolean {
  const others = existingReturns.filter((r) => r.id !== ret.id)
  const priorCents = refundedCentsForOrder(others, order.id)
  if (priorCents + ret.amountCents >= order.totalCents) return true
  for (const orderLine of order.lines) {
    const priorQty = returnedQtyForProduct(others, order.id, orderLine.productId)
    const thisQty = ret.lines.find((l) => l.productId === orderLine.productId)?.quantity ?? 0
    if (priorQty + thisQty < orderLine.quantity) return false
  }
  return true
}

/**
 * Complete return: refund payment (full) or leave captured (partial), update order status.
 */
export function completeReturnRefund(
  ret: ReturnRequest,
  order: Order,
  payment: Payment,
  existingReturns: readonly ReturnRequest[] = [],
): { return: ReturnRequest; order: Order; payment: Payment } {
  if (ret.orderId !== order.id) {
    throw new DomainError('RETURN_ORDER_MISMATCH', 'return does not belong to order')
  }
  if (ret.status !== 'approved' && ret.status !== 'requested') {
    throw new DomainError('INVALID_RETURN_STATUS', `cannot refund return in ${ret.status}`)
  }
  assertOrderReturnable(order)
  if (ret.amountCents < 0 || ret.amountCents > order.totalCents) {
    throw new DomainError('INVALID_RETURN_AMOUNT', 'return amount must be within order total')
  }

  const full = isFullReturn(order, ret, existingReturns)
  const refundedReturn: ReturnRequest = {
    ...ret,
    status: 'refunded',
    updatedAt: new Date().toISOString(),
  }

  if (full) {
    const refundedPayment =
      payment.status === 'refunded' ? payment : markPaymentRefunded(payment)
    const refundedOrder =
      order.status === 'refunded' ? order : transitionOrder(order, 'refunded')
    return { return: refundedReturn, order: refundedOrder, payment: refundedPayment }
  }

  // Partial: restock happens in service; order → partially_refunded; payment stays captured.
  const nextOrder =
    order.status === 'partially_refunded'
      ? { ...order, updatedAt: new Date().toISOString() }
      : transitionOrder(order, 'partially_refunded')
  return { return: refundedReturn, order: nextOrder, payment }
}
