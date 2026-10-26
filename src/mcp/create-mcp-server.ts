import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CommerceService } from '../services/commerce.js'
import {
  TOOL_DESCRIPTIONS,
  ToolSchemas,
  callTool,
  type ToolName,
} from './tools.js'

export function createMcpServer(commerce: CommerceService): McpServer {
  const server = new McpServer({
    name: 'agent-commerce',
    version: '0.3.0',
  })

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

  server.registerResource(
    'catalog-products',
    'catalog://products',
    {
      description: 'Active product catalog as JSON (priceCents, agentNotes, tags).',
      mimeType: 'application/json',
    },
    async (uri) => {
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
    },
  )

  server.registerResource(
    'order-by-id',
    new ResourceTemplate('orders://{id}', { list: undefined }),
    {
      description: 'Fetch a single order document by id.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
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
    },
  )

  server.registerPrompt(
    'shopping_assistant',
    {
      description:
        'Guide an LLM to help a shopper search, quote, and place an order with correct idempotency keys.',
      argsSchema: {
        goal: z
          .string()
          .describe('What the shopper wants, e.g. "buy 2 black tees with SAVE200"'),
      },
    },
    async ({ goal }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are a shopping assistant for Agent Commerce.',
              'Amounts are integer cents. Always send idempotencyKey on writes.',
              'Suggested flow: search_products → check_inventory → create_cart → add_cart_item → apply_promotion → quote_cart → place_order → (optional) get_order.',
              `Shopper goal: ${goal}`,
            ].join('\n'),
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'merchant_ops',
    {
      description: 'Guide an LLM through merchant catalog, stock, and order operations.',
      argsSchema: {
        task: z
          .string()
          .describe('Merchant task, e.g. "restock MUG-01 by 20 and list paid orders"'),
      },
    },
    async ({ task }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are a merchant operations agent for Agent Commerce.',
              'Use upsert_product / adjust_stock / list_orders / get_order.',
              'Never invent stock levels — call check_inventory after adjustments.',
              `Task: ${task}`,
            ].join('\n'),
          },
        },
      ],
    }),
  )

  return server
}
