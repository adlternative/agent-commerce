import { DomainError } from '../domain/errors.js'

export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

/** Opaque cursor = base64url(JSON({ offset })). Used for unordered / order lists. */
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

/** Keyset cursor for ranked product search: score DESC, id ASC. */
export type StableCursorKey = { s: number; i: string }

export function encodeStableCursor(key: StableCursorKey): string {
  return Buffer.from(JSON.stringify({ v: 1, s: key.s, i: key.i }), 'utf8').toString('base64url')
}

export function decodeStableCursor(cursor: string | null | undefined): StableCursorKey | null {
  if (!cursor) return null
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      v?: number
      s?: number
      i?: string
    }
    if (raw.v !== 1 || typeof raw.s !== 'number' || !Number.isFinite(raw.s) || typeof raw.i !== 'string' || !raw.i) {
      throw new Error('bad')
    }
    return { s: raw.s, i: raw.i }
  } catch {
    throw new DomainError('INVALID_CURSOR', 'cursor is malformed', { retryable: false })
  }
}

function isAfterKey(score: number, id: string, after: StableCursorKey): boolean {
  // Sort: score DESC, id ASC → "after" means lower score, or same score & greater id.
  if (score < after.s) return true
  if (score > after.s) return false
  return id > after.i
}

export type RankedItem<T> = { item: T; score: number; id: string }

/**
 * Stable keyset pagination over a pre-sorted ranked list (score DESC, id ASC).
 * Cursors survive inserts ahead of the current page without skipping/duplicating
 * relative to the (score, id) key — unlike offset cursors.
 */
export function paginateStable<T>(
  ranked: readonly RankedItem<T>[],
  opts: { cursor?: string | null; limit?: number } = {},
): CursorPage<T> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)
  const after = decodeStableCursor(opts.cursor)

  const filtered = after
    ? ranked.filter((r) => isAfterKey(r.score, r.id, after))
    : ranked

  const slice = filtered.slice(0, limit)
  const hasMore = filtered.length > limit
  const last = slice[slice.length - 1]
  return {
    items: slice.map((r) => r.item),
    nextCursor: hasMore && last ? encodeStableCursor({ s: last.score, i: last.id }) : null,
    hasMore,
  }
}
