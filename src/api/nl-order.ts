import type { CommerceApi } from './client.js'
import type { Order, Product } from './types.js'

export type NlStep = { type: string; detail: string }

export type NlOrderResult = {
  steps: NlStep[]
  order?: Order
  error?: string
}

const CN_QTY: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

const CN_NUM = '[一二两三四五六七八九十]'
const UNIT = '(?:件|个|盒|份)'

/**
 * Lightweight natural-language → /api/agent/* orchestrator.
 * No pricing/stock math here — all business rules stay on the server.
 */
export function parseNlIntent(text: string): {
  quantity: number
  query: string
  promo?: string
} {
  const promoMatch = text.match(/(?:券|优惠|用|coupon|code)\s*([A-Z0-9_-]{3,})/i)
  const promo =
    promoMatch?.[1]?.toUpperCase() ??
    text.match(/\b([A-Z]{2,}\d{2,})\b/)?.[1]?.toUpperCase()

  // Verb optional: 「两件 Agent Mug」 must parse without 买/购/要/加.
  const cnMatch =
    text.match(new RegExp(`(?:买|购|要|加)\\s*(${CN_NUM})\\s*${UNIT}?`)) ??
    text.match(new RegExp(`(${CN_NUM})\\s*${UNIT}`))

  // English buy/get/order N, ASCII N+unit, or xN — not ASCII-only-with-unit.
  const qtyMatch =
    text.match(/(?:买|购|要|加|buy|get|order)\s*(\d+)\s*(?:件|个|盒|份|x|×)?/i) ??
    text.match(/(\d+)\s*(?:件|个|盒|份|x|×)/i) ??
    text.match(/\bx\s*(\d+)\b/i)

  const quantity = cnMatch
    ? (CN_QTY[cnMatch[1]!] ?? 1)
    : qtyMatch
      ? Number(qtyMatch[1])
      : 1

  // Strip qty phrasing including Chinese numerals (\\d* alone misses 两).
  let query = text
    .replace(/(?:帮我|请|麻烦)/g, ' ')
    .replace(
      new RegExp(`(?:买|购|要|加|下单|buy|get|order)\\s*(?:${CN_NUM}|\\d+)?\\s*${UNIT}?`, 'gi'),
      ' ',
    )
    .replace(new RegExp(`${CN_NUM}\\s*${UNIT}`, 'g'), ' ')
    .replace(/\d+\s*(?:件|个|盒|份|x|×)/gi, ' ')
    .replace(/\bx\s*\d+\b/gi, ' ')
    .replace(/(?:用掉?|使用)?\s*(?:这张)?\s*(?:券|优惠码?|coupon|code)\s*[A-Z0-9_-]*/gi, ' ')
    .replace(/\b[A-Z]{2,}\d{2,}\b/g, ' ')
    .replace(/[，。！？、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    query,
    promo,
  }
}

export async function runNlOrder(
  api: CommerceApi,
  utterance: string,
): Promise<NlOrderResult> {
  const steps: NlStep[] = []
  try {
    const intent = parseNlIntent(utterance)
    steps.push({
      type: 'parse',
      detail: `qty=${intent.quantity} query="${intent.query}" promo=${intent.promo ?? '—'}`,
    })

    if (!intent.query) {
      return { steps, error: '没听懂数量或商品名' }
    }

    const products = await api.agent.listProducts(intent.query)
    steps.push({ type: 'search', detail: `found ${products.length} product(s)` })
    const product = pickProduct(products, intent.query)
    if (!product) {
      return { steps, error: `未找到匹配「${intent.query}」的商品` }
    }
    steps.push({ type: 'pick', detail: `${product.name} (${product.id}) @ ${product.priceCents}¢` })

    const cart = await api.agent.createCart()
    steps.push({ type: 'cart', detail: cart.id })
    await api.agent.addItem(cart.id, product.id, intent.quantity)
    steps.push({ type: 'add', detail: `+${intent.quantity}` })

    if (intent.promo) {
      await api.agent.applyPromotion(cart.id, intent.promo)
      steps.push({ type: 'promo', detail: intent.promo })
    }

    const quote = await api.agent.quoteCart(cart.id)
    steps.push({
      type: 'quote',
      detail: `total=${quote.totalCents}¢ (discount ${quote.discountCents}¢)`,
    })

    const order = await api.agent.placeOrder(cart.id)
    steps.push({ type: 'place', detail: `${order.id} status=${order.status}` })
    const paid = await api.agent.payOrder(order.id)
    steps.push({ type: 'pay', detail: paid.order.status })
    return { steps, order: paid.order }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { steps, error: message }
  }
}

function pickProduct(products: Product[], query: string): Product | undefined {
  if (products.length === 0) return undefined
  const q = query.toLowerCase()
  const scored = [...products].sort((a, b) => score(b, q) - score(a, q))
  return scored[0]
}

function score(p: Product, q: string): number {
  const hay = `${p.name} ${p.sku} ${p.tags.join(' ')} ${p.agentNotes}`.toLowerCase()
  if (hay.includes(q)) return 10
  return q.split(/\s+/).filter(Boolean).reduce((s, w) => s + (hay.includes(w) ? 2 : 0), 0)
}
