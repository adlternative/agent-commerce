import { createAppServer } from './create-server.js'
import { createRepository } from '../repo/create-repository.js'
import { join } from 'node:path'

const port = Number(process.env.PORT ?? 8787)
const openApiOut = join(process.cwd(), 'docs', 'openapi.json')

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
})

const { baseUrl } = await app.listen(port)
console.log(`agent-commerce API listening on ${baseUrl}`)
console.log(`store: ${opened.backend} @ ${opened.path}`)
console.log(`openapi: ${baseUrl}/openapi.json`)
