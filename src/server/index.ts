import { createAppServer } from './create-server.js'
import { createRepository, resolveDataDir } from '../repo/create-repository.js'
import {
  buildAuthConfig,
  demoCredentialsEnabled,
  MissingJwtSecretError,
} from './auth.js'
import { join } from 'node:path'

const port = Number(process.env.PORT ?? 8787)
const openApiOut = join(process.cwd(), 'docs', 'openapi.json')

let auth
try {
  auth = buildAuthConfig()
} catch (err) {
  if (err instanceof MissingJwtSecretError) {
    console.error(err.message)
    process.exit(1)
  }
  throw err
}

const opened = await createRepository({
  dataPath: process.env.DATA_PATH,
})

if (opened.migration?.migrated) {
  console.log(
    `migrated JSON → SQLite (${opened.migration.productCount} products)`,
  )
}

const app = createAppServer({
  repo: opened.repo,
  openApiOutPath: openApiOut,
  seedDemo: true,
  auth,
})

const { baseUrl } = await app.listen(port)
console.log(`agent-commerce API listening on ${baseUrl}`)
console.log(`store: ${opened.backend} @ ${opened.path}`)
console.log(`DATA_DIR: ${resolveDataDir()}`)
console.log(`openapi: ${baseUrl}/openapi.json`)
console.log(
  `auth: JWT_SECRET ${process.env.JWT_SECRET?.trim() ? 'from env' : 'ephemeral (non-production)'}; demo credentials ${
    demoCredentialsEnabled() ? 'on' : 'off'
  }`,
)
