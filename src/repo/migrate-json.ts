import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { DomainError } from '../domain/errors.js'
import { emptyDb, type CommerceDb } from './types.js'
import { SqliteRepository } from './sqlite-repository.js'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/** Load a CommerceDb snapshot from a JSON file (ENOENT → empty). */
export async function readJsonCommerceDb(jsonPath: string): Promise<CommerceDb> {
  try {
    const raw = await readFile(jsonPath, 'utf8')
    return { ...emptyDb(), ...(JSON.parse(raw) as CommerceDb) }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return emptyDb()
    throw new DomainError('STORE_READ_FAILED', 'failed to read JSON store for migration', {
      cause: err,
      retryable: false,
    })
  }
}

export type MigrateJsonResult = {
  migrated: boolean
  reason: 'empty-sqlite-imported-json' | 'sqlite-already-populated' | 'json-missing' | 'json-empty'
  productCount: number
}

/**
 * One-shot import: if SQLite is empty and `jsonPath` exists with data, copy into SQLite.
 * Safe to call on every boot (no-op when SQLite already has rows or JSON absent/empty).
 */
export async function migrateJsonToSqlite(
  jsonPath: string,
  sqlite: SqliteRepository,
): Promise<MigrateJsonResult> {
  if (!sqlite.isEmpty()) {
    const db = await sqlite.read()
    return {
      migrated: false,
      reason: 'sqlite-already-populated',
      productCount: db.products.length,
    }
  }

  if (!(await fileExists(jsonPath))) {
    return { migrated: false, reason: 'json-missing', productCount: 0 }
  }

  const data = await readJsonCommerceDb(jsonPath)
  const hasData =
    data.products.length > 0 ||
    data.stock.length > 0 ||
    data.orders.length > 0 ||
    data.carts.length > 0 ||
    data.idempotency.length > 0 ||
    data.promotions.length > 0

  if (!hasData) {
    return { migrated: false, reason: 'json-empty', productCount: 0 }
  }

  await sqlite.replaceAll(data)
  return {
    migrated: true,
    reason: 'empty-sqlite-imported-json',
    productCount: data.products.length,
  }
}

/**
 * Ensure a SQLite file exists with schema applied (empty migrations from scratch).
 * Used by CLI / tests for "migrate from empty".
 */
export async function migrateEmptySqlite(sqlitePath: string): Promise<SqliteRepository> {
  return SqliteRepository.open(sqlitePath)
}
