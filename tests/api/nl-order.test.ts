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
  it('extracts quantity, query, and promo', () => {
    const intent = parseNlIntent('帮我买两件 Agent Mug，用掉这张券 SAVE200')
    expect(intent.quantity).toBe(2)
    expect(intent.promo).toBe('SAVE200')
    expect(intent.query.toLowerCase()).toContain('agent mug')
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
    expect(api.agent.listProducts).toHaveBeenCalled()
    expect(api.agent.addItem).toHaveBeenCalledWith('c1', 'p1', 2)
    expect(api.agent.applyPromotion).toHaveBeenCalledWith('c1', 'SAVE200')
    expect(api.agent.placeOrder).toHaveBeenCalled()
    expect(api.agent.payOrder).toHaveBeenCalledWith('o1')
  })
})
