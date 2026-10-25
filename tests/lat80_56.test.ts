import { describe, expect, it } from 'vitest'
import { lat80Fn56 } from '../src/lib/lat80_56'

describe('lat80_56', () => {
  it('returns 56', () => {
    expect(lat80Fn56()).toBe(56)
  })
})
