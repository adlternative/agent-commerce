/**
 * Optional Streamable HTTP transport for MCP.
 * Start with: MCP_HTTP_PORT=8790 npm run mcp:http
 *
 * Stateless per-request demo: each HTTP request gets a fresh MCP server +
 * transport (`sessionIdGenerator: undefined`). Domain state lives in the shared
 * CommerceService / repository, so cart + order flows work across requests.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createRepository } from '../repo/create-repository.js'
import { CommerceService } from '../services/commerce.js'
import { createMcpServer } from './create-mcp-server.js'

const port = Number(process.env.MCP_HTTP_PORT ?? 8790)
const opened = await createRepository()
const commerce = new CommerceService(opened.repo)

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Optional auth headers (Authorization / X-API-Key) are accepted and ignored
  // in this demo transport; pass them from clients via requestInit.headers.
  const mcp = createMcpServer(commerce)
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
