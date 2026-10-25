import { describe, expect, it } from 'vitest'
import { lat64Fn56 } from '../src/lib/lat64_56'

describe('lat64Fn56', () => {
  it('returns 56', () => {
    expect(lat64Fn56()).toBe(56)
  })
})
