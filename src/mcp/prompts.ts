import { completable } from '@modelcontextprotocol/sdk/server/completable.js'
import { z } from 'zod'
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js'

const SHOPPING_GOAL_SUGGESTIONS = [
  'buy 2 black tees under 20000¢ with SAVE200',
  'find mugs tagged kitchen and check inventory',
  'quote a cart then place order with a fresh idempotency key',
  'cancel an unpaid order and verify stock released',
]

const MERCHANT_TASK_SUGGESTIONS = [
  'restock MUG-01 by 20 and list paid orders',
  'upsert a new SKU with agentNotes and zero stock',
  'adjust stock down after a write-off and re-check inventory',
  'list shipped orders then inspect one by id',
]

function filterSuggestions(pool: string[], value: string): string[] {
  const q = value.trim().toLowerCase()
  if (!q) return pool
  return pool.filter((s) => s.toLowerCase().includes(q))
}

export const shoppingGoalArg = completable(
  z.string().describe('What the shopper wants (natural language)'),
  (value) => filterSuggestions(SHOPPING_GOAL_SUGGESTIONS, value),
)

export const merchantTaskArg = completable(
  z.string().describe('Merchant catalog / stock / order task'),
  (value) => filterSuggestions(MERCHANT_TASK_SUGGESTIONS, value),
)

export function shoppingAssistantPrompt(goal: string): GetPromptResult {
  return {
    description: 'Shopper flow with integer cents and Idempotency-Key discipline',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            'You are the shopping assistant for Agent Commerce (MCP).',
            '',
            'Hard rules:',
            '- Money is integer cents only — never floats or currency symbols in tool args.',
            '- Every write tool requires a unique idempotencyKey; reuse only to replay the same payload.',
            '- Prefer tools over guessing: search_products → check_inventory → create_cart → add_cart_item → (apply_promotion) → quote_cart → place_order → get_order.',
            '- On INSUFFICIENT_STOCK or IDEMPOTENCY_KEY_REUSE, read the structured error (code/hint/retryable) and adjust.',
            '- Resources: catalog://products, products://{id}, orders://{id}. Use completion/complete for ids.',
            '',
            `Shopper goal: ${goal}`,
          ].join('\n'),
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: [
            'I will search the catalog first, verify available stock, then build a cart with fresh idempotency keys.',
            'After quoting, I will place the order only if totalCents and inventory look correct.',
          ].join(' '),
        },
      },
    ],
  }
}

export function merchantOpsPrompt(task: string): GetPromptResult {
  return {
    description: 'Merchant catalog, stock, and order operations',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            'You are the merchant operations agent for Agent Commerce (MCP).',
            '',
            'Hard rules:',
            '- Use upsert_product / adjust_stock / list_orders / get_order / check_inventory.',
            '- Never invent onHand or available — call check_inventory after every adjust_stock.',
            '- Write tools need idempotencyKey; conflicts return IDEMPOTENCY_KEY_REUSE.',
            '- Read products://{id} or orders://{id} when you need the full JSON document.',
            '',
            `Task: ${task}`,
          ].join('\n'),
        },
      },
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: 'I will confirm current stock before mutating, apply the change with a fresh idempotency key, then re-check inventory and list affected orders.',
        },
      },
    ],
  }
}
