import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  AddToCartPayloadSchema,
  CartLineSchema,
  PricingRulesSchema,
  ProductSchema,
  parseAddToCartPayload,
  parseCartLine,
  parsePricingRules,
  parseProduct,
} from '../src/lib/schema'

const validProduct = {
  id: 'sku-001',
  name: 'Agent 键帽套装',
  priceCents: 12900,
  stock: 7,
  tags: ['hardware', 'gift'],
  agentNotes: 'ABS 材质，兼容 MX 轴；适合作为开发者礼物。',
}

const validCartLine = { productId: 'sku-001', qty: 2 }

const validPricingRules = {
  thresholdCents: 20000,
  discountCents: 3000,
  memberRate: 0.05,
  shippingCents: 800,
  freeShippingCents: 9900,
}

describe('schema', () => {
  describe('ProductSchema', () => {
    it('accepts a valid product payload', () => {
      expect(parseProduct(validProduct)).toEqual(validProduct)
      expect(ProductSchema.safeParse(validProduct).success).toBe(true)
    })

    it('rejects missing agentNotes', () => {
      const { agentNotes: _, ...rest } = validProduct
      const result = ProductSchema.safeParse(rest)
      expect(result.success).toBe(false)
      expect(() => parseProduct(rest)).toThrow(ZodError)
    })

    it('rejects negative priceCents and non-integer stock', () => {
      expect(
        ProductSchema.safeParse({ ...validProduct, priceCents: -1 }).success,
      ).toBe(false)
      expect(
        ProductSchema.safeParse({ ...validProduct, stock: 1.5 }).success,
      ).toBe(false)
      expect(
        ProductSchema.safeParse({ ...validProduct, id: '' }).success,
      ).toBe(false)
    })
  })

  describe('CartLineSchema / AddToCartPayloadSchema', () => {
    it('accepts a valid cart line', () => {
      expect(parseCartLine(validCartLine)).toEqual(validCartLine)
    })

    it('rejects zero or negative qty', () => {
      expect(CartLineSchema.safeParse({ productId: 'sku-001', qty: 0 }).success).toBe(
        false,
      )
      expect(CartLineSchema.safeParse({ productId: 'sku-001', qty: -3 }).success).toBe(
        false,
      )
    })

    it('defaults add-to-cart qty to 1 when omitted', () => {
      expect(parseAddToCartPayload({ productId: 'sku-002' })).toEqual({
        productId: 'sku-002',
        qty: 1,
      })
    })

    it('rejects empty productId on add-to-cart', () => {
      const result = AddToCartPayloadSchema.safeParse({ productId: '', qty: 1 })
      expect(result.success).toBe(false)
    })
  })

  describe('PricingRulesSchema', () => {
    it('accepts valid pricing rules', () => {
      expect(parsePricingRules(validPricingRules)).toEqual(validPricingRules)
    })

    it('rejects memberRate outside 0–1', () => {
      expect(
        PricingRulesSchema.safeParse({ ...validPricingRules, memberRate: 1.5 }).success,
      ).toBe(false)
      expect(
        PricingRulesSchema.safeParse({ ...validPricingRules, memberRate: -0.1 }).success,
      ).toBe(false)
    })

    it('rejects fractional cents', () => {
      expect(
        PricingRulesSchema.safeParse({
          ...validPricingRules,
          shippingCents: 8.5,
        }).success,
      ).toBe(false)
    })
  })
})
