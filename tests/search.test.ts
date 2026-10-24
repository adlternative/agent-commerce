import { describe, expect, it } from 'vitest'
import { filterProducts, type SearchableProduct } from '../src/lib/search'

const catalog: SearchableProduct[] = [
  {
    id: 'sku-001',
    name: 'Agent 键帽套装',
    tags: ['hardware', 'gift'],
    agentNotes: 'ABS 材质，兼容 MX 轴；适合作为开发者礼物。',
    stock: 7,
  },
  {
    id: 'sku-002',
    name: 'MCP 调试器（虚拟）',
    tags: ['software', 'devtool'],
    agentNotes: '数字商品，下单后立刻签发 license key。',
    stock: 0,
  },
  {
    id: 'sku-003',
    name: '结构化购物车 API 订阅（年）',
    tags: ['subscription', 'api'],
    agentNotes: '面向 agent 的 JSON-first 下单接口。',
    stock: 30,
  },
]

describe('filterProducts', () => {
  it('returns all products when filter is empty', () => {
    expect(filterProducts(catalog)).toEqual(catalog)
    expect(filterProducts(catalog, {})).toEqual(catalog)
  })

  it('returns all products for blank / whitespace query', () => {
    expect(filterProducts(catalog, { query: '' })).toHaveLength(3)
    expect(filterProducts(catalog, { query: '   ' })).toHaveLength(3)
  })

  it('matches name case-insensitively', () => {
    const hits = filterProducts(catalog, { query: 'mcp' })
    expect(hits.map((p) => p.id)).toEqual(['sku-002'])
  })

  it('matches agentNotes', () => {
    const hits = filterProducts(catalog, { query: 'license' })
    expect(hits.map((p) => p.id)).toEqual(['sku-002'])
  })

  it('matches tags via query', () => {
    const hits = filterProducts(catalog, { query: 'hardware' })
    expect(hits.map((p) => p.id)).toEqual(['sku-001'])
  })

  it('filters by required tags (all must match)', () => {
    const hits = filterProducts(catalog, { tags: ['software', 'devtool'] })
    expect(hits.map((p) => p.id)).toEqual(['sku-002'])
  })

  it('tag filter is case-insensitive', () => {
    const hits = filterProducts(catalog, { tags: ['API'] })
    expect(hits.map((p) => p.id)).toEqual(['sku-003'])
  })

  it('excludes out-of-stock when inStockOnly', () => {
    const hits = filterProducts(catalog, { inStockOnly: true })
    expect(hits.map((p) => p.id)).toEqual(['sku-001', 'sku-003'])
  })

  it('combines query, tags, and inStockOnly', () => {
    const hits = filterProducts(catalog, {
      query: 'agent',
      tags: ['hardware'],
      inStockOnly: true,
    })
    expect(hits.map((p) => p.id)).toEqual(['sku-001'])
  })

  it('returns empty array when nothing matches', () => {
    expect(filterProducts(catalog, { query: 'nonexistent-xyz' })).toEqual([])
  })

  it('does not mutate the input array', () => {
    const snapshot = catalog.map((p) => ({ ...p, tags: [...p.tags] }))
    filterProducts(catalog, { query: 'mcp', inStockOnly: true })
    expect(catalog).toEqual(snapshot)
  })
})
