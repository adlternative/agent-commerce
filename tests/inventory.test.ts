import { describe, expect, it } from 'vitest'
import {
  InventoryLockManager,
  available,
  commitInventory,
  createInventory,
  lockInventory,
  unlockInventory,
  type InventoryState,
} from '../src/lib/inventory'

const seeds = [
  { id: 'sku-001', stock: 7 },
  { id: 'sku-002', stock: 1 },
  { id: 'sku-003', stock: 0 },
]

describe('inventory lock (pure)', () => {
  it('creates ledger with available equal to onHand', () => {
    const inv = createInventory(seeds)
    expect(available(inv, 'sku-001')).toBe(7)
    expect(available(inv, 'sku-002')).toBe(1)
    expect(available(inv, 'sku-003')).toBe(0)
  })

  it('lockInventory reserves stock and reduces available', () => {
    const inv = createInventory(seeds)
    const { state, lock } = lockInventory(inv, 'sku-001', 3)
    expect(lock).toMatchObject({ productId: 'sku-001', qty: 3 })
    expect(available(state, 'sku-001')).toBe(4)
    expect(state.levels['sku-001'].reserved).toBe(3)
    expect(state.levels['sku-001'].onHand).toBe(7)
  })

  it('does not mutate input state on lock', () => {
    const inv = createInventory(seeds)
    const before = structuredClone(inv) as InventoryState
    lockInventory(inv, 'sku-001', 2)
    expect(inv).toEqual(before)
  })

  it('rejects lock when qty exceeds available', () => {
    const inv = createInventory(seeds)
    expect(() => lockInventory(inv, 'sku-001', 8)).toThrow(/insufficient stock/)
  })

  it('rejects non-positive lock qty', () => {
    const inv = createInventory(seeds)
    expect(() => lockInventory(inv, 'sku-001', 0)).toThrow(/qty must be positive/)
  })

  it('throws on unknown product', () => {
    const inv = createInventory(seeds)
    expect(() => lockInventory(inv, 'nope', 1)).toThrow(/unknown product/)
  })

  it('unlockInventory restores available without changing onHand', () => {
    const inv = createInventory(seeds)
    const { state: locked, lock } = lockInventory(inv, 'sku-001', 2)
    const unlocked = unlockInventory(locked, lock.id)
    expect(available(unlocked, 'sku-001')).toBe(7)
    expect(unlocked.levels['sku-001'].onHand).toBe(7)
    expect(unlocked.locks[lock.id]).toBeUndefined()
  })

  it('commitInventory deducts onHand and clears reservation', () => {
    const inv = createInventory(seeds)
    const { state: locked, lock } = lockInventory(inv, 'sku-001', 2)
    const committed = commitInventory(locked, lock.id)
    expect(committed.levels['sku-001'].onHand).toBe(5)
    expect(committed.levels['sku-001'].reserved).toBe(0)
    expect(available(committed, 'sku-001')).toBe(5)
    expect(committed.locks[lock.id]).toBeUndefined()
  })

  it('sequential locks cannot oversell', () => {
    let state = createInventory([{ id: 'sku-x', stock: 2 }])
    const a = lockInventory(state, 'sku-x', 2)
    state = a.state
    expect(() => lockInventory(state, 'sku-x', 1)).toThrow(/insufficient stock/)
  })
})

describe('InventoryLockManager (async lock)', () => {
  it('serializes concurrent locks so only one takes the last unit', async () => {
    const manager = new InventoryLockManager([{ id: 'sku-last', stock: 1 }])
    const results = await Promise.allSettled([
      manager.lock('sku-last', 1),
      manager.lock('sku-last', 1),
      manager.lock('sku-last', 1),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(2)
    expect(manager.available('sku-last')).toBe(0)
  })

  it('unlock frees stock for a later lock', async () => {
    const manager = new InventoryLockManager([{ id: 'sku-y', stock: 1 }])
    const hold = await manager.lock('sku-y', 1)
    expect(manager.available('sku-y')).toBe(0)
    await manager.unlock(hold.id)
    expect(manager.available('sku-y')).toBe(1)
    const again = await manager.lock('sku-y', 1)
    expect(again.qty).toBe(1)
  })

  it('commit permanently reduces onHand', async () => {
    const manager = new InventoryLockManager([{ id: 'sku-z', stock: 3 }])
    const hold = await manager.lock('sku-z', 2)
    await manager.commit(hold.id)
    expect(manager.available('sku-z')).toBe(1)
    expect(manager.snapshot().levels['sku-z'].onHand).toBe(1)
  })
})
