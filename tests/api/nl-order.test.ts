import { describe, expect, it, vi } from 'vitest'
import { parseNlIntent, runNlOrder } from '../../src/api/nl-order.js'
import { formatCents } from '../../src/api/format.js'
import type { CommerceApi } from '../../src/api/client.js'

describe('formatCents', () => {
  it('formats integer cents without floats', () => {
    expect(formatCents(0)).toBe('¥0.00')
    expect(formatCents(2500)).toBe('¥25.00')
    expect(formatCents(99)).toBe('¥0.99')
  })
})

describe('parseNlIntent', () => {
  it('extracts quantity, query, and promo from the panel default phrasing', () => {
    const intent = parseNlIntent('帮我买两件 Agent Mug，用掉这张券 SAVE200')
    expect(intent.quantity).toBe(2)
    expect(intent.promo).toBe('SAVE200')
    expect(intent.query.toLowerCase()).toBe('agent mug')
  })

  it.each([
    ['买两件 Agent Mug', 2, 'agent mug', undefined],
    ['两件 Agent Mug', 2, 'agent mug', undefined],
    ['Buy 2 Agent Mug', 2, 'agent mug', undefined],
    ['Agent Mug', 1, 'agent mug', undefined],
    ['两件Mug用券SAVE200', 2, 'mug', 'SAVE200'],
  ] as const)('parses %j → qty=%i query=%j promo=%j', (input, qty, query, promo) => {
    const intent = parseNlIntent(input)
    expect(intent.quantity).toBe(qty)
    expect(intent.query.toLowerCase()).toBe(query)
    expect(intent.promo).toBe(promo)
    expect(intent.query).not.toMatch(/[一二两三四五六七八九十]/)
    expect(intent.query).not.toMatch(/\d+\s*(?:件|个|x|×)/i)
    expect(intent.query).not.toMatch(/(?:件|个|盒|份)/)
  })
})

describe('runNlOrder', () => {
  it('orchestrates agent API calls only', async () => {
    const product = {
      id: 'p1',
      sku: 'MUG-01',
      name: 'Agent Mug',
      description: '',
      priceCents: 2500,
      tags: [],
      agentNotes: 'notes',
      active: true,
    }
    const api = {
      agent: {
        listProducts: vi.fn(async () => [product]),
        createCart: vi.fn(async () => ({ id: 'c1', customerId: 'nl', items: [] })),
        addItem: vi.fn(async () => ({ id: 'c1', customerId: 'nl', items: [] })),
        applyPromotion: vi.fn(async () => ({ id: 'c1', customerId: 'nl', items: [] })),
        quoteCart: vi.fn(async () => ({
          subtotalCents: 5000,
          discountCents: 200,
          totalCents: 4800,
          lines: [],
        })),
        placeOrder: vi.fn(async () => ({
          id: 'o1',
          status: 'created',
          totalCents: 4800,
          subtotalCents: 5000,
          discountCents: 200,
          lines: [],
        })),
        payOrder: vi.fn(async () => ({
          order: {
            id: 'o1',
            status: 'paid',
            totalCents: 4800,
            subtotalCents: 5000,
            discountCents: 200,
            lines: [],
          },
        })),
        getOrder: vi.fn(),
      },
    } as unknown as CommerceApi

    const result = await runNlOrder(api, '帮我买两件 Agent Mug，用掉这张券 SAVE200')
    expect(result.error).toBeUndefined()
    expect(result.order?.status).toBe('paid')
    expect(api.agent.listProducts).toHaveBeenCalledWith('Agent Mug')
    expect(api.agent.addItem).toHaveBeenCalledWith('c1', 'p1', 2)
    expect(api.agent.applyPromotion).toHaveBeenCalledWith('c1', 'SAVE200')
    expect(api.agent.placeOrder).toHaveBeenCalled()
    expect(api.agent.payOrder).toHaveBeenCalledWith('o1')
  })

  it('returns parse-failure message when quantity/product name cannot be understood', async () => {
    const api = {
      agent: {
        listProducts: vi.fn(),
      },
    } as unknown as CommerceApi

    const result = await runNlOrder(api, '买两件')
    expect(result.error).toBe('没听懂数量或商品名')
    expect(result.error).not.toMatch(/未找到商品/)
    expect(api.agent.listProducts).not.toHaveBeenCalled()
  })
})
