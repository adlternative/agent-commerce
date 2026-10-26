import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'
import { callTool, TOOL_DESCRIPTIONS, ToolSchemas } from '../../src/mcp/tools.js'
import { createMcpServer } from '../../src/mcp/create-mcp-server.js'

async function seeded() {
  const commerce = new CommerceService(new MemoryRepository())
  const product = await commerce.upsertProduct(
    {
      sku: 'MCP-1',
      name: 'MCP Widget',
      priceCents: 1_200,
      tags: ['gadgets'],
      agentNotes: 'Buy 1–3 units.',
    },
    'mcp-seed-p',
  )
  await commerce.adjustStock(product.id, 10, 'mcp-seed-s')
  await commerce.upsertPromotion(
    {
      code: 'OFF100',
      type: 'coupon_fixed',
      offCents: 100,
      active: true,
    },
    'mcp-seed-promo',
  )
  return { commerce, product }
}

describe('MCP tool handlers', () => {
  it('registers all 16 tools with LLM-oriented descriptions', () => {
    expect(Object.keys(ToolSchemas)).toHaveLength(16)
    expect(Object.keys(TOOL_DESCRIPTIONS)).toHaveLength(16)
    for (const name of Object.keys(ToolSchemas) as (keyof typeof ToolSchemas)[]) {
      expect(TOOL_DESCRIPTIONS[name].length).toBeGreaterThan(20)
    }
  })

  it('createMcpServer wires tools/resources/prompts without throwing', () => {
    const commerce = new CommerceService(new MemoryRepository())
    const server = createMcpServer(commerce)
    expect(server).toBeTruthy()
  })

  it('runs shopping flow via callTool', async () => {
    const { commerce, product } = await seeded()

    const search = await callTool(commerce, 'search_products', { q: 'widget' })
    expect(search.content[0]?.text).toContain('MCP Widget')

    const cartRes = await callTool(commerce, 'create_cart', {
      customerId: 'mcp_user',
      idempotencyKey: 'mcp-cart-1',
    })
    const cart = JSON.parse(cartRes.content[0]!.text) as { id: string }

    await callTool(commerce, 'add_cart_item', {
      cartId: cart.id,
      productId: product.id,
      quantity: 2,
      idempotencyKey: 'mcp-add-1',
    })
    await callTool(commerce, 'apply_promotion', {
      cartId: cart.id,
      code: 'OFF100',
      idempotencyKey: 'mcp-promo-1',
    })

    const quoteRes = await callTool(commerce, 'quote_cart', { cartId: cart.id })
    const quote = JSON.parse(quoteRes.content[0]!.text) as { totalCents: number }
    expect(quote.totalCents).toBe(2_400 - 100)

    const orderRes = await callTool(commerce, 'place_order', {
      cartId: cart.id,
      idempotencyKey: 'mcp-order-1',
    })
    const order = JSON.parse(orderRes.content[0]!.text) as { id: string; status: string }
    expect(order.status).toBe('created')

    const again = await callTool(commerce, 'place_order', {
      cartId: cart.id,
      idempotencyKey: 'mcp-order-1',
    })
    expect(JSON.parse(again.content[0]!.text).id).toBe(order.id)

    const got = await callTool(commerce, 'get_order', { orderId: order.id })
    expect(JSON.parse(got.content[0]!.text).id).toBe(order.id)

    const cancelled = await callTool(commerce, 'cancel_order', {
      orderId: order.id,
      idempotencyKey: 'mcp-cancel-1',
    })
    expect(JSON.parse(cancelled.content[0]!.text).status).toBe('cancelled')
  })

  it('returns structured tool error on oversell with mcpErrorCode', async () => {
    const { commerce, product } = await seeded()
    const cartRes = await callTool(commerce, 'create_cart', {
      customerId: 'x',
      idempotencyKey: 'c2',
    })
    const cart = JSON.parse(cartRes.content[0]!.text) as { id: string }
    const err = await callTool(commerce, 'add_cart_item', {
      cartId: cart.id,
      productId: product.id,
      quantity: 999,
      idempotencyKey: 'oversell',
    })
    expect(err).toMatchObject({ isError: true })
    const body = JSON.parse(err.content[0]!.text) as { code: string; mcpErrorCode: number }
    expect(body.code).toBe('INSUFFICIENT_STOCK')
    expect(body.mcpErrorCode).toBe(-32600) // ErrorCode.InvalidRequest
  })

  it('supports merchant upsert + adjust + list_orders', async () => {
    const { commerce } = await seeded()
    const up = await callTool(commerce, 'upsert_product', {
      sku: 'NEW-1',
      name: 'New',
      priceCents: 500,
      idempotencyKey: 'up-1',
    })
    const product = JSON.parse(up.content[0]!.text) as { id: string }
    const stock = await callTool(commerce, 'adjust_stock', {
      productId: product.id,
      delta: 3,
      idempotencyKey: 'adj-1',
    })
    expect(JSON.parse(stock.content[0]!.text).onHand).toBe(3)

    const inv = await callTool(commerce, 'check_inventory', { productId: product.id })
    expect(JSON.parse(inv.content[0]!.text).available).toBe(3)

    const listed = await callTool(commerce, 'list_orders', {})
    expect(JSON.parse(listed.content[0]!.text)).toEqual([])
  })

  it('request_return refunds a paid order', async () => {
    const { commerce, product } = await seeded()
    const cartRes = await callTool(commerce, 'create_cart', {
      customerId: 'ret',
      idempotencyKey: 'ret-cart',
    })
    const cartId = JSON.parse(cartRes.content[0]!.text).id as string
    await callTool(commerce, 'add_cart_item', {
      cartId,
      productId: product.id,
      quantity: 1,
      idempotencyKey: 'ret-add',
    })
    const order = JSON.parse(
      (
        await callTool(commerce, 'place_order', {
          cartId,
          idempotencyKey: 'ret-ord',
        })
      ).content[0]!.text,
    ) as { id: string }
    await commerce.payOrder(order.id, 'ret-pay')
    const ret = await callTool(commerce, 'request_return', {
      orderId: order.id,
      reason: 'damaged',
      idempotencyKey: 'ret-1',
    })
    expect(JSON.parse(ret.content[0]!.text).order.status).toBe('refunded')
  })
})
