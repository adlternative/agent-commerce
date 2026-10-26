import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { emptyDb, type CommerceDb, type CommerceRepository } from './types.js'
import { DomainError } from '../domain/errors.js'

/**
 * Single-file JSON repository.
 *
 * Deliberately simple (zero native deps, CI-friendly). Serialize all writes
 * through an in-process mutex + atomic rename. See docs/ARCHITECTURE.md for
 * the upgrade path to SQLite.
 */
export class JsonFileRepository implements CommerceRepository {
  private chain: Promise<unknown> = Promise.resolve()
  private readonly path: string

  constructor(path: string) {
    this.path = path
  }

  async read(): Promise<CommerceDb> {
    try {
      const raw = await readFile(this.path, 'utf8')
      return { ...emptyDb(), ...(JSON.parse(raw) as CommerceDb) }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return emptyDb()
      throw new DomainError('STORE_READ_FAILED', 'failed to read JSON store', {
        cause: err,
        retryable: true,
      })
    }
  }

  async transaction<T>(fn: (db: CommerceDb) => T | Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const db = await this.read()
      // Deep-ish clone so mutations inside fn don't leak on failure.
      const draft = structuredClone(db) as CommerceDb
      const result = await fn(draft)
      await this.persist(draft)
      return result
    })
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async checkReady(): Promise<void> {
    try {
      await this.read()
      await this.transaction((db) => {
        void db
      })
    } catch (err) {
      if (err instanceof DomainError && err.code === 'STORE_NOT_READY') throw err
      if (err instanceof DomainError) {
        throw new DomainError('STORE_NOT_READY', err.message, {
          cause: err,
          retryable: true,
          hint: err.hint,
        })
      }
      throw new DomainError('STORE_NOT_READY', 'JSON store not readable/writable', {
        cause: err,
        retryable: true,
      })
    }
  }

  private async persist(db: CommerceDb): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const tmp = `${this.path}.${process.pid}.${Date.now()}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8')
      await rename(tmp, this.path)
    } catch (err) {
      throw new DomainError('STORE_WRITE_FAILED', 'failed to write JSON store', {
        cause: err,
        retryable: true,
      })
    }
  }
}

/** In-memory repository for unit tests (same interface as JSON file). */
export class MemoryRepository implements CommerceRepository {
  private db: CommerceDb
  private chain: Promise<unknown> = Promise.resolve()

  constructor(seed?: Partial<CommerceDb>) {
    this.db = { ...emptyDb(), ...seed }
  }

  async read(): Promise<CommerceDb> {
    return structuredClone(this.db)
  }

  async transaction<T>(fn: (db: CommerceDb) => T | Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const draft = structuredClone(this.db)
      const result = await fn(draft)
      this.db = draft
      return result
    })
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async checkReady(): Promise<void> {
    await this.read()
    await this.transaction((db) => {
      void db
    })
  }
}
