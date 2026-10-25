import { describe, expect, it } from 'vitest'
import { lat32Fn4 } from '../src/lib/lat32_4'

describe('lat32_4', () => {
  it('lat32Fn4() === 4', () => {
    expect(lat32Fn4()).toBe(4)
  })
})
