import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ACP-38: fly.toml must stay single-instance SQLite-safe.
 * Never weaken these assertions — multi-replica against one volume is unsupported.
 */
describe('deploy/fly.toml', () => {
  const text = readFileSync(resolve(process.cwd(), 'deploy/fly.toml'), 'utf8')

  it('sets internal_port = 8787', () => {
    expect(text).toMatch(/internal_port\s*=\s*8787/)
  })

  it('declares [mounts] for persistent DATA_DIR', () => {
    expect(text).toMatch(/\[mounts\]/)
    expect(text).toMatch(/destination\s*=\s*['"]\/app\/data['"]/)
  })

  it('keeps a single machine (no multi-replica autoscale)', () => {
    expect(text).toMatch(/min_machines_running\s*=\s*1/)
    expect(text).not.toMatch(/auto_stop_machines\s*=\s*true/)
    expect(text).not.toMatch(/max_machines_running\s*=\s*[2-9]/)
    expect(text).not.toMatch(/http_service\.http_options\.autoscale/)
    expect(text).not.toMatch(/fly_scale/)
    expect(text).not.toMatch(/\bcount\s*=\s*[2-9]/)
  })

  it('does not embed JWT_SECRET (fly secrets only)', () => {
    expect(text).not.toMatch(/JWT_SECRET\s*=/)
  })
})
