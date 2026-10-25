import { describe, expect, it } from 'vitest'
import { lat80Fn66 } from '../src/lib/lat80_66'

describe('lat80_66', () => {
  it('returns 66', () => {
    expect(lat80Fn66()).toBe(66)
  })
})
