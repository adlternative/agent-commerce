import { describe, expect, it } from 'vitest'
import { lat64Fn48 } from '../src/lib/lat64_48'

describe('lat64_48', () => {
  it('returns 48', () => {
    expect(lat64Fn48()).toBe(48)
  })
})
