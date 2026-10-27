import { isAbsolute, join, resolve } from 'node:path'

/**
 * Resolve the configurable data directory.
 * - `DATA_DIR` env (default `./data`) relative to cwd, or absolute as-is
 * - Used for SQLite/JSON store paths when `DATA_PATH` is unset
 */
export function resolveDataDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const raw = env.DATA_DIR?.trim()
  if (!raw) return resolve(cwd, 'data')
  return isAbsolute(raw) ? raw : resolve(cwd, raw)
}

/** Default store file under DATA_DIR. */
export function defaultStorePath(
  backend: 'sqlite' | 'json',
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const dir = resolveDataDir(env, cwd)
  return join(dir, backend === 'json' ? 'commerce.json' : 'commerce.sqlite')
}

/**
 * Explicit file path precedence:
 * opts.dataPath → DATA_PATH → `$DATA_DIR/commerce.{sqlite|json}`
 */
export function resolveStorePath(
  backend: 'sqlite' | 'json',
  opts: { dataPath?: string } = {},
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  if (opts.dataPath) return opts.dataPath
  const fromEnv = env.DATA_PATH?.trim()
  if (fromEnv) return fromEnv
  return defaultStorePath(backend, env, cwd)
}
