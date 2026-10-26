import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'
import {
  completeOrderIds,
  completeProductIds,
  listOrderResources,
  listProductResources,
} from '../../src/mcp/resources.js'
import { createMcpServer } from '../../src/mcp/create-mcp-server.js'
import { toMcpError } from '../../src/mcp/errors.js'
import { DomainError } from '../../src/domain/errors.js'
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js'

async function seeded() {
  const commerce = new CommerceService(new MemoryRepository())
  const product = await commerce.upsertProduct(
    {
      sku: 'R-1',
      name: 'Resource Tee',
      priceCents: 2_000,
      tags: ['apparel'],
      agentNotes: 'Soft cotton.',
    },
    'res-p',
  )
  await commerce.adjustStock(product.id, 5, 'res-s')
  const cart = await commerce.createCart('cust', 'res-c')
  await commerce.addItem(cart.id, product.id, 1, 'res-a')
  const order = await commerce.placeOrder(cart.id, 'res-o')
  return { commerce, product, order }
}

describe('MCP resource templates', () => {
  it('lists and completes product / order URIs', async () => {
    const { commerce, product, order } = await seeded()

    const products = await listProductResources(commerce)
    expect(products.resources.some((r) => r.uri === `products://${product.id}`)).toBe(true)

    const orders = await listOrderResources(commerce)
    expect(orders.resources.some((r) => r.uri === `orders://${order.id}`)).toBe(true)

    const productHits = await completeProductIds(commerce, product.id.slice(0, 4))
    expect(productHits).toContain(product.id)

    const orderHits = await completeOrderIds(commerce, order.id.slice(0, 4))
    expect(orderHits).toContain(order.id)
  })

  it('createMcpServer registers completion-enabled templates', () => {
    const commerce = new CommerceService(new MemoryRepository())
    expect(() => createMcpServer(commerce)).not.toThrow()
  })

  it('maps missing order to MCP InvalidParams', () => {
    const mcp = toMcpError(new DomainError('ORDER_NOT_FOUND', 'missing'))
    expect(mcp.code).toBe(ErrorCode.InvalidParams)
  })
})
