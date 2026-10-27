/**
 * Real-client Streamable HTTP smoke: official SDK Client + StreamableHTTPClientTransport
 * against the compiled `dist-server/mcp/http.js` process.
 *
 * Auth: same REST demo credentials (ALLOW_DEMO_TOKENS / non-production). Merchant tools
 * require merchant-token (or merchant JWT / API key).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess, execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      if (!addr || typeof addr === 'string') {
        s.close()
        reject(new Error('failed to bind ephemeral port'))
        return
      }
      const { port } = addr
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
    s.on('error', reject)
  })
}

function toolText(result: unknown): string {
  const r = result as {
    content?: { type: string; text?: string }[]
    isError?: boolean
  }
  expect(r.isError).toBeFalsy()
  expect(Array.isArray(r.content)).toBe(true)
  const block = r.content!.find((c) => c.type === 'text' && typeof c.text === 'string')
  expect(block?.text).toBeTruthy()
  return block!.text!
}

function toolErrorBody(result: unknown): { code?: string; message?: string } {
  const r = result as {
    content?: { type: string; text?: string }[]
    isError?: boolean
  }
  expect(r.isError).toBe(true)
  const block = r.content?.find((c) => c.type === 'text' && typeof c.text === 'string')
  expect(block?.text).toBeTruthy()
  return JSON.parse(block!.text!) as { code?: string; message?: string }
}

async function waitForListening(child: ChildProcess, port: number, timeoutMs = 20_000): Promise<void> {
  const started = Date.now()
  let stderr = ''
  const onErr = (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  }
  child.stderr?.on('data', onErr)
  try {
    while (Date.now() - started < timeoutMs) {
      if (child.exitCode !== null) {
        throw new Error(`MCP HTTP exited early code=${child.exitCode}; stderr=${stderr}`)
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'GET' })
        // Server answers 405 JSON for GET once listening.
        if (res.status === 405) return
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`timeout waiting for MCP HTTP on :${port}; stderr=${stderr}`)
  } finally {
    child.stderr?.off('data', onErr)
  }
}

function mcpClient(baseUrl: string, authorization: string): {
  client: Client
  transport: StreamableHTTPClientTransport
} {
  const client = new Client({ name: 'acp-28-http-smoke', version: '0.0.1' })
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
    requestInit: {
      headers: {
        Authorization: authorization,
      },
    },
  })
  return { client, transport }
}

describe('compiled MCP Streamable HTTP client smoke', () => {
  let child: ChildProcess
  let dataDir = ''
  let port = 0
  let baseUrl = ''

  beforeAll(async () => {
    execSync('npm run build:server', { cwd: process.cwd(), stdio: 'pipe' })
    dataDir = await mkdtemp(join(tmpdir(), 'ac-mcp-http-'))
    port = await freePort()
    baseUrl = `http://127.0.0.1:${port}/`
    child = spawn(process.execPath, ['dist-server/mcp/http.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MCP_HTTP_PORT: String(port),
        DATA_PATH: join(dataDir, 'commerce.json'),
        STORE_BACKEND: 'json',
        // Explicit demo gate so smoke credentials match REST (customer-token / merchant-token).
        ALLOW_DEMO_TOKENS: '1',
        JWT_SECRET: 'acp-28-mcp-http-smoke-jwt',
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await waitForListening(child, port)
  }, 90_000)

  afterAll(async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          child.kill('SIGKILL')
          resolve()
        }, 3000)
        child.once('exit', () => {
          clearTimeout(t)
          resolve()
        })
      })
    }
    if (dataDir) await rm(dataDir, { recursive: true, force: true })
  })

  it('rejects tools/list with no Authorization (401)', async () => {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as {
      error?: { message?: string; data?: { code?: string } }
    }
    expect(body.error?.data?.code).toBe('UNAUTHORIZED')
    expect(body.error?.message).toBeTruthy()
  }, 30_000)

  it('rejects customer upsert_product (FORBIDDEN)', async () => {
    const { client, transport } = mcpClient(baseUrl, 'Bearer customer-token')
    await client.connect(transport)

    const result = await client.callTool({
      name: 'upsert_product',
      arguments: {
        sku: 'CUST-DENIED-1',
        name: 'Should Fail',
        priceCents: 100,
        idempotencyKey: 'http-smoke-customer-upsert-1',
      },
    })
    const err = toolErrorBody(result)
    expect(err.code).toBe('FORBIDDEN')

    await client.close()
  }, 30_000)

  it('allows merchant upsert_product', async () => {
    const { client, transport } = mcpClient(baseUrl, 'Bearer merchant-token')
    await client.connect(transport)

    const product = JSON.parse(
      toolText(
        await client.callTool({
          name: 'upsert_product',
          arguments: {
            sku: 'MERCH-OK-1',
            name: 'Merchant Allowed Widget',
            priceCents: 900,
            idempotencyKey: 'http-smoke-merchant-upsert-1',
          },
        }),
      ),
    ) as { id: string; name: string; sku: string }
    expect(product.sku).toBe('MERCH-OK-1')
    expect(product.name).toBe('Merchant Allowed Widget')
    expect(product.id).toBeTruthy()

    await client.close()
  }, 30_000)

  it('initialize → tools/list ≥16 → inventory/search → cart → place_order', async () => {
    const { client, transport } = mcpClient(baseUrl, 'Bearer merchant-token')

    await client.connect(transport)

    const listed = await client.listTools()
    expect(listed.tools.length).toBeGreaterThanOrEqual(16)
    const names = listed.tools.map((t) => t.name)
    expect(names).toContain('search_products')
    expect(names).toContain('check_inventory')
    expect(names).toContain('create_cart')
    expect(names).toContain('place_order')
    expect(names).toContain('recommend_products')

    const product = JSON.parse(
      toolText(
        await client.callTool({
          name: 'upsert_product',
          arguments: {
            sku: 'HTTP-SMOKE-1',
            name: 'HTTP Smoke Widget',
            priceCents: 1_500,
            tags: ['smoke'],
            agentNotes: 'Seeded by Streamable HTTP client smoke.',
            idempotencyKey: 'http-smoke-upsert-1',
          },
        }),
      ),
    ) as { id: string; name: string }
    expect(product.name).toBe('HTTP Smoke Widget')

    expect(
      JSON.parse(
        toolText(
          await client.callTool({
            name: 'adjust_stock',
            arguments: {
              productId: product.id,
              delta: 8,
              idempotencyKey: 'http-smoke-stock-1',
            },
          }),
        ),
      ).onHand,
    ).toBe(8)

    const found = JSON.parse(
      toolText(
        await client.callTool({
          name: 'search_products',
          arguments: { q: 'HTTP Smoke' },
        }),
      ),
    ) as { id: string; name: string }[]
    expect(found.some((p) => p.id === product.id)).toBe(true)

    const inventory = JSON.parse(
      toolText(
        await client.callTool({
          name: 'check_inventory',
          arguments: { productId: product.id },
        }),
      ),
    ) as { onHand: number; reserved: number; available: number }
    expect(inventory.onHand).toBe(8)
    expect(inventory.available).toBe(8)

    const cart = JSON.parse(
      toolText(
        await client.callTool({
          name: 'create_cart',
          arguments: {
            customerId: 'http_smoke_shopper',
            idempotencyKey: 'http-smoke-cart-1',
          },
        }),
      ),
    ) as { id: string }

    const add = await client.callTool({
      name: 'add_cart_item',
      arguments: {
        cartId: cart.id,
        productId: product.id,
        quantity: 2,
        idempotencyKey: 'http-smoke-add-1',
      },
    })
    expect((add as { isError?: boolean }).isError).toBeFalsy()

    const order = JSON.parse(
      toolText(
        await client.callTool({
          name: 'place_order',
          arguments: {
            cartId: cart.id,
            idempotencyKey: 'http-smoke-order-1',
          },
        }),
      ),
    ) as { id: string; status: string }
    expect(order.status).toBe('created')
    expect(order.id).toBeTruthy()

    const afterInv = JSON.parse(
      toolText(
        await client.callTool({
          name: 'check_inventory',
          arguments: { productId: product.id },
        }),
      ),
    ) as { available: number; reserved: number }
    expect(afterInv.reserved).toBe(2)
    expect(afterInv.available).toBe(6)

    await client.close()
  }, 60_000)
})
