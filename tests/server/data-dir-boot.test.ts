import { afterAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess, execSync } from 'node:child_process'
import { createServer } from 'node:net'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

async function stop(child: ChildProcess): Promise<void> {
  if (!child || child.killed) return
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

function startServer(port: number, dataDir: string): ChildProcess {
  return spawn(process.execPath, ['dist-server/server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      // Prefer DATA_DIR over any inherited DATA_PATH
      DATA_PATH: '',
      JWT_SECRET: 'agent-commerce-datadir-boot-jwt-secret',
      ALLOW_DEMO_TOKENS: '1',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('DATA_DIR boot persistence', () => {
  let dataDir = ''
  const children: ChildProcess[] = []

  afterAll(async () => {
    for (const c of children) await stop(c)
    if (dataDir) await rm(dataDir, { recursive: true, force: true })
  })

  it('writes under DATA_DIR and survives restart', async () => {
    execSync('npm run build:server', { cwd: process.cwd(), stdio: 'pipe' })
    dataDir = await mkdtemp(join(tmpdir(), 'ac-datadir-boot-'))
    const sqlitePath = join(dataDir, 'commerce.sqlite')

    const port1 = await freePort()
    const child1 = startServer(port1, dataDir)
    children.push(child1)
    const base1 = `http://127.0.0.1:${port1}`
    await waitForOk(`${base1}/healthz`)

    const productsRes = await fetch(`${base1}/api/customer/products`, {
      headers: { authorization: 'Bearer customer-token' },
    })
    expect(productsRes.status).toBe(200)
    const page = (await productsRes.json()) as { items: { id: string; sku: string }[] }
    expect(page.items.length).toBeGreaterThan(0)
    const seededSku = page.items[0]!.sku

    await access(sqlitePath)

    await stop(child1)
    children.pop()

    // File must still exist after process exit
    await access(sqlitePath)

    const port2 = await freePort()
    const child2 = startServer(port2, dataDir)
    children.push(child2)
    const base2 = `http://127.0.0.1:${port2}`
    await waitForOk(`${base2}/healthz`)

    const again = await fetch(`${base2}/api/customer/products`, {
      headers: { authorization: 'Bearer customer-token' },
    })
    expect(again.status).toBe(200)
    const page2 = (await again.json()) as { items: { sku: string }[] }
    expect(page2.items.some((p) => p.sku === seededSku)).toBe(true)
    await access(sqlitePath)
  }, 90_000)
})
