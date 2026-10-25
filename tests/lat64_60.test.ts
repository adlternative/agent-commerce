import { describe, expect, it } from 'vitest'
import { lat64Fn60 } from '../src/lib/lat64_60'

describe('lat64Fn60', () => {
  it('returns 60', () => {
    expect(lat64Fn60()).toBe(60)
  })
})
