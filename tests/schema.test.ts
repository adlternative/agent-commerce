import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  parseCartLine,
  parseOrderPayload,
  parseProduct,
  safeParseOrderPayload,
  safeParseProduct,
} from '../src/lib/schema'

const validProduct = {
  id: 'sku-001',
  name: 'Agent 键帽套装',
  priceCents: 12900,
  stock: 7,
  tags: ['hardware', 'gift'],
  agentNotes: 'ABS 材质，兼容 MX 轴；适合作为开发者礼物。',
}

const validOrder = {
  lines: [{ productId: 'sku-001', qty: 2 }],
  isMember: false,
}

describe('schema — product', () => {
  it('accepts a valid product payload', () => {
    expect(parseProduct(validProduct)).toEqual(validProduct)
    expect(safeParseProduct(validProduct).success).toBe(true)
  })

  it('rejects missing agentNotes / negative price / empty id', () => {
    expect(() => parseProduct({ ...validProduct, agentNotes: '' })).toThrow(ZodError)
    expect(() => parseProduct({ ...validProduct, priceCents: -1 })).toThrow(ZodError)
    expect(() => parseProduct({ ...validProduct, id: '' })).toThrow(ZodError)
    expect(() => parseProduct({ ...validProduct, stock: 1.5 })).toThrow(ZodError)

    const bad = safeParseProduct({ ...validProduct, tags: 'not-an-array' })
    expect(bad.success).toBe(false)
  })
})

describe('schema — cart line & order', () => {
  it('accepts a valid cart line and order payload', () => {
    expect(parseCartLine({ productId: 'sku-002', qty: 1 })).toEqual({
      productId: 'sku-002',
      qty: 1,
    })
    expect(parseOrderPayload(validOrder)).toEqual(validOrder)
    expect(safeParseOrderPayload(validOrder).success).toBe(true)
  })

  it('rejects zero/negative qty, empty lines, and non-boolean isMember', () => {
    expect(() => parseCartLine({ productId: 'sku-001', qty: 0 })).toThrow(ZodError)
    expect(() => parseCartLine({ productId: 'sku-001', qty: -3 })).toThrow(ZodError)
    expect(() => parseOrderPayload({ lines: [], isMember: true })).toThrow(ZodError)

    const bad = safeParseOrderPayload({ lines: validOrder.lines, isMember: 'yes' })
    expect(bad.success).toBe(false)
  })
})
