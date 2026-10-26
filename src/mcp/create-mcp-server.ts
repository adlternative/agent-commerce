import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CommerceService } from '../services/commerce.js'
import { toMcpError } from './errors.js'
import {
  merchantOpsPrompt,
  merchantTaskArg,
  shoppingAssistantPrompt,
  shoppingGoalArg,
} from './prompts.js'
import {
  completeOrderIds,
  completeProductIds,
  listOrderResources,
  listProductResources,
} from './resources.js'
import { RecommendProductsSchema, recommendProductsWithSampling } from './sampling.js'
import {
  TOOL_DESCRIPTIONS,
  ToolSchemas,
  callTool,
  type ToolName,
} from './tools.js'

export function createMcpServer(commerce: CommerceService): McpServer {
  const server = new McpServer(
    {
      name: 'agent-commerce',
      version: '0.8.0',
    },
    {
      instructions:
        'Agent Commerce MCP: integer cents, Idempotency-Key on writes, structured errors with mcpErrorCode. Resources catalog://products, products://{id}, orders://{id}. Use recommend_products when the client supports sampling.',
    },
  )

  const names = Object.keys(ToolSchemas) as ToolName[]
  for (const name of names) {
    server.registerTool(
      name,
      {
        description: TOOL_DESCRIPTIONS[name],
        inputSchema: ToolSchemas[name],
      },
      async (args: unknown) => callTool(commerce, name, args),
    )
  }

  server.registerTool(
    'recommend_products',
    {
      title: 'Recommend products (sampling)',
      description:
        'Ask the client LLM (MCP sampling/createMessage) for product recommendations given a shopper goal. Falls back to catalog context when sampling is unavailable.',
      inputSchema: RecommendProductsSchema,
    },
    async (args: unknown) => recommendProductsWithSampling(server, commerce, args),
  )

  server.registerResource(
    'catalog-products',
    'catalog://products',
    {
      description: 'Active product catalog as JSON (priceCents, agentNotes, tags).',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const products = await commerce.listProducts()
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(products, null, 2),
            },
          ],
        }
      } catch (err) {
        throw toMcpError(err)
      }
    },
  )

  server.registerResource(
    'product-by-id',
    new ResourceTemplate('products://{id}', {
      list: async () => listProductResources(commerce),
      complete: {
        id: async (value) => completeProductIds(commerce, value),
      },
    }),
    {
      description: 'Fetch a single product document by id (completion-enabled).',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const id = String(variables.id)
        const product = await commerce.getProduct(id)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(product, null, 2),
            },
          ],
        }
      } catch (err) {
        throw toMcpError(err)
      }
    },
  )

  server.registerResource(
    'order-by-id',
    new ResourceTemplate('orders://{id}', {
      list: async () => listOrderResources(commerce),
      complete: {
        id: async (value) => completeOrderIds(commerce, value),
      },
    }),
    {
      description: 'Fetch a single order document by id (list + completion-enabled).',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const id = String(variables.id)
        const order = await commerce.getOrder(id)
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(order, null, 2),
            },
          ],
        }
      } catch (err) {
        throw toMcpError(err)
      }
    },
  )

  server.registerPrompt(
    'shopping_assistant',
    {
      title: 'Shopping assistant',
      description:
        'Guide an LLM to help a shopper search, quote, and place an order with correct idempotency keys.',
      argsSchema: {
        goal: shoppingGoalArg,
      },
    },
    async ({ goal }) => shoppingAssistantPrompt(goal),
  )

  server.registerPrompt(
    'merchant_ops',
    {
      title: 'Merchant operations',
      description: 'Guide an LLM through merchant catalog, stock, and order operations.',
      argsSchema: {
        task: merchantTaskArg,
      },
    },
    async ({ task }) => merchantOpsPrompt(task),
  )

  return server
}
