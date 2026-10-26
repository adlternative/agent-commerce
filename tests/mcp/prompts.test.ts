import { describe, expect, it } from 'vitest'
import { getCompleter, isCompletable } from '@modelcontextprotocol/sdk/server/completable.js'
import {
  merchantOpsPrompt,
  merchantTaskArg,
  shoppingAssistantPrompt,
  shoppingGoalArg,
} from '../../src/mcp/prompts.js'

describe('MCP polished prompts', () => {
  it('shopping_assistant includes cents + idempotency rules and assistant turn', () => {
    const result = shoppingAssistantPrompt('buy mugs')
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]?.role).toBe('user')
    expect(result.messages[1]?.role).toBe('assistant')
    const userText = (result.messages[0]?.content as { text: string }).text
    expect(userText).toContain('integer cents')
    expect(userText).toContain('idempotencyKey')
    expect(userText).toContain('buy mugs')
  })

  it('merchant_ops requires check_inventory after adjust_stock', () => {
    const result = merchantOpsPrompt('restock SKU-1')
    const userText = (result.messages[0]?.content as { text: string }).text
    expect(userText).toContain('check_inventory')
    expect(userText).toContain('restock SKU-1')
  })

  it('prompt args are completable with suggestions', async () => {
    expect(isCompletable(shoppingGoalArg)).toBe(true)
    expect(isCompletable(merchantTaskArg)).toBe(true)
    const goalComplete = getCompleter(shoppingGoalArg)!
    const goals = await goalComplete('idempotency')
    expect(goals.some((g) => g.includes('idempotency'))).toBe(true)
    const taskComplete = getCompleter(merchantTaskArg)!
    const tasks = await taskComplete('restock')
    expect(tasks.some((t) => t.toLowerCase().includes('restock'))).toBe(true)
  })
})
