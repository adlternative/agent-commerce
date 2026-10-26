import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { join } from 'node:path'
import { JsonFileRepository } from '../repo/json-repository.js'
import { CommerceService } from '../services/commerce.js'
import { createMcpServer } from './create-mcp-server.js'

const dataPath = process.env.DATA_PATH ?? join(process.cwd(), 'data', 'commerce.json')
const commerce = new CommerceService(new JsonFileRepository(dataPath))
const server = createMcpServer(commerce)
const transport = new StdioServerTransport()
await server.connect(transport)
