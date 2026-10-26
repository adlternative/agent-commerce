import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createRepository } from '../repo/create-repository.js'
import { CommerceService } from '../services/commerce.js'
import { createMcpServer } from './create-mcp-server.js'

const opened = await createRepository({
  dataPath: process.env.DATA_PATH,
})
const commerce = new CommerceService(opened.repo)
const server = createMcpServer(commerce)
const transport = new StdioServerTransport()
await server.connect(transport)
