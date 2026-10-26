import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams, execSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type JsonRpc = {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

function encode(msg: object): string {
  return `${JSON.stringify(msg)}\n`
}

async function readMessages(
  child: ChildProcessWithoutNullStreams,
  count: number,
  timeoutMs = 10_000,
): Promise<JsonRpc[]> {
  const out: JsonRpc[] = []
  let buffer = ''
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`timeout waiting for ${count} MCP messages; got ${out.length}; buf=${buffer}`))
    }, timeoutMs)

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      let idx: number
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '')
        buffer = buffer.slice(idx + 1)
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as JsonRpc
          out.push(msg)
          if (out.length >= count) {
            cleanup()
            resolve(out)
            return
          }
        } catch {
          // ignore non-json log lines if any
        }
      }
    }
    const onErr = (chunk: Buffer) => {
      buffer += `[stderr]${chunk.toString('utf8')}`
    }
    const cleanup = () => {
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.stderr.off('data', onErr)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onErr)
  })
}

describe('compiled MCP stdio handshake smoke', () => {
  let child: ChildProcessWithoutNullStreams
  let dataDir = ''

  beforeAll(async () => {
    execSync('npm run build:server', { cwd: process.cwd(), stdio: 'pipe' })
    dataDir = await mkdtemp(join(tmpdir(), 'ac-mcp-'))
    child = spawn(process.execPath, ['dist-server/mcp/stdio.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATA_PATH: join(dataDir, 'commerce.json'),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  }, 60_000)

  afterAll(async () => {
    if (child && !child.killed) {
      child.stdin.end()
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

  it('initialize + tools/list returns 16 tools', async () => {
    child.stdin.write(
      encode({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'boot-smoke', version: '0.0.1' },
        },
      }),
    )

    const initMsgs = await readMessages(child, 1)
    const init = initMsgs[0]!
    expect(init.id).toBe(1)
    expect(init.error).toBeUndefined()
    expect(init.result).toBeTruthy()

    child.stdin.write(
      encode({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    )

    child.stdin.write(
      encode({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    )

    const toolMsgs = await readMessages(child, 1)
    const listed = toolMsgs[0]!
    expect(listed.id).toBe(2)
    expect(listed.error).toBeUndefined()
    const tools = (listed.result as { tools: { name: string }[] }).tools
    expect(tools).toHaveLength(16)
    const names = tools.map((t) => t.name).sort()
    expect(names).toContain('search_products')
    expect(names).toContain('place_order')
    expect(names).toContain('upsert_product')
  })
})
