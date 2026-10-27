import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { DomainError, isDomainError, type ErrorBody } from '../domain/errors.js'

/**
 * Map unified Agent Commerce domain error codes → MCP JSON-RPC ErrorCode.
 * Domain payload stays in `McpError.data` as `{ code, message, hint?, retryable }`.
 */
export function mcpErrorCodeForDomain(code: string): ErrorCode {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'UNKNOWN_FIELD':
    case 'INVALID_JSON':
    case 'INVALID_CENTS':
    case 'INVALID_QUANTITY':
    case 'INVALID_CURSOR':
    case 'IDEMPOTENCY_KEY_REQUIRED':
    case 'PRODUCT_NOT_FOUND':
    case 'CART_NOT_FOUND':
    case 'ORDER_NOT_FOUND':
    case 'STOCK_NOT_FOUND':
    case 'PROMO_NOT_FOUND':
    case 'CART_ITEM_NOT_FOUND':
    case 'PAYMENT_NOT_FOUND':
    case 'NOT_FOUND':
      return ErrorCode.InvalidParams

    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'IDEMPOTENCY_KEY_REUSE':
    case 'INSUFFICIENT_STOCK':
    case 'EMPTY_CART':
    case 'INVALID_TRANSITION':
    case 'ORDER_NOT_PAYABLE':
    case 'ORDER_NOT_RETURNABLE':
    case 'PROMO_INACTIVE':
    case 'PRODUCT_INACTIVE':
    case 'RATE_LIMITED':
      return ErrorCode.InvalidRequest

    case 'INTERNAL_ERROR':
    case 'TOOL_ERROR':
      return ErrorCode.InternalError

    default:
      return ErrorCode.InvalidRequest
  }
}

export type McpMappedErrorBody = ErrorBody & {
  /** MCP JSON-RPC numeric error code (e.g. -32602 InvalidParams). */
  mcpErrorCode: number
}

export function toMappedErrorBody(err: unknown): McpMappedErrorBody {
  if (isDomainError(err)) {
    return {
      ...err.toJSON(),
      mcpErrorCode: mcpErrorCodeForDomain(err.code),
    }
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
    const z = err as unknown as { issues: { message: string; path: (string | number)[] }[] }
    return {
      code: 'VALIDATION_ERROR',
      message: 'request validation failed',
      hint: z.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      retryable: false,
      mcpErrorCode: ErrorCode.InvalidParams,
    }
  }
  const message = err instanceof Error ? err.message : String(err)
  return {
    code: 'TOOL_ERROR',
    message,
    retryable: true,
    mcpErrorCode: ErrorCode.InternalError,
  }
}

/** Convert any thrown value into an MCP protocol error (for resources / prompts). */
export function toMcpError(err: unknown): McpError {
  if (err instanceof McpError) return err
  const body = toMappedErrorBody(err)
  return new McpError(body.mcpErrorCode, body.message, body)
}

export function domainErrorToMcp(err: DomainError): McpError {
  return toMcpError(err)
}
