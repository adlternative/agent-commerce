import { describe, expect, it } from 'vitest'
import {
  addToWishlist,
  isInWishlist,
  normalizeSku,
  removeFromWishlist,
  toggleWishlist,
  wishlistSize,
} from '../src/lib/set2_wishlist'

describe('set2_wishlist', () => {
  describe('normalizeSku', () => {
    it('trims whitespace and rejects non-strings as empty', () => {
      expect(normalizeSku('  sku-1  ')).toBe('sku-1')
      expect(normalizeSku('')).toBe('')
      expect(normalizeSku('   ')).toBe('')
      expect(normalizeSku(null)).toBe('')
      expect(normalizeSku(42)).toBe('')
    })
  })

  describe('addToWishlist', () => {
    it('appends a new SKU without mutating the input', () => {
      const items = ['a']
      const next = addToWishlist(items, 'b')
      expect(next).toEqual(['a', 'b'])
      expect(items).toEqual(['a'])
    })

    it('is idempotent for duplicates and ignores blank SKUs', () => {
      expect(addToWishlist(['a'], 'a')).toEqual(['a'])
      expect(addToWishlist(['a'], '  a  ')).toEqual(['a'])
      expect(addToWishlist(['a'], '')).toEqual(['a'])
      expect(addToWishlist(['a'], '   ')).toEqual(['a'])
    })

    it('does not add when at maxItems capacity (boundary)', () => {
      expect(addToWishlist(['a', 'b'], 'c', 2)).toEqual(['a', 'b'])
      expect(addToWishlist([], 'a', 0)).toEqual([])
      expect(() => addToWishlist([], 'a', -1)).toThrow(RangeError)
      expect(() => addToWishlist([], 'a', Number.NaN)).toThrow(RangeError)
    })
  })

  describe('removeFromWishlist / isInWishlist / wishlistSize', () => {
    it('removes a present SKU and reports membership/size boundaries', () => {
      const items = ['a', 'b', 'c']
      expect(isInWishlist(items, 'b')).toBe(true)
      expect(isInWishlist(items, '  B  ')).toBe(false) // case-sensitive
      expect(isInWishlist(items, '')).toBe(false)
      expect(wishlistSize(items)).toBe(3)
      expect(wishlistSize(['', 'a', '  '])).toBe(1)

      expect(removeFromWishlist(items, 'b')).toEqual(['a', 'c'])
      expect(removeFromWishlist(items, 'missing')).toEqual(['a', 'b', 'c'])
      expect(removeFromWishlist(items, '')).toEqual(['a', 'b', 'c'])
      expect(items).toEqual(['a', 'b', 'c'])
    })
  })

  describe('toggleWishlist', () => {
    it('adds when absent and removes when present', () => {
      expect(toggleWishlist(['a'], 'b')).toEqual(['a', 'b'])
      expect(toggleWishlist(['a', 'b'], 'b')).toEqual(['a'])
      expect(toggleWishlist(['a'], '')).toEqual(['a'])
      expect(toggleWishlist(['a'], 'b', 1)).toEqual(['a']) // at capacity → no add
    })
  })
})
