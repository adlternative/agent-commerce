/**
 * Optional Streamable HTTP transport for MCP.
 * Start with: MCP_HTTP_PORT=8790 npm run mcp:http
 *
 * Stateless per-request: each HTTP request gets a fresh MCP server +
 * transport (`sessionIdGenerator: undefined`). Domain state lives in the shared
 * CommerceService / repository, so cart + order flows work across requests.
 *
 * Auth matches REST: Authorization Bearer JWT/opaque token or X-API-Key /
 * Authorization: ApiKey. Demo credentials honor ALLOW_DEMO_TOKENS the same way.
 * Merchant tools (upsert_product / adjust_stock / list_orders) require
 * merchant or agent:merchant.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isDomainError } from '../domain/errors.js'
import { createRepository } from '../repo/create-repository.js'
import { authenticate, buildAuthConfig } from '../server/auth.js'
import { CommerceService } from '../services/commerce.js'
import { createMcpServer } from './create-mcp-server.js'
import { toMappedErrorBody } from './errors.js'

const port = Number(process.env.MCP_HTTP_PORT ?? 8790)
const opened = await createRepository()
const commerce = new CommerceService(opened.repo)
const auth = buildAuthConfig()

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function sendAuthError(res: ServerResponse, err: unknown): void {
  const body = toMappedErrorBody(err)
  const status = isDomainError(err) && err.code === 'UNAUTHORIZED' ? 401 : 403
  sendJson(res, status, {
    jsonrpc: '2.0',
    error: {
      code: body.mcpErrorCode,
      message: body.message,
      data: body,
    },
    id: null,
  })
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let actor
  try {
    actor = authenticate(req, auth)
  } catch (err) {
    sendAuthError(res, err)
    return
  }

  const mcp = createMcpServer(commerce, { actor })
  const transport = new StreamableHTTPServerTransport({
    // True stateless mode — required for multi-request Client sessions without a session map.
    sessionIdGenerator: undefined,
  })
  await mcp.connect(transport)
  await transport.handleRequest(req, res)
  res.on('close', () => {
    void transport.close()
    void mcp.close()
  })
}

const httpServer = createServer((req, res) => {
  void (async () => {
    try {
      const method = req.method ?? 'GET'
      if (method === 'POST') {
        await handleMcpPost(req, res)
        return
      }
      // Stateless demo: no SSE GET stream and no DELETE session termination.
      sendJson(res, 405, {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      })
    } catch (err) {
      console.error('MCP HTTP error:', err)
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  })()
})

httpServer.listen(port, '127.0.0.1', () => {
  console.log(`MCP Streamable HTTP on http://127.0.0.1:${port}`)
  console.log(`store: ${opened.backend} @ ${opened.path}`)
})
