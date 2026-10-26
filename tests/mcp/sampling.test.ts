import { describe, expect, it, vi } from 'vitest'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'
import { createMcpServer } from '../../src/mcp/create-mcp-server.js'
import { recommendProductsWithSampling } from '../../src/mcp/sampling.js'

describe('MCP sampling recommend_products', () => {
  it('falls back when client has no sampling capability', async () => {
    const commerce = new CommerceService(new MemoryRepository())
    await commerce.upsertProduct(
      { sku: 'S-1', name: 'Sample Mug', priceCents: 900, tags: ['kitchen'] },
      'samp-p',
    )
    const server = createMcpServer(commerce)
    vi.spyOn(server.server, 'getClientCapabilities').mockReturnValue({})

    const result = await recommendProductsWithSampling(server, commerce, {
      goal: 'gift mug',
      limit: 2,
    })
    expect(result).not.toHaveProperty('isError')
    const body = JSON.parse(result.content[0]!.text) as {
      mode: string
      suggestions: { sku: string }[]
    }
    expect(body.mode).toBe('fallback')
    expect(body.suggestions[0]?.sku).toBe('S-1')
  })

  it('uses createMessage when sampling is advertised', async () => {
    const commerce = new CommerceService(new MemoryRepository())
    await commerce.upsertProduct(
      { sku: 'S-2', name: 'Sample Tee', priceCents: 1500, tags: ['apparel'] },
      'samp-p2',
    )
    const server = createMcpServer(commerce)
    vi.spyOn(server.server, 'getClientCapabilities').mockReturnValue({ sampling: {} })
    vi.spyOn(server.server, 'createMessage').mockResolvedValue({
      role: 'assistant',
      model: 'test-model',
      content: { type: 'text', text: '1. S-2 Sample Tee — matches apparel gift' },
    } as Awaited<ReturnType<typeof server.server.createMessage>>)

    const result = await recommendProductsWithSampling(server, commerce, {
      goal: 'apparel gift',
    })
    const body = JSON.parse(result.content[0]!.text) as {
      mode: string
      recommendation: string
      model: string
    }
    expect(body.mode).toBe('sampling')
    expect(body.model).toBe('test-model')
    expect(body.recommendation).toContain('S-2')
  })
})
