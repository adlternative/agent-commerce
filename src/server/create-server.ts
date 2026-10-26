import { createServer, type Server } from 'node:http'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
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
  const router = new Router(opts.auth ?? DEFAULT_AUTH, { audit, rateLimit }, { logger, metrics })
  router.setOpenApiProvider(() => buildOpenApi())
  registerRoutes(router, commerce, { audit })

  const server = createServer((req, res) => {
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
      await new Promise<void>((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve())
      })
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        throw new Error('failed to bind server')
      }
      return { port: addr.port, baseUrl: `http://127.0.0.1:${addr.port}` }
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}

export { MemoryRepository, JsonFileRepository, buildOpenApi }
