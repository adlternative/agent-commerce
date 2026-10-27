import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      if (!addr || typeof addr === 'string') {
        s.close()
        reject(new Error('no port'))
        return
      }
      const port = addr.port
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

async function waitForOk(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
      last = `status ${res.status}`
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`server did not become ready: ${last}`)
}

describe('compiled server boot smoke', () => {
  let child: ChildProcess
  let baseUrl = ''
  let dataDir = ''
  const logs: string[] = []

  beforeAll(async () => {
    execSync('npm run build:server', { cwd: process.cwd(), stdio: 'pipe' })
    dataDir = await mkdtemp(join(tmpdir(), 'ac-boot-'))
    const port = await freePort()
    baseUrl = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['dist-server/server/index.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: dataDir,
        DATA_PATH: '',
        STORE_BACKEND: 'json',
        // Fail-closed auth: always set a test secret; enable demo opaque tokens for smoke.
        JWT_SECRET: process.env.JWT_SECRET || 'agent-commerce-boot-smoke-jwt-secret',
        ALLOW_DEMO_TOKENS: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (d) => logs.push(String(d)))
    child.stderr?.on('data', (d) => logs.push(String(d)))
    child.on('exit', (code) => logs.push(`exit ${code}`))
    await waitForOk(`${baseUrl}/health`)
  }, 60_000)

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

  it('serves well-known discovery with tools and routes', async () => {
    const res = await fetch(`${baseUrl}/.well-known/ai-commerce.json`)
    expect(res.status).toBe(200)
    const doc = (await res.json()) as {
      mcp: { tools: { name: string }[] }
      http: { customer: string[]; agent: string[] }
    }
    expect(doc.mcp.tools.length).toBe(17)
    expect(doc.http.customer.some((r) => r.includes('/products'))).toBe(true)
    expect(doc.http.agent.length).toBeGreaterThan(0)
  })

  it('lists customer products as { items, nextCursor }', async () => {
    const res = await fetch(`${baseUrl}/api/customer/products`, {
      headers: { authorization: 'Bearer customer-token' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: unknown[]; nextCursor: string | null; hasMore: boolean }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.nextCursor).toBeNull()
    expect(body.hasMore).toBe(false)
  })

  it('places order and replays same Idempotency-Key to same order id', async () => {
    const productsRes = await fetch(`${baseUrl}/api/customer/products`, {
      headers: { authorization: 'Bearer customer-token' },
    })
    const page = (await productsRes.json()) as { items: { id: string }[] }
    const productId = page.items[0]!.id

    const cartRes = await fetch(`${baseUrl}/api/customer/carts`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer customer-token',
        'content-type': 'application/json',
        'idempotency-key': 'boot-cart-1',
      },
      body: JSON.stringify({ customerId: 'boot_user' }),
    })
    expect(cartRes.status).toBe(200)
    const cart = (await cartRes.json()) as { id: string }

    const addRes = await fetch(`${baseUrl}/api/customer/carts/${cart.id}/items`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer customer-token',
        'content-type': 'application/json',
        'idempotency-key': 'boot-add-1',
      },
      body: JSON.stringify({ productId, quantity: 1 }),
    })
    expect(addRes.status).toBe(200)

    const key = 'boot-order-idempotent-key'
    const first = await fetch(`${baseUrl}/api/customer/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer customer-token',
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify({ cartId: cart.id }),
    })
    expect([200, 201]).toContain(first.status)
    const order1 = (await first.json()) as { id: string }

    const second = await fetch(`${baseUrl}/api/customer/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer customer-token',
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify({ cartId: cart.id }),
    })
    expect([200, 201]).toContain(second.status)
    const order2 = (await second.json()) as { id: string }
    expect(order2.id).toBe(order1.id)
  })
})
