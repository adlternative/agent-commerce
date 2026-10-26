import type { CommerceService } from '../services/commerce.js'

const COMPLETE_LIMIT = 20

function filterPrefix(ids: string[], value: string): string[] {
  const q = value.trim().toLowerCase()
  const matched = q ? ids.filter((id) => id.toLowerCase().includes(q)) : ids
  return matched.slice(0, COMPLETE_LIMIT)
}

/** Autocomplete order ids for `orders://{id}`. */
export async function completeOrderIds(
  commerce: CommerceService,
  value: string,
): Promise<string[]> {
  const orders = await commerce.listOrders()
  return filterPrefix(
    orders.map((o) => o.id),
    value,
  )
}

/** Autocomplete product ids for `products://{id}`. */
export async function completeProductIds(
  commerce: CommerceService,
  value: string,
): Promise<string[]> {
  const products = await commerce.listProducts({ activeOnly: true })
  return filterPrefix(
    products.map((p) => p.id),
    value,
  )
}

/** List concrete order resource URIs for resources/list. */
export async function listOrderResources(commerce: CommerceService) {
  const orders = await commerce.listOrders()
  return {
    resources: orders.slice(0, 50).map((o) => ({
      uri: `orders://${o.id}`,
      name: `order ${o.id}`,
      description: `${o.status} · ${o.totalCents}¢ · customer ${o.customerId}`,
      mimeType: 'application/json' as const,
    })),
  }
}

/** List concrete product resource URIs for resources/list. */
export async function listProductResources(commerce: CommerceService) {
  const products = await commerce.listProducts({ activeOnly: true })
  return {
    resources: products.slice(0, 50).map((p) => ({
      uri: `products://${p.id}`,
      name: p.name,
      description: `${p.sku} · ${p.priceCents}¢`,
      mimeType: 'application/json' as const,
    })),
  }
}
