import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ProductCard, type Product } from '../src/components/ProductCard'

const baseProduct: Product = {
  id: 'sku-001',
  name: 'Agent 键帽套装',
  priceCents: 12900,
  stock: 7,
  tags: ['hardware', 'gift'],
  agentNotes: 'ABS 材质，兼容 MX 轴。',
}

function renderCard(product: Product, onAdd = vi.fn()) {
  return renderToStaticMarkup(createElement(ProductCard, { product, onAdd }))
}

describe('ProductCard', () => {
  it('renders product name and price when in stock', () => {
    const html = renderCard(baseProduct)
    expect(html).toContain('Agent 键帽套装')
    expect(html).toContain('¥129.00')
    expect(html).toContain('加入购物车（余 7）')
    expect(html).not.toContain('已售罄')
    expect(html).not.toMatch(/<button[^>]*\sdisabled/)
  })

  it('renders 已售罄 and disables the button when stock is 0', () => {
    const html = renderCard({ ...baseProduct, stock: 0 })
    expect(html).toContain('已售罄')
    expect(html).toMatch(/<button[^>]*\sdisabled/)
    expect(html).not.toContain('加入购物车')
  })
})
