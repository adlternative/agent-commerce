/** Structured API / domain error body. All failures serialize to this shape. */
export type ErrorBody = {
  code: string
  message: string
  hint?: string
  retryable: boolean
}

export class DomainError extends Error {
  readonly code: string
  readonly hint?: string
  readonly retryable: boolean

  constructor(
    code: string,
    message: string,
    opts?: { hint?: string; retryable?: boolean; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'DomainError'
    this.code = code
    this.hint = opts?.hint
    this.retryable = opts?.retryable ?? false
  }

  toJSON(): ErrorBody {
    const body: ErrorBody = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    }
    if (this.hint !== undefined) body.hint = this.hint
    return body
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError
}
