/** Per-SKU stock snapshot. `available = onHand - reserved`. */
export interface StockLevel {
  productId: string
  onHand: number
  reserved: number
}

/** A hold on reserved units until unlock or commit. */
export interface InventoryLock {
  id: string
  productId: string
  qty: number
}

/** Immutable inventory ledger: levels + active locks. */
export interface InventoryState {
  levels: Record<string, StockLevel>
  locks: Record<string, InventoryLock>
}

export type StockSeed = { id: string; stock: number }

let lockSeq = 0

function nextLockId(): string {
  lockSeq += 1
  return `lock-${lockSeq}`
}

function cloneState(state: InventoryState): InventoryState {
  const levels: Record<string, StockLevel> = {}
  for (const [id, level] of Object.entries(state.levels)) {
    levels[id] = { ...level }
  }
  const locks: Record<string, InventoryLock> = {}
  for (const [id, lock] of Object.entries(state.locks)) {
    locks[id] = { ...lock }
  }
  return { levels, locks }
}

function requireLevel(state: InventoryState, productId: string): StockLevel {
  const level = state.levels[productId]
  if (!level) throw new Error(`unknown product: ${productId}`)
  return level
}

/** Build ledger from catalog-like seeds. Does not mutate `products`. */
export function createInventory(products: StockSeed[]): InventoryState {
  const levels: Record<string, StockLevel> = {}
  for (const p of products) {
    if (p.stock < 0) throw new Error('stock must be >= 0')
    levels[p.id] = { productId: p.id, onHand: p.stock, reserved: 0 }
  }
  return { levels, locks: {} }
}

/** Units free to reserve: onHand − reserved. */
export function available(state: InventoryState, productId: string): number {
  const level = requireLevel(state, productId)
  return level.onHand - level.reserved
}

/**
 * Reserve `qty` for checkout. Pure: returns a new state + lock; does not mutate input.
 * Throws on unknown SKU, non-positive qty, or insufficient available stock.
 */
export function lockInventory(
  state: InventoryState,
  productId: string,
  qty: number,
): { state: InventoryState; lock: InventoryLock } {
  if (qty <= 0) throw new Error('qty must be positive')
  const next = cloneState(state)
  const level = requireLevel(next, productId)
  const free = level.onHand - level.reserved
  if (qty > free) {
    throw new Error(`insufficient stock: ${productId} requested ${qty}, available ${free}`)
  }
  level.reserved += qty
  const lock: InventoryLock = { id: nextLockId(), productId, qty }
  next.locks[lock.id] = lock
  return { state: next, lock }
}

/** Release a reservation without selling. Pure; unknown lockId throws. */
export function unlockInventory(state: InventoryState, lockId: string): InventoryState {
  const next = cloneState(state)
  const lock = next.locks[lockId]
  if (!lock) throw new Error(`unknown lock: ${lockId}`)
  const level = requireLevel(next, lock.productId)
  level.reserved -= lock.qty
  delete next.locks[lockId]
  return next
}

/**
 * Finalize a sale: decrement onHand and clear the reservation.
 * Pure; unknown lockId throws.
 */
export function commitInventory(state: InventoryState, lockId: string): InventoryState {
  const next = cloneState(state)
  const lock = next.locks[lockId]
  if (!lock) throw new Error(`unknown lock: ${lockId}`)
  const level = requireLevel(next, lock.productId)
  level.onHand -= lock.qty
  level.reserved -= lock.qty
  delete next.locks[lockId]
  return next
}

/**
 * Per-SKU async mutex so concurrent `lock` calls serialize.
 * Exactly one of N concurrent last-unit locks succeeds.
 */
export class InventoryLockManager {
  private state: InventoryState
  private queues = new Map<string, Promise<unknown>>()

  constructor(products: StockSeed[]) {
    this.state = createInventory(products)
  }

  snapshot(): InventoryState {
    return cloneState(this.state)
  }

  available(productId: string): number {
    return available(this.state, productId)
  }

  private async withSkuLock<T>(productId: string, fn: () => T): Promise<T> {
    const prev = this.queues.get(productId) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    this.queues.set(
      productId,
      prev.then(() => gate).catch(() => gate),
    )
    await prev.catch(() => undefined)
    try {
      return fn()
    } finally {
      release()
    }
  }

  async lock(productId: string, qty: number): Promise<InventoryLock> {
    return this.withSkuLock(productId, () => {
      const result = lockInventory(this.state, productId, qty)
      this.state = result.state
      return result.lock
    })
  }

  async unlock(lockId: string): Promise<void> {
    const lock = this.state.locks[lockId]
    if (!lock) throw new Error(`unknown lock: ${lockId}`)
    await this.withSkuLock(lock.productId, () => {
      this.state = unlockInventory(this.state, lockId)
    })
  }

  async commit(lockId: string): Promise<void> {
    const lock = this.state.locks[lockId]
    if (!lock) throw new Error(`unknown lock: ${lockId}`)
    await this.withSkuLock(lock.productId, () => {
      this.state = commitInventory(this.state, lockId)
    })
  }
}
