import type { Product } from './product.js'

/** CJK Unified Ideographs + common extensions / kana used in product copy. */
const CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/
const CJK_CHAR_G = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g

export type SearchMode = 'primary' | 'cjk_fallback'

export type ScoredProduct = {
  product: Product
  score: number
  mode: SearchMode
}

const WEIGHTS = {
  name: 12,
  sku: 10,
  agentNotes: 8,
  tags: 6,
  description: 4,
} as const

export type TokenizedQuery = {
  raw: string
  /** Space-separated Latin/CJK phrase tokens (lowercased). */
  terms: string[]
  /** Individual CJK characters for fallback matching. */
  cjkChars: string[]
  hasCjk: boolean
}

/** Split a free-text query into primary terms + CJK character fallbacks. */
export function tokenizeQuery(q: string): TokenizedQuery {
  const raw = q.trim().toLowerCase()
  if (!raw) {
    return { raw: '', terms: [], cjkChars: [], hasCjk: false }
  }

  const terms: string[] = []
  // Split on whitespace / ASCII punctuation; keep CJK runs and alnum runs.
  const parts = raw.split(/[\s\p{P}\p{S}]+/u).filter(Boolean)
  for (const part of parts) {
    terms.push(part)
  }
  // Also keep the full phrase when it differs (multi-token / spaced CJK).
  if (raw.includes(' ') && !terms.includes(raw)) {
    terms.unshift(raw.replace(/\s+/g, ' ').trim())
  }

  const cjkChars = [...new Set(raw.match(CJK_CHAR_G) ?? [])]
  return {
    raw,
    terms: [...new Set(terms.filter(Boolean))],
    cjkChars,
    hasCjk: cjkChars.length > 0,
  }
}

function fieldBlob(p: Product): Record<keyof typeof WEIGHTS, string> {
  return {
    name: p.name.toLowerCase(),
    sku: p.sku.toLowerCase(),
    agentNotes: p.agentNotes.toLowerCase(),
    tags: p.tags.map((t) => t.toLowerCase()).join(' '),
    description: p.description.toLowerCase(),
  }
}

function haystack(fields: Record<keyof typeof WEIGHTS, string>): string {
  return `${fields.name} ${fields.sku} ${fields.agentNotes} ${fields.tags} ${fields.description}`
}

/** Primary: full phrase OR every term appears somewhere in searchable fields. */
export function matchesPrimary(p: Product, tokens: TokenizedQuery): boolean {
  if (!tokens.raw) return true
  const fields = fieldBlob(p)
  const hay = haystack(fields)
  if (hay.includes(tokens.raw)) return true
  if (tokens.terms.length === 0) return false
  return tokens.terms.every((t) => hay.includes(t))
}

/**
 * Chinese fallback: when primary AND-matching fails for CJK queries,
 * match products that contain a majority of the query's CJK characters.
 */
export function matchesCjkFallback(p: Product, tokens: TokenizedQuery): boolean {
  if (!tokens.hasCjk || tokens.cjkChars.length === 0) return false
  const hay = haystack(fieldBlob(p))
  const hits = tokens.cjkChars.filter((ch) => hay.includes(ch)).length
  const need = Math.max(1, Math.ceil(tokens.cjkChars.length * 0.5))
  return hits >= need
}

/**
 * Relevance score. agentNotes is a first-class field (WEIGHTS.agentNotes)
 * so LLM selling notes participate in ranking, not just filtering.
 */
export function scoreProduct(p: Product, tokens: TokenizedQuery, mode: SearchMode): number {
  if (!tokens.raw) return 0
  const fields = fieldBlob(p)
  let score = 0

  const terms =
    mode === 'cjk_fallback' && tokens.cjkChars.length > 0
      ? tokens.cjkChars
      : tokens.terms.length > 0
        ? tokens.terms
        : [tokens.raw]

  for (const [field, weight] of Object.entries(WEIGHTS) as [keyof typeof WEIGHTS, number][]) {
    const text = fields[field]
    if (!text) continue
    if (text === tokens.raw) score += weight * 4
    else if (text.includes(tokens.raw)) score += weight * 3
    for (const term of terms) {
      if (!term) continue
      if (text === term) score += weight * 2
      else if (text.startsWith(term)) score += weight + Math.floor(weight / 2)
      else if (text.includes(term)) score += weight
    }
  }

  // Phrase density bonus across the whole document.
  const hay = haystack(fields)
  if (mode === 'primary' && tokens.raw && hay.includes(tokens.raw)) {
    score += 5
  }
  if (mode === 'cjk_fallback') {
    const hits = tokens.cjkChars.filter((ch) => hay.includes(ch)).length
    score += hits * 2
  }

  return score
}

export type RankQuery = { q?: string; tag?: string; activeOnly?: boolean }

/**
 * Full-text search with ranking.
 * Strategy: primary token/phrase match → if empty and query has CJK, Chinese character fallback.
 * Results sorted by score DESC, id ASC (stable for keyset cursors).
 */
export function rankProducts(
  products: readonly Product[],
  query: RankQuery = {},
): ScoredProduct[] {
  const activeOnly = query.activeOnly !== false
  const tag = query.tag?.trim().toLowerCase()
  const tokens = tokenizeQuery(query.q ?? '')

  const base = products.filter((p) => {
    if (activeOnly && !p.active) return false
    if (tag && !p.tags.some((t) => t.toLowerCase() === tag)) return false
    return true
  })

  if (!tokens.raw) {
    return [...base]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((product) => ({ product, score: 0, mode: 'primary' as const }))
  }

  const primaryHits: ScoredProduct[] = []
  for (const product of base) {
    if (!matchesPrimary(product, tokens)) continue
    primaryHits.push({
      product,
      score: scoreProduct(product, tokens, 'primary'),
      mode: 'primary',
    })
  }

  let hits = primaryHits
  let mode: SearchMode = 'primary'
  if (primaryHits.length === 0 && tokens.hasCjk) {
    mode = 'cjk_fallback'
    hits = []
    for (const product of base) {
      if (!matchesCjkFallback(product, tokens)) continue
      hits.push({
        product,
        score: scoreProduct(product, tokens, 'cjk_fallback'),
        mode: 'cjk_fallback',
      })
    }
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.product.id.localeCompare(b.product.id)
  })

  // Annotate mode on each hit for tests / debugging (same for whole result set).
  return hits.map((h) => ({ ...h, mode }))
}
