import { z } from 'zod'
import { DomainError } from './errors.js'

export const StockLevelSchema = z.object({
  productId: z.string().min(1),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
})

export type StockLevel = z.infer<typeof StockLevelSchema>

/** Default hold window for unpaid order reservations (15 minutes). */
export const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1000

export const ReservationSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  /** created | committed | released */
  status: z.enum(['created', 'committed', 'released']),
  createdAt: z.string().datetime(),
  /** ISO timestamp after which a still-created hold may be auto-released. */
  expiresAt: z.string().datetime(),
})

export type Reservation = z.infer<typeof ReservationSchema>

export function isReservationExpired(reservation: Reservation, now: Date = new Date()): boolean {
  if (reservation.status !== 'created') return false
  return reservation.expiresAt <= now.toISOString()
}

export function createReservation(input: {
  id: string
  productId: string
  quantity: number
  ttlMs?: number
  now?: Date
}): Reservation {
  const now = input.now ?? new Date()
  const ttlMs = input.ttlMs ?? DEFAULT_RESERVATION_TTL_MS
  return {
    id: input.id,
    productId: input.productId,
    quantity: input.quantity,
    status: 'created',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  }
}

export function availableQty(stock: StockLevel): number {
  return stock.onHand - stock.reserved
}

/**
 * Batch sellable qty for many products in one pass (no N+1 inventory lookups).
 * Missing stock rows map to `0`. Callers should load stock once
 * (`WHERE product_id IN (...)` or a single `SELECT * FROM stock`).
 */
export function batchAvailableByProductIds(
  stock: readonly StockLevel[],
  productIds: readonly string[],
): Map<string, number> {
  const want = new Set(productIds)
  const byId = new Map<string, number>()
  for (const row of stock) {
    if (!want.has(row.productId)) continue
    byId.set(row.productId, availableQty(row))
  }
  for (const id of productIds) {
    if (!byId.has(id)) byId.set(id, 0)
  }
  return byId
}

/**
 * Pure reserve: increases reserved if available. Does not mutate input.
 * Caller must serialize concurrent calls (see InventoryLedger).
 */
export function reserveStock(
  stock: StockLevel,
  quantity: number,
): { stock: StockLevel; available: number } {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', 'reserve quantity must be a positive integer')
  }
  const avail = availableQty(stock)
  if (quantity > avail) {
    throw new DomainError('INSUFFICIENT_STOCK', 'not enough available inventory', {
      hint: `productId=${stock.productId} requested=${quantity} available=${avail}`,
      retryable: false,
    })
  }
  return {
    stock: { ...stock, reserved: stock.reserved + quantity },
    available: avail - quantity,
  }
}

/** Release a prior reservation back to available. */
export function releaseStock(stock: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', 'release quantity must be a positive integer')
  }
  if (quantity > stock.reserved) {
    throw new DomainError('INVALID_RELEASE', 'cannot release more than reserved', {
      hint: `reserved=${stock.reserved} quantity=${quantity}`,
    })
  }
  return { ...stock, reserved: stock.reserved - quantity }
}

/**
 * Commit a reservation: convert reserved → sold (decrement onHand and reserved).
 * This is the oversell-safe deduction path used at payment/fulfillment.
 */
export function commitStock(stock: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', 'commit quantity must be a positive integer')
  }
  if (quantity > stock.reserved) {
    throw new DomainError('INVALID_COMMIT', 'cannot commit more than reserved', {
      hint: `reserved=${stock.reserved} quantity=${quantity}`,
    })
  }
  if (quantity > stock.onHand) {
    throw new DomainError('INSUFFICIENT_STOCK', 'onHand too low to commit', {
      hint: `onHand=${stock.onHand} quantity=${quantity}`,
    })
  }
  return {
    productId: stock.productId,
    onHand: stock.onHand - quantity,
    reserved: stock.reserved - quantity,
  }
}

/** Merchant stock adjustment (can increase or decrease onHand). */
export function adjustOnHand(stock: StockLevel, delta: number): StockLevel {
  if (!Number.isInteger(delta)) {
    throw new DomainError('INVALID_QUANTITY', 'stock delta must be an integer')
  }
  const next = stock.onHand + delta
  if (next < 0) {
    throw new DomainError('INVALID_ADJUSTMENT', 'onHand cannot go negative', {
      hint: `onHand=${stock.onHand} delta=${delta}`,
    })
  }
  if (next < stock.reserved) {
    throw new DomainError('INVALID_ADJUSTMENT', 'onHand cannot fall below reserved', {
      hint: `onHand would be ${next}, reserved=${stock.reserved}`,
    })
  }
  return { ...stock, onHand: next }
}

/**
 * Serializes inventory mutations for a single product so concurrent
 * reserves cannot oversell. Used by tests and the JSON repository.
 */
export class InventoryLedger {
  private readonly stocks = new Map<string, StockLevel>()
  private readonly chains = new Map<string, Promise<unknown>>()

  seed(levels: StockLevel[]): void {
    for (const level of levels) {
      this.stocks.set(level.productId, { ...level })
    }
  }

  get(productId: string): StockLevel {
    const s = this.stocks.get(productId)
    if (!s) {
      throw new DomainError('STOCK_NOT_FOUND', `no stock for product ${productId}`)
    }
    return { ...s }
  }

  /** Run `fn` exclusively for `productId` (async mutex per SKU). */
  async withLock<T>(productId: string, fn: (stock: StockLevel) => T | Promise<T>): Promise<T> {
    const prev = this.chains.get(productId) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const next = prev.then(() => gate)
    this.chains.set(
      productId,
      next.catch(() => undefined),
    )
    await prev
    try {
      const current = this.get(productId)
      const result = await fn(current)
      return result
    } finally {
      release()
    }
  }

  async reserve(productId: string, quantity: number): Promise<StockLevel> {
    return this.withLock(productId, (stock) => {
      const { stock: next } = reserveStock(stock, quantity)
      this.stocks.set(productId, next)
      return { ...next }
    })
  }

  async release(productId: string, quantity: number): Promise<StockLevel> {
    return this.withLock(productId, (stock) => {
      const next = releaseStock(stock, quantity)
      this.stocks.set(productId, next)
      return { ...next }
    })
  }

  async commit(productId: string, quantity: number): Promise<StockLevel> {
    return this.withLock(productId, (stock) => {
      const next = commitStock(stock, quantity)
      this.stocks.set(productId, next)
      return { ...next }
    })
  }

  async adjust(productId: string, delta: number): Promise<StockLevel> {
    return this.withLock(productId, (stock) => {
      const next = adjustOnHand(stock, delta)
      this.stocks.set(productId, next)
      return { ...next }
    })
  }
}
