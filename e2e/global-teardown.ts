import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Remove per-run DATA_DIR trees recorded by playwright configs.
 * Ensures e2e does not leave json (or sqlite) junk under /tmp.
 */
async function globalTeardown(): Promise<void> {
  const markerDir = join(tmpdir(), 'agent-commerce-e2e-markers')
  let entries: string[] = []
  try {
    entries = await readdir(markerDir)
  } catch {
    return
  }
  for (const name of entries) {
    if (!name.endsWith('.dir')) continue
    const markerPath = join(markerDir, name)
    try {
      const dataDir = (await readFile(markerPath, 'utf8')).trim()
      if (dataDir) await rm(dataDir, { recursive: true, force: true })
      await rm(markerPath, { force: true })
    } catch {
      // best-effort cleanup
    }
  }
  try {
    const left = await readdir(markerDir)
    if (left.length === 0) await rm(markerDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

export default globalTeardown
