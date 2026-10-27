import { createServer, type Server } from 'node:http'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { CommerceService } from '../services/commerce.js'
import type { CommerceRepository } from '../repo/types.js'
import { MemoryRepository, JsonFileRepository } from '../repo/json-repository.js'
import { Router, type AiAdapters, type Observability } from './router.js'
import { DEFAULT_AUTH, type AuthConfig } from './auth.js'
import { registerRoutes } from './routes.js'
import { buildOpenApi } from './openapi.js'
import { seedDemoCatalog } from './seed.js'
import { TokenBucket } from '../ai/rate-limit.js'
import { AuditLog } from '../ai/audit.js'
import { createLogger, type Logger } from './logger.js'
import { HttpMetrics } from './metrics.js'
import { tryServeStatic } from './static.js'

export type CreateServerOptions = {
  repo?: CommerceRepository
  auth?: AuthConfig
  /** When set, write docs/openapi.json on boot (optional). */
  openApiOutPath?: string
  /** Seed demo catalog when empty (default true for JSON file boots). */
  seedDemo?: boolean
  ai?: AiAdapters
  /** Override default rate limit (capacity 60, refill 1/sec). */
  rateLimit?: { capacity: number; refillPerSec: number }
  /** Structured logger / metrics overrides (tests). */
  observability?: Observability
  /**
   * Persistence backend name for GET /healthz (`sqlite` | `json`).
   * When set (or via `observability.store`), liveness includes `{ store }`.
   */
  store?: string
  /**
   * Directory of Vite `dist/` to serve (SPA). Env `STATIC_DIR` when unset.
   * Empty string disables. Docker sets STATIC_DIR=/app/dist.
   */
  staticDir?: string
  /** Bind address; env `HOST` (default 127.0.0.1; Docker uses 0.0.0.0). */
  host?: string
}

export type AppServer = {
  server: Server
  commerce: CommerceService
  audit: AuditLog
  rateLimit: TokenBucket
  metrics: HttpMetrics
  logger: Logger
  router: Router
  listen: (port?: number) => Promise<{ port: number; baseUrl: string }>
  close: () => Promise<void>
}

export function createAppServer(opts: CreateServerOptions = {}): AppServer {
  const repo = opts.repo ?? new MemoryRepository()
  const commerce = new CommerceService(repo)
  const audit = opts.ai?.audit ?? new AuditLog()
  const rateLimit =
    opts.ai?.rateLimit ??
    new TokenBucket(opts.rateLimit?.capacity ?? 60, opts.rateLimit?.refillPerSec ?? 1)
  const logger =
    opts.observability?.logger ??
    createLogger(
      { service: 'agent-commerce' },
      // Vitest sets VITEST=true; keep default request logs out of unit-test noise.
      process.env.VITEST ? { sink: () => {} } : undefined,
    )
  const metrics = opts.observability?.metrics ?? new HttpMetrics()
  const readiness =
    opts.observability?.readiness ??
    (async () => {
      await repo.checkReady()
    })
  const store = opts.store ?? opts.observability?.store
  const router = new Router(
    opts.auth ?? DEFAULT_AUTH,
    { audit, rateLimit },
    { logger, metrics, readiness, store },
  )
  router.setOpenApiProvider(() => buildOpenApi())
  registerRoutes(router, commerce, { audit })

  const staticDirRaw =
    opts.staticDir !== undefined ? opts.staticDir : process.env.STATIC_DIR?.trim()
  const staticRoot =
    staticDirRaw && staticDirRaw.length > 0 ? resolve(staticDirRaw) : undefined
  const host = opts.host ?? process.env.HOST?.trim() ?? '127.0.0.1'

  const server = createServer((req, res) => {
    if (staticRoot && existsSync(staticRoot)) {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method === 'GET' || method === 'HEAD') {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const path = url.pathname
        const reserved =
          path.startsWith('/api') ||
          path === '/health' ||
          path === '/healthz' ||
          path === '/readyz' ||
          path === '/metrics' ||
          path === '/openapi.json' ||
          path.startsWith('/.well-known')
        if (!reserved && tryServeStatic(req, res, staticRoot, path)) {
          return
        }
      }
    }
    void router.handle(req, res)
  })

  return {
    server,
    commerce,
    audit,
    rateLimit,
    metrics,
    logger,
    router,
    async listen(port = 0) {
      if (opts.openApiOutPath) {
        await mkdir(dirname(opts.openApiOutPath), { recursive: true })
        await writeFile(opts.openApiOutPath, JSON.stringify(buildOpenApi(), null, 2))
      }
      if (opts.seedDemo) {
        await seedDemoCatalog(commerce)
      }
      await new Promise<void>((done) => {
        server.listen(port, host, () => done())
      })
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        throw new Error('failed to bind server')
      }
      const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
      return { port: addr.port, baseUrl: `http://${displayHost}:${addr.port}` }
    },
    async close() {
      await new Promise<void>((done, reject) => {
        server.close((err) => (err ? reject(err) : done()))
      })
    },
  }
}

export { MemoryRepository, JsonFileRepository, buildOpenApi }

/**
 * Live method+path registry after the same wiring createAppServer uses
 * (`registerRoutes` + Router builtins). Prefer this over scanning source files.
 */
export function listLiveRoutes(
  opts: CreateServerOptions = {},
): Array<{ method: string; path: string }> {
  const app = createAppServer({ ...opts, seedDemo: false })
  return app.router.listRoutes()
}
