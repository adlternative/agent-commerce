import { describe, expect, it } from 'vitest'
import {
  InventoryLedger,
  adjustOnHand,
  availableQty,
  commitStock,
  releaseStock,
  reserveStock,
} from '../../src/domain/inventory.js'
import { DomainError } from '../../src/domain/errors.js'

describe('inventory pure ops', () => {
  const base = { productId: 'p1', onHand: 10, reserved: 2 }

  it('computes available', () => {
    expect(availableQty(base)).toBe(8)
  })

  it('reserves without mutating input', () => {
    const { stock, available } = reserveStock(base, 3)
    expect(stock.reserved).toBe(5)
    expect(available).toBe(5)
    expect(base.reserved).toBe(2)
  })

  it('rejects oversell on reserve', () => {
    expect(() => reserveStock(base, 9)).toThrow(DomainError)
    try {
      reserveStock(base, 9)
    } catch (e) {
      const err = e as DomainError
      expect(err.code).toBe('INSUFFICIENT_STOCK')
      expect(err.toJSON()).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        retryable: false,
      })
    }
  })

  it('commits reserved stock', () => {
    const reserved = reserveStock(base, 4).stock
    const committed = commitStock(reserved, 4)
    expect(committed).toEqual({ productId: 'p1', onHand: 6, reserved: 2 })
  })

  it('releases reservation', () => {
    expect(releaseStock(base, 2)).toEqual({ productId: 'p1', onHand: 10, reserved: 0 })
  })

  it('adjusts onHand with guards', () => {
    expect(adjustOnHand(base, 5).onHand).toBe(15)
    expect(() => adjustOnHand(base, -9)).toThrow(/below reserved|negative/)
  })
})

describe('InventoryLedger concurrency', () => {
  it('allows only stock-capacity successes under concurrent reserve', async () => {
    const ledger = new InventoryLedger()
    ledger.seed([{ productId: 'sku-a', onHand: 5, reserved: 0 }])

    const attempts = Array.from({ length: 20 }, () =>
      ledger.reserve('sku-a', 1).then(
        () => ({ ok: true as const }),
        (err: unknown) => ({ ok: false as const, err }),
      ),
    )

    const results = await Promise.all(attempts)
    const wins = results.filter((r) => r.ok)
    const losses = results.filter((r) => !r.ok)

    expect(wins).toHaveLength(5)
    expect(losses).toHaveLength(15)
    for (const loss of losses) {
      expect(loss.ok).toBe(false)
      if (!loss.ok) {
        expect(loss.err).toBeInstanceOf(DomainError)
        expect((loss.err as DomainError).code).toBe('INSUFFICIENT_STOCK')
      }
    }

    const final = ledger.get('sku-a')
    expect(final.onHand).toBe(5)
    expect(final.reserved).toBe(5)
    expect(availableQty(final)).toBe(0)
  })

  it('serializes reserve+commit without overselling', async () => {
    const ledger = new InventoryLedger()
    ledger.seed([{ productId: 'sku-b', onHand: 3, reserved: 0 }])

    await Promise.all([
      ledger.reserve('sku-b', 2).then(() => ledger.commit('sku-b', 2)),
      ledger.reserve('sku-b', 2).then(
        () => {
          throw new Error('should not reserve')
        },
        (err: DomainError) => {
          expect(err.code).toBe('INSUFFICIENT_STOCK')
        },
      ),
    ])

    expect(ledger.get('sku-b')).toEqual({ productId: 'sku-b', onHand: 1, reserved: 0 })
  })
})
