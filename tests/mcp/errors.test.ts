import { describe, expect, it } from 'vitest'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { DomainError } from '../../src/domain/errors.js'
import {
  mcpErrorCodeForDomain,
  toMappedErrorBody,
  toMcpError,
} from '../../src/mcp/errors.js'

describe('MCP domain error mapping', () => {
  it('maps not-found / validation codes to InvalidParams', () => {
    expect(mcpErrorCodeForDomain('PRODUCT_NOT_FOUND')).toBe(ErrorCode.InvalidParams)
    expect(mcpErrorCodeForDomain('ORDER_NOT_FOUND')).toBe(ErrorCode.InvalidParams)
    expect(mcpErrorCodeForDomain('VALIDATION_ERROR')).toBe(ErrorCode.InvalidParams)
    expect(mcpErrorCodeForDomain('IDEMPOTENCY_KEY_REQUIRED')).toBe(ErrorCode.InvalidParams)
  })

  it('maps conflict / business-rule codes to InvalidRequest', () => {
    expect(mcpErrorCodeForDomain('INSUFFICIENT_STOCK')).toBe(ErrorCode.InvalidRequest)
    expect(mcpErrorCodeForDomain('IDEMPOTENCY_KEY_REUSE')).toBe(ErrorCode.InvalidRequest)
    expect(mcpErrorCodeForDomain('RATE_LIMITED')).toBe(ErrorCode.InvalidRequest)
    expect(mcpErrorCodeForDomain('INVALID_TRANSITION')).toBe(ErrorCode.InvalidRequest)
  })

  it('maps internal codes to InternalError', () => {
    expect(mcpErrorCodeForDomain('INTERNAL_ERROR')).toBe(ErrorCode.InternalError)
    expect(mcpErrorCodeForDomain('TOOL_ERROR')).toBe(ErrorCode.InternalError)
  })

  it('toMappedErrorBody embeds mcpErrorCode beside domain fields', () => {
    const err = new DomainError('ORDER_NOT_FOUND', 'order x missing', {
      hint: 'use list_orders',
      retryable: false,
    })
    expect(toMappedErrorBody(err)).toEqual({
      code: 'ORDER_NOT_FOUND',
      message: 'order x missing',
      hint: 'use list_orders',
      retryable: false,
      mcpErrorCode: ErrorCode.InvalidParams,
    })
  })

  it('toMcpError preserves domain body in data', () => {
    const err = new DomainError('INSUFFICIENT_STOCK', 'not enough', { retryable: false })
    const mcp = toMcpError(err)
    expect(mcp).toBeInstanceOf(McpError)
    expect(mcp.code).toBe(ErrorCode.InvalidRequest)
    expect(mcp.data).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      mcpErrorCode: ErrorCode.InvalidRequest,
    })
  })
})
