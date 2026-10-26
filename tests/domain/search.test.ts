import { describe, expect, it } from 'vitest'
import type { Product } from '../../src/domain/product.js'
import {
  matchesCjkFallback,
  matchesPrimary,
  rankProducts,
  scoreProduct,
  tokenizeQuery,
} from '../../src/domain/search.js'
import { searchProducts } from '../../src/domain/product.js'

function product(partial: Partial<Product> & Pick<Product, 'id' | 'sku' | 'name'>): Product {
  const now = '2024-01-01T00:00:00.000Z'
  return {
    description: '',
    priceCents: 1000,
    tags: [],
    agentNotes: '',
    active: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

describe('tokenizeQuery', () => {
  it('splits latin terms and detects CJK characters', () => {
    const t = tokenizeQuery('Black Tee 智能')
    expect(t.terms).toEqual(expect.arrayContaining(['black', 'tee', '智能']))
    expect(t.hasCjk).toBe(true)
    expect(t.cjkChars).toEqual(['智', '能'])
  })
})

describe('full-text search with Chinese fallback', () => {
  const catalog = [
    product({
      id: 'p_mug',
      sku: 'MUG-01',
      name: '智能保温杯',
      description: '长续航保温',
      agentNotes: '适合长时间开会的 agent',
      tags: ['kitchen'],
    }),
    product({
      id: 'p_tee',
      sku: 'TEE-01',
      name: 'Black Tee M',
      description: 'Midweight black tee',
      agentNotes: 'Simple apparel SKU',
      tags: ['apparel'],
    }),
    product({
      id: 'p_mat',
      sku: 'MAT-01',
      name: 'Desk Mat',
      description: 'Large desk mat',
      agentNotes: '',
    }),
  ]

  it('matches latin queries across name/sku/tags/description/agentNotes', () => {
    expect(searchProducts(catalog, { q: 'apparel' }).map((p) => p.id)).toEqual(['p_tee'])
    expect(searchProducts(catalog, { q: 'MUG-01' }).map((p) => p.id)).toEqual(['p_mug'])
  })

  it('falls back to CJK character matching when phrase AND fails', () => {
    // Reordered characters: primary phrase/term miss, fallback still finds the mug.
    const q = '杯保温智能'
    const tokens = tokenizeQuery(q)
    expect(matchesPrimary(catalog[0]!, tokens)).toBe(false)
    expect(matchesCjkFallback(catalog[0]!, tokens)).toBe(true)

    const ranked = rankProducts(catalog, { q })
    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.product.id).toBe('p_mug')
    expect(ranked[0]?.mode).toBe('cjk_fallback')
  })

  it('does not use CJK fallback when primary already hits', () => {
    const ranked = rankProducts(catalog, { q: '智能保温杯' })
    expect(ranked[0]?.mode).toBe('primary')
    expect(ranked[0]?.product.id).toBe('p_mug')
  })
})

describe('agentNotes participate in ranking', () => {
  it('scores agentNotes hits and can outrank weaker description-only matches', () => {
    const notesHeavy = product({
      id: 'a',
      sku: 'A-1',
      name: 'Generic Item',
      description: '',
      agentNotes: 'ceramic mug preferred by long-running agents',
    })
    const descOnly = product({
      id: 'b',
      sku: 'B-1',
      name: 'Generic Item',
      description: 'ceramic mug in the warehouse aisle',
      agentNotes: '',
    })
    const tokens = tokenizeQuery('ceramic mug')
    const scoreNotes = scoreProduct(notesHeavy, tokens, 'primary')
    const scoreDesc = scoreProduct(descOnly, tokens, 'primary')
    expect(scoreNotes).toBeGreaterThan(scoreDesc)

    const ranked = rankProducts([descOnly, notesHeavy], { q: 'ceramic mug' })
    expect(ranked.map((h) => h.product.id)).toEqual(['a', 'b'])
  })

  it('includes agentNotes-only matches in search results', () => {
    const p = product({
      id: 'n1',
      sku: 'N-1',
      name: 'Obscure SKU',
      agentNotes: 'buy this for SAVE200 checkout demos',
    })
    expect(searchProducts([p], { q: 'SAVE200' }).map((x) => x.id)).toEqual(['n1'])
  })
})

describe('rankProducts ordering', () => {
  it('sorts by score DESC then id ASC for stable keysets', () => {
    const a = product({ id: 'id_a', sku: 'S', name: 'Widget Pro', agentNotes: 'widget' })
    const b = product({ id: 'id_b', sku: 'S', name: 'Widget Pro', agentNotes: 'widget' })
    const ranked = rankProducts([b, a], { q: 'widget' })
    expect(ranked[0]?.score).toBe(ranked[1]?.score)
    expect(ranked.map((h) => h.product.id)).toEqual(['id_a', 'id_b'])
  })
})
