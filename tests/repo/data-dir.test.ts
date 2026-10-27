import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultStorePath,
  resolveDataDir,
  resolveStorePath,
} from '../../src/repo/data-dir.js'
import { createRepository } from '../../src/repo/create-repository.js'
import { CommerceService } from '../../src/services/commerce.js'
import type { SqliteRepository } from '../../src/repo/sqlite-repository.js'

const openRepos: SqliteRepository[] = []

afterEach(async () => {
  while (openRepos.length) {
    openRepos.pop()?.close()
  }
  delete process.env.DATA_DIR
  delete process.env.DATA_PATH
  delete process.env.STORE_BACKEND
})

describe('DATA_DIR resolution', () => {
  it('defaults to ./data under cwd', () => {
    const cwd = '/tmp/ac-cwd'
    expect(resolveDataDir({}, cwd)).toBe(join(cwd, 'data'))
    expect(defaultStorePath('sqlite', {}, cwd)).toBe(join(cwd, 'data', 'commerce.sqlite'))
    expect(defaultStorePath('json', {}, cwd)).toBe(join(cwd, 'data', 'commerce.json'))
  })

  it('honors relative and absolute DATA_DIR', () => {
    const cwd = '/tmp/ac-cwd'
    expect(resolveDataDir({ DATA_DIR: 'my-data' }, cwd)).toBe(join(cwd, 'my-data'))
    expect(resolveDataDir({ DATA_DIR: '/var/ac' }, cwd)).toBe('/var/ac')
    expect(resolveStorePath('sqlite', {}, { DATA_DIR: '/var/ac' }, cwd)).toBe(
      '/var/ac/commerce.sqlite',
    )
  })

  it('DATA_PATH overrides DATA_DIR for the file path', () => {
    expect(
      resolveStorePath(
        'sqlite',
        {},
        { DATA_DIR: '/var/ac', DATA_PATH: '/explicit/db.sqlite' },
        '/tmp',
      ),
    ).toBe('/explicit/db.sqlite')
  })

  it('createRepository writes sqlite under DATA_DIR', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ac-datadir-'))
    process.env.DATA_DIR = dir
    const opened = await createRepository({ skipJsonMigration: true })
    if (opened.sqlite) openRepos.push(opened.sqlite)
    expect(opened.path).toBe(join(dir, 'commerce.sqlite'))

    const svc = new CommerceService(opened.repo)
    await svc.upsertProduct(
      { sku: 'DD1', name: 'Data Dir Widget', priceCents: 100 },
      'datadir-upsert-1',
    )
    opened.sqlite?.close()
    openRepos.pop()

    await access(join(dir, 'commerce.sqlite'))

    const again = await createRepository({ skipJsonMigration: true })
    if (again.sqlite) openRepos.push(again.sqlite)
    expect(again.path).toBe(join(dir, 'commerce.sqlite'))
    const db = await again.repo.read()
    expect(db.products.some((p) => p.sku === 'DD1')).toBe(true)
    again.sqlite?.close()
    openRepos.pop()

    await rm(dir, { recursive: true, force: true })
  })
})
