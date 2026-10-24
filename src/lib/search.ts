/** Minimal product shape needed for catalog search/filter. */
export interface SearchableProduct {
  id: string
  name: string
  tags: string[]
  agentNotes: string
  stock: number
}

export interface SearchFilter {
  /** Free-text query matched against name, tags, and agentNotes (case-insensitive). */
  query?: string
  /** Keep products that include every listed tag (case-insensitive). */
  tags?: string[]
  /** When true, drop products with stock <= 0. */
  inStockOnly?: boolean
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function matchesQuery(product: SearchableProduct, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  if (normalize(product.name).includes(q)) return true
  if (normalize(product.agentNotes).includes(q)) return true
  return product.tags.some((tag) => normalize(tag).includes(q))
}

function matchesTags(product: SearchableProduct, required: string[]): boolean {
  if (required.length === 0) return true
  const productTags = product.tags.map(normalize)
  return required.every((tag) => {
    const t = normalize(tag)
    return t.length > 0 && productTags.includes(t)
  })
}

/**
 * Filter a product list by query / tags / stock.
 * Pure: returns a new array and never mutates `products`.
 */
export function filterProducts<T extends SearchableProduct>(
  products: readonly T[],
  filter: SearchFilter = {},
): T[] {
  const { query = '', tags = [], inStockOnly = false } = filter

  return products.filter((product) => {
    if (inStockOnly && product.stock <= 0) return false
    if (!matchesQuery(product, query)) return false
    if (!matchesTags(product, tags)) return false
    return true
  })
}
