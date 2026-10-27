/**
 * Auto-generate docs/reference/*.generated.md from:
 * - docs/openapi.json (HTTP API)
 * - src/mcp/tools.ts ToolSchemas + TOOL_DESCRIPTIONS
 * - src/mcp/sampling.ts RecommendProductsSchema (recommend_products)
 *
 * Do not hand-edit the generated files — re-run `npm run docs:gen`.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodTypeAny } from 'zod'
import { TOOL_DESCRIPTIONS, ToolSchemas, type ToolName } from '../src/mcp/tools.js'
import { RecommendProductsSchema } from '../src/mcp/sampling.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs', 'reference')

type OpenApi = {
  openapi?: string
  info?: { title?: string; version?: string; description?: string }
  paths?: Record<
    string,
    Record<
      string,
      {
        summary?: string
        description?: string
        operationId?: string
        tags?: string[]
        parameters?: Array<{
          name: string
          in: string
          required?: boolean
          description?: string
          schema?: unknown
        }>
        requestBody?: {
          required?: boolean
          content?: Record<string, { schema?: unknown }>
        }
        responses?: Record<string, { description?: string }>
      }
    >
  >
}

function schemaPreview(schema: unknown, indent = 0): string {
  if (schema == null) return '_none_'
  const pad = '  '.repeat(indent)
  try {
    const json = JSON.stringify(schema, null, 2)
    return ['```json', json, '```'].join('\n')
  } catch {
    return `${pad}${String(schema)}`
  }
}

function genApiMd(spec: OpenApi): string {
  const lines: string[] = [
    '---',
    'title: API 参考（OpenAPI 生成）',
    'description: Auto-generated from docs/openapi.json — do not hand-edit.',
    '---',
    '',
    '# API 参考',
    '',
    '> **Generated** from [`docs/openapi.json`](../openapi.json) by `npm run docs:gen`.',
    '> Do not hand-copy endpoints here — edit the OpenAPI source (or the Zod schemas that feed it) and regenerate.',
    '',
    `- **Spec:** OpenAPI ${spec.openapi ?? '?'}`,
    `- **Title:** ${spec.info?.title ?? 'Agent Commerce'}`,
    `- **Version:** ${spec.info?.version ?? '?'}`,
    '',
  ]

  if (spec.info?.description) {
    lines.push(spec.info.description.trim(), '')
  }

  const paths = Object.keys(spec.paths ?? {}).sort()
  lines.push(`## Endpoints (${paths.length} paths)`, '')

  for (const path of paths) {
    const item = spec.paths![path]!
    const methods = Object.keys(item)
      .filter((m) => !m.startsWith('x-'))
      .sort()
    for (const method of methods) {
      const op = item[method]!
      const title = `${method.toUpperCase()} \`${path}\``
      lines.push(`### ${title}`, '')
      if (op.summary) lines.push(`**${op.summary}**`, '')
      if (op.description) lines.push(op.description.trim(), '')
      if (op.operationId) lines.push(`- **operationId:** \`${op.operationId}\``)
      if (op.tags?.length) lines.push(`- **tags:** ${op.tags.map((t) => `\`${t}\``).join(', ')}`)
      lines.push('')

      if (op.parameters?.length) {
        lines.push('#### Parameters', '', '| Name | In | Required | Description |', '|------|----|----------|-------------|')
        for (const p of op.parameters) {
          const desc = (p.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
          lines.push(
            `| \`${p.name}\` | ${p.in} | ${p.required ? 'yes' : 'no'} | ${desc} |`,
          )
        }
        lines.push('')
      }

      const jsonBody = op.requestBody?.content?.['application/json']?.schema
      if (jsonBody) {
        lines.push(
          '#### Request body',
          '',
          op.requestBody?.required ? '_required_' : '_optional_',
          '',
          schemaPreview(jsonBody),
          '',
        )
      }

      if (op.responses && Object.keys(op.responses).length) {
        lines.push('#### Responses', '', '| Status | Description |', '|--------|-------------|')
        for (const [code, resp] of Object.entries(op.responses).sort()) {
          const desc = (resp.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
          lines.push(`| \`${code}\` | ${desc} |`)
        }
        lines.push('')
      }
    }
  }

  lines.push(
    '## Source',
    '',
    'Regenerate with:',
    '',
    '```bash',
    'npm run docs:gen',
    '```',
    '',
  )
  return lines.join('\n')
}

function jsonSchemaForZod(schema: ZodTypeAny, name: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodToJsonSchema(schema as any, { name, $refStrategy: 'none' })
}

function genMcpMd(): string {
  const names = Object.keys(ToolSchemas) as ToolName[]
  const lines: string[] = [
    '---',
    'title: MCP Tools 参考（代码生成）',
    'description: Auto-generated from src/mcp/tools.ts + sampling.ts — do not hand-edit.',
    '---',
    '',
    '# MCP Tools 参考',
    '',
    '> **Generated** from `TOOL_DESCRIPTIONS` / `ToolSchemas` in [`src/mcp/tools.ts`](../../src/mcp/tools.ts)',
    '> plus `recommend_products` / `RecommendProductsSchema` in [`src/mcp/sampling.ts`](../../src/mcp/sampling.ts).',
    '> Do not hand-copy the tool table — change the code and run `npm run docs:gen`.',
    '',
    `## Tools (${names.length + 1})`,
    '',
    '| Tool | Purpose |',
    '|------|---------|',
  ]

  for (const name of names) {
    const purpose = TOOL_DESCRIPTIONS[name].replace(/\|/g, '\\|')
    lines.push(`| [\`${name}\`](#${name}) | ${purpose} |`)
  }
  lines.push(
    '| [`recommend_products`](#recommend_products) | Ask the client LLM (MCP sampling/createMessage) for product recommendations given a shopper goal. Falls back to catalog context when sampling is unavailable. |',
    '',
  )

  for (const name of names) {
    lines.push(`## \`${name}\``, '', TOOL_DESCRIPTIONS[name], '', '### Input schema', '')
    const json = jsonSchemaForZod(ToolSchemas[name], name)
    lines.push(schemaPreview(json), '')
  }

  lines.push(
    '## `recommend_products`',
    '',
    'Ask the client LLM (MCP sampling/createMessage) for product recommendations given a shopper goal. Falls back to catalog context when sampling is unavailable.',
    '',
    'Registered in `src/mcp/create-mcp-server.ts` (not in `ToolSchemas`).',
    '',
    '### Input schema',
    '',
    schemaPreview(jsonSchemaForZod(RecommendProductsSchema, 'recommend_products')),
    '',
    '## Source',
    '',
    '```bash',
    'npm run docs:gen',
    '```',
    '',
  )
  return lines.join('\n')
}

mkdirSync(outDir, { recursive: true })
const openapi = JSON.parse(readFileSync(join(root, 'docs', 'openapi.json'), 'utf8')) as OpenApi
const apiPath = join(outDir, 'api.generated.md')
const mcpPath = join(outDir, 'mcp-tools.generated.md')
writeFileSync(apiPath, genApiMd(openapi))
writeFileSync(mcpPath, genMcpMd())
console.log(`wrote ${apiPath}`)
console.log(`wrote ${mcpPath}`)
