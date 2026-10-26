import { createServer } from 'node:net'

/** Returns true when `host:port` can be bound right now. */
export async function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })
}

/**
 * Prefer `preferred` when free; otherwise ask the OS for an ephemeral port.
 * Closes the probe socket before returning so the real server can bind it.
 */
export async function resolveFreePort(preferred?: number, host = '127.0.0.1'): Promise<number> {
  if (preferred != null && Number.isFinite(preferred) && preferred > 0) {
    if (await isPortFree(preferred, host)) return preferred
  }

  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, host, () => {
      const addr = server.address()
      if (addr == null || typeof addr === 'string') {
        server.close(() => reject(new Error('failed to allocate an ephemeral port')))
        return
      }
      const { port } = addr
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}
