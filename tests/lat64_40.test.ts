import { describe, expect, it } from 'vitest'
import { lat64Fn40 } from '../src/lib/lat64_40'

describe('lat64Fn40', () => {
  it('returns 40', () => {
    expect(lat64Fn40()).toBe(40)
  })
})
