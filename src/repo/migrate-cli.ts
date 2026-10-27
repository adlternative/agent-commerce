/**
 * Migration CLI:
 *   node dist-server/repo/migrate-cli.js [--sqlite path] [--from-json path]
 *
 * Ensures schema migrations on an empty or existing SQLite file, and optionally
 * imports a legacy commerce.json snapshot when the SQLite DB is empty.
 *
 * Defaults honor DATA_DIR (./data) and DATA_PATH.
 */
import { join } from 'node:path'
import { createRepository } from './create-repository.js'
import { SqliteRepository } from './sqlite-repository.js'
import { resolveDataDir, resolveStorePath } from './data-dir.js'

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  if (i < 0) return undefined
  return argv[i + 1]
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const dataDir = resolveDataDir()
  const sqlitePath =
    argValue(argv, '--sqlite') ?? resolveStorePath('sqlite')
  const fromJson =
    argValue(argv, '--from-json') ??
    process.env.MIGRATE_FROM_JSON ??
    join(dataDir, 'commerce.json')

  if (argv.includes('--empty-only')) {
    const repo = await SqliteRepository.open(sqlitePath)
    const versions = repo.migrationVersions()
    console.log(
      JSON.stringify({
        ok: true,
        path: sqlitePath,
        dataDir,
        migrations: versions,
        empty: repo.isEmpty(),
      }),
    )
    repo.close()
    return
  }

  const opened = await createRepository({
    backend: 'sqlite',
    dataPath: sqlitePath,
    migrateFromJsonPath: fromJson,
  })
  const versions = opened.sqlite?.migrationVersions() ?? []
  console.log(
    JSON.stringify({
      ok: true,
      path: opened.path,
      dataDir,
      backend: opened.backend,
      migrations: versions,
      migration: opened.migration,
    }),
  )
  opened.sqlite?.close()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
