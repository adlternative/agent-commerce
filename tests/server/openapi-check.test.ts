import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApi } from '../../src/server/openapi.js'

describe('openapi drift check', () => {
  it('docs/openapi.json matches buildOpenApi()', () => {
    const generated = buildOpenApi()
    const onDisk = JSON.parse(
      readFileSync(join(process.cwd(), 'docs', 'openapi.json'), 'utf8'),
    ) as unknown
    expect(onDisk).toEqual(generated)
  })
})
