import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CommerceService } from '../services/commerce.js'
import { toolError, toolResult } from './tools.js'

export const RecommendProductsSchema = z.object({
  goal: z
    .string()
    .min(1)
    .describe('Shopper intent used to ask the client LLM for a short product recommendation'),
  limit: z
    .number()
    .int()
    .positive()
    .max(8)
    .default(3)
    .describe('Max catalog rows to include as sampling context'),
})

/**
 * Ask the MCP client to sample an LLM (sampling/createMessage).
 * Falls back to a deterministic top-of-catalog blurb when the client has no sampling capability.
 */
export async function recommendProductsWithSampling(
  server: McpServer,
  commerce: CommerceService,
  rawArgs: unknown,
): Promise<ReturnType<typeof toolResult> | ReturnType<typeof toolError>> {
  try {
    const args = RecommendProductsSchema.parse(rawArgs)
    const products = (await commerce.listProducts({ activeOnly: true })).slice(0, args.limit)
    const catalogBrief = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      priceCents: p.priceCents,
      tags: p.tags,
      agentNotes: p.agentNotes,
    }))

    const caps = server.server.getClientCapabilities()
    if (!caps?.sampling) {
      return toolResult({
        mode: 'fallback',
        reason: 'client_missing_sampling',
        goal: args.goal,
        suggestions: catalogBrief,
        advice:
          'Client did not advertise sampling; returning catalog context only. Reconnect with sampling capability for LLM recommendations.',
      })
    }

    const response = await server.server.createMessage({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You recommend products for Agent Commerce.',
              'Amounts are integer cents. Prefer products that match the shopper goal.',
              'Reply with a short ranked list (sku, name, why) using only the catalog JSON below.',
              '',
              `Shopper goal: ${args.goal}`,
              '',
              'Catalog JSON:',
              JSON.stringify(catalogBrief, null, 2),
            ].join('\n'),
          },
        },
      ],
      maxTokens: 400,
    })

    const text =
      response.content.type === 'text'
        ? response.content.text
        : 'Unable to read sampling response text'

    return toolResult({
      mode: 'sampling',
      goal: args.goal,
      model: response.model,
      recommendation: text,
      catalogUsed: catalogBrief,
    })
  } catch (err) {
    return toolError(err)
  }
}
