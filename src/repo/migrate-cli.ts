/**
 * Migration CLI:
 *   node dist-server/repo/migrate-cli.js [--sqlite path] [--from-json path]
 *
 * Ensures schema migrations on an empty or existing SQLite file, and optionally
 * imports a legacy commerce.json snapshot when the SQLite DB is empty.
 */
import { join } from 'node:path'
import { createRepository } from './create-repository.js'
import { SqliteRepository } from './sqlite-repository.js'

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  if (i < 0) return undefined
  return argv[i + 1]
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const sqlitePath =
    argValue(argv, '--sqlite') ??
    process.env.DATA_PATH ??
    join(process.cwd(), 'data', 'commerce.sqlite')
  const fromJson =
    argValue(argv, '--from-json') ??
    process.env.MIGRATE_FROM_JSON ??
    join(process.cwd(), 'data', 'commerce.json')

  if (argv.includes('--empty-only')) {
    const repo = await SqliteRepository.open(sqlitePath)
    const versions = repo.migrationVersions()
    console.log(
      JSON.stringify({
        ok: true,
        path: sqlitePath,
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
