import { createAppServer, JsonFileRepository } from './create-server.js'
import { join } from 'node:path'

const port = Number(process.env.PORT ?? 8787)
const dataPath = process.env.DATA_PATH ?? join(process.cwd(), 'data', 'commerce.json')
const openApiOut = join(process.cwd(), 'docs', 'openapi.json')

const app = createAppServer({
  repo: new JsonFileRepository(dataPath),
  openApiOutPath: openApiOut,
})

const { baseUrl } = await app.listen(port)
console.log(`agent-commerce API listening on ${baseUrl}`)
console.log(`openapi: ${baseUrl}/openapi.json`)
