import { describe, expect, it } from 'vitest'
import {
  decodeStableCursor,
  encodeStableCursor,
  paginateStable,
  type RankedItem,
} from '../../src/ai/pagination.js'
import { DomainError } from '../../src/domain/errors.js'

describe('stable keyset cursors', () => {
  const ranked: RankedItem<{ id: string; name: string }>[] = [
    { id: 'a', score: 30, item: { id: 'a', name: 'A' } },
    { id: 'b', score: 20, item: { id: 'b', name: 'B' } },
    { id: 'c', score: 20, item: { id: 'c', name: 'C' } },
    { id: 'd', score: 10, item: { id: 'd', name: 'D' } },
    { id: 'e', score: 5, item: { id: 'e', name: 'E' } },
  ]

  it('pages without overlap via (score, id) cursors', () => {
    const page1 = paginateStable(ranked, { limit: 2 })
    expect(page1.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(page1.hasMore).toBe(true)
    const key = decodeStableCursor(page1.nextCursor)
    expect(key).toEqual({ s: 20, i: 'b' })

    const page2 = paginateStable(ranked, { cursor: page1.nextCursor, limit: 2 })
    expect(page2.items.map((i) => i.id)).toEqual(['c', 'd'])

    const page3 = paginateStable(ranked, { cursor: page2.nextCursor, limit: 2 })
    expect(page3.items.map((i) => i.id)).toEqual(['e'])
    expect(page3.hasMore).toBe(false)
    expect(page3.nextCursor).toBeNull()
  })

  it('does not duplicate prior page when a higher-score item is inserted', () => {
    const page1 = paginateStable(ranked, { limit: 2 })
    const withInsert: RankedItem<{ id: string; name: string }>[] = [
      { id: 'z', score: 99, item: { id: 'z', name: 'Z' } },
      ...ranked,
    ]
    const page2 = paginateStable(withInsert, { cursor: page1.nextCursor, limit: 2 })
    // Keyset continues after (20, b) — never re-returns a/b even though z was inserted above.
    expect(page2.items.map((i) => i.id)).toEqual(['c', 'd'])
    expect(page2.items.map((i) => i.id)).not.toContain('a')
    expect(page2.items.map((i) => i.id)).not.toContain('b')
    expect(page2.items.map((i) => i.id)).not.toContain('z')
  })

  it('round-trips encode/decode and rejects malformed cursors', () => {
    expect(decodeStableCursor(encodeStableCursor({ s: 3, i: 'x' }))).toEqual({ s: 3, i: 'x' })
    expect(() => decodeStableCursor('!!!')).toThrow(DomainError)
  })
})
