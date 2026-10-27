import { describe, expect, it } from 'vitest'
import { DomainError } from '../../src/domain/errors.js'
import {
  parseUpsertProductInput,
  UpsertProductInputSchema,
} from '../../src/domain/product.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'

describe('UpsertProductInput stock + strict fields', () => {
  it('accepts stock and defaults omission', () => {
    expect(
      parseUpsertProductInput({
        sku: 'A',
        name: 'A',
        priceCents: 100,
        stock: 7,
      }).stock,
    ).toBe(7)
    expect(
      parseUpsertProductInput({
        sku: 'B',
        name: 'B',
        priceCents: 100,
      }).stock,
    ).toBeUndefined()
  })

  it('rejects unknown fields with UNKNOWN_FIELD', () => {
    expect(() =>
      parseUpsertProductInput({
        sku: 'C',
        name: 'C',
        priceCents: 100,
        onHand: 3,
      }),
    ).toThrow(DomainError)
    try {
      parseUpsertProductInput({
        sku: 'C',
        name: 'C',
        priceCents: 100,
        weird: true,
      })
      expect.unreachable('should throw')
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError)
      expect((err as DomainError).code).toBe('UNKNOWN_FIELD')
      expect((err as DomainError).hint).toContain('weird')
    }
  })

  it('schema.strict strips nothing — unrecognized_keys on parse', () => {
    const result = UpsertProductInputSchema.safeParse({
      sku: 'D',
      name: 'D',
      priceCents: 1,
      extra: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('CommerceService upsertProduct stock → onHand', () => {
  it('seeds onHand from stock and allows cart→order', async () => {
    const svc = new CommerceService(new MemoryRepository())
    const product = await svc.upsertProduct(
      { sku: 'S1', name: 'Stocked', priceCents: 500, stock: 4 },
      'upsert-stock-1',
    )
    expect(product.onHand).toBe(4)
    expect(product.available).toBe(4)
    expect((await svc.checkInventory(product.id)).onHand).toBe(4)

    const cart = await svc.createCart('cust_1', 'cart-stock-1')
    await svc.addItem(cart.id, product.id, 2, 'add-stock-1')
    const order = await svc.placeOrder(cart.id, 'order-stock-1')
    expect(order.status).toBe('created')
  })
})
