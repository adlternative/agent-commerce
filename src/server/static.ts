import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  const cleaned = decoded.replace(/^\/+/, '')
  const candidate = resolve(root, cleaned)
  const rel = relative(root, candidate)
  if (rel.startsWith('..') || rel.startsWith(`..${sep}`) || normalize(rel) === '..') {
    return null
  }
  return candidate
}

/**
 * Serve a file from `root` for GET requests. SPA fallback: missing paths → index.html.
 * Returns true when a response was written.
 */
export function tryServeStatic(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  pathname: string,
): boolean {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET' && (req.method ?? '').toUpperCase() !== 'HEAD') {
    return false
  }
  if (!root || !existsSync(root)) return false

  let filePath = safeJoin(root, pathname === '/' ? 'index.html' : pathname)
  if (!filePath) {
    res.writeHead(403).end()
    return true
  }

  let st
  try {
    st = statSync(filePath)
  } catch {
    st = undefined
  }

  if (!st?.isFile()) {
    // Directory or missing → SPA index.html (not for asset-looking extensions)
    const ext = extname(pathname)
    if (ext && ext !== '.html') {
      return false
    }
    filePath = join(root, 'index.html')
    try {
      st = statSync(filePath)
    } catch {
      return false
    }
    if (!st.isFile()) return false
  }

  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(200, {
    'content-type': type,
    'content-length': st.size,
    'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
  })
  if ((req.method ?? 'GET').toUpperCase() === 'HEAD') {
    res.end()
    return true
  }
  createReadStream(filePath).pipe(res)
  return true
}
