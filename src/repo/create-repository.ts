import { join } from 'node:path'
import type { CommerceRepository } from './types.js'
import { JsonFileRepository } from './json-repository.js'
import { SqliteRepository } from './sqlite-repository.js'
import { migrateJsonToSqlite } from './migrate-json.js'
import { resolveDataDir, resolveStorePath } from './data-dir.js'

export type StoreBackend = 'sqlite' | 'json'
export { resolveDataDir, resolveStorePath, defaultStorePath } from './data-dir.js'

export type CreateRepositoryOptions = {
  /** Explicit path; defaults depend on backend / DATA_DIR / DATA_PATH. */
  dataPath?: string
  /** Override backend; default sqlite (or inferred from dataPath extension). */
  backend?: StoreBackend
  /**
   * When opening SQLite, if empty and this JSON path exists, import once.
   * Default: sibling `commerce.json` next to the sqlite file, or `$DATA_DIR/commerce.json`.
   */
  migrateFromJsonPath?: string
  /** Skip JSON→SQLite auto-import (tests). Default false. */
  skipJsonMigration?: boolean
}

export type OpenedRepository = {
  repo: CommerceRepository
  backend: StoreBackend
  path: string
  /** Present when backend is sqlite. */
  sqlite?: SqliteRepository
  migration?: Awaited<ReturnType<typeof migrateJsonToSqlite>>
}

function inferBackend(dataPath: string | undefined, explicit?: StoreBackend): StoreBackend {
  if (explicit) return explicit
  const env = process.env.STORE_BACKEND?.trim().toLowerCase()
  if (env === 'json' || env === 'sqlite') return env
  if (dataPath?.endsWith('.json')) return 'json'
  return 'sqlite'
}

function defaultJsonSibling(sqlitePath: string): string {
  if (sqlitePath === ':memory:') return join(resolveDataDir(), 'commerce.json')
  if (sqlitePath.endsWith('.sqlite')) return sqlitePath.replace(/\.sqlite$/i, '.json')
  if (sqlitePath.endsWith('.db')) return sqlitePath.replace(/\.db$/i, '.json')
  return join(dirnameOf(sqlitePath), 'commerce.json')
}

function dirnameOf(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : '.'
}

/**
 * Open the configured persistence backend. Prefer SQLite via node:sqlite.
 * Keeps JSON available when STORE_BACKEND=json or path ends with .json.
 *
 * Path resolution: `dataPath` → `DATA_PATH` → `$DATA_DIR/commerce.sqlite`
 * (`DATA_DIR` defaults to `./data`).
 */
export async function createRepository(
  opts: CreateRepositoryOptions = {},
): Promise<OpenedRepository> {
  const backend = inferBackend(
    opts.dataPath ?? process.env.DATA_PATH?.trim(),
    opts.backend,
  )
  const path = resolveStorePath(backend, opts)

  if (backend === 'json') {
    return { repo: new JsonFileRepository(path), backend, path }
  }

  const sqlite = await SqliteRepository.open(path)
  let migration: OpenedRepository['migration']
  if (!opts.skipJsonMigration) {
    const jsonPath =
      opts.migrateFromJsonPath ??
      process.env.MIGRATE_FROM_JSON ??
      defaultJsonSibling(path)
    migration = await migrateJsonToSqlite(jsonPath, sqlite)
  }
  return { repo: sqlite, backend, path, sqlite, migration }
}
