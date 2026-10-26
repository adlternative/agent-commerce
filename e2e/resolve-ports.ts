import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveFreePort } from './free-port'

export type E2ePorts = { webPort: number; apiPort: number }

const LOCK_ENV = 'E2E_PORTS_LOCKED'

function portStatePath(): string {
  const key = createHash('sha256').update(process.cwd()).digest('hex').slice(0, 12)
  return join(tmpdir(), `agent-commerce-e2e-ports-${key}.json`)
}

/**
 * Resolve Vite + API ports once per Playwright run.
 *
 * Prefer PW_PORT / E2E_* when free; otherwise auto-pick. Subsequent config
 * loads (worker restarts) must reuse the same ports — after webServer binds,
 * a fresh "is free?" check would wrongly treat our own server as a conflict.
 */
export async function resolveE2ePorts(): Promise<E2ePorts> {
  if (process.env[LOCK_ENV] === '1' && process.env.E2E_WEB_PORT && process.env.E2E_API_PORT) {
    return {
      webPort: Number(process.env.E2E_WEB_PORT),
      apiPort: Number(process.env.E2E_API_PORT),
    }
  }

  const statePath = portStatePath()
  try {
    const saved = JSON.parse(readFileSync(statePath, 'utf8')) as E2ePorts & { pid?: number }
    // Reuse only while the allocating Playwright parent is still alive.
    if (
      saved?.webPort > 0 &&
      saved?.apiPort > 0 &&
      saved.pid &&
      isProcessAlive(saved.pid)
    ) {
      lockEnv(saved)
      return { webPort: saved.webPort, apiPort: saved.apiPort }
    }
  } catch {
    // allocate fresh
  }

  const preferredWeb = Number(process.env.PW_PORT ?? process.env.E2E_WEB_PORT ?? 5173)
  const preferredApi = Number(process.env.E2E_API_PORT ?? 8787)
  const webPort = await resolveFreePort(preferredWeb)
  const apiPort = await resolveFreePort(preferredApi)
  const ports = { webPort, apiPort, pid: process.pid }
  mkdirSync(tmpdir(), { recursive: true })
  writeFileSync(statePath, JSON.stringify(ports))
  lockEnv(ports)
  return { webPort, apiPort }
}

function lockEnv(ports: E2ePorts): void {
  process.env[LOCK_ENV] = '1'
  process.env.E2E_WEB_PORT = String(ports.webPort)
  process.env.E2E_API_PORT = String(ports.apiPort)
  process.env.PW_PORT = String(ports.webPort)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
