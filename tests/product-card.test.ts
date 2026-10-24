import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ProductCard, type Product } from '../src/components/ProductCard'

const baseProduct: Product = {
  id: 'sku-001',
  name: 'Agent 键帽套装',
  priceCents: 12900,
  stock: 7,
  tags: ['hardware', 'gift'],
  agentNotes: 'ABS 材质，兼容 MX 轴。',
}

describe('ProductCard', () => {
  it('renders 已售罄 and disables the button when stock is 0', () => {
    const onAdd = vi.fn()
    const html = renderToStaticMarkup(
      createElement(ProductCard, { product: { ...baseProduct, stock: 0 }, onAdd }),
    )

    expect(html).toContain('已售罄')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/)
    expect(html).not.toContain('加入购物车')
  })

  it('shows remaining stock and keeps the button enabled when in stock', () => {
    const onAdd = vi.fn()
    const html = renderToStaticMarkup(
      createElement(ProductCard, { product: baseProduct, onAdd }),
    )

    expect(html).toContain('加入购物车（余 7）')
    expect(html).not.toContain('已售罄')
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>/)
  })
})
