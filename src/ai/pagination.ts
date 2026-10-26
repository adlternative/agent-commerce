import { DomainError } from '../domain/errors.js'

export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

/** Opaque cursor = base64url(JSON({ offset })). */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: number }
    if (!Number.isInteger(raw.o) || (raw.o ?? 0) < 0) {
      throw new Error('bad')
    }
    return raw.o!
  } catch {
    throw new DomainError('INVALID_CURSOR', 'cursor is malformed', { retryable: false })
  }
}

export function paginate<T>(
  items: readonly T[],
  opts: { cursor?: string | null; limit?: number } = {},
): CursorPage<T> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const offset = decodeCursor(opts.cursor)
  const slice = items.slice(offset, offset + limit)
  const nextOffset = offset + slice.length
  const hasMore = nextOffset < items.length
  return {
    items: [...slice],
    nextCursor: hasMore ? encodeCursor(nextOffset) : null,
    hasMore,
  }
}
