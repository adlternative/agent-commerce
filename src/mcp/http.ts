/**
 * Optional Streamable HTTP transport for MCP.
 * Start with: MCP_HTTP_PORT=8790 npm run mcp:http
 */
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createRepository } from '../repo/create-repository.js'
import { CommerceService } from '../services/commerce.js'
import { createMcpServer } from './create-mcp-server.js'

const port = Number(process.env.MCP_HTTP_PORT ?? 8790)
const opened = await createRepository()
const commerce = new CommerceService(opened.repo)

const httpServer = createServer(async (req, res) => {
  // Stateless: new MCP server + transport per request (simple demo).
  const mcp = createMcpServer(commerce)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })
  await mcp.connect(transport)
  await transport.handleRequest(req, res)
})

httpServer.listen(port, '127.0.0.1', () => {
  console.log(`MCP Streamable HTTP on http://127.0.0.1:${port}`)
  console.log(`store: ${opened.backend} @ ${opened.path}`)
})
