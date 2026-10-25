import { describe, expect, it } from 'vitest'
import { ctx1Fn } from '../src/lib/ctx1'

describe('ctx1', () => {
  it("ctx1Fn returns 'baseline'", () => {
    expect(ctx1Fn()).toBe('baseline')
  })
})
