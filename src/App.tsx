import { useEffect, useMemo, useState, startTransition } from 'react'
import { createApi, ApiError } from './api/client.js'
import { formatCents } from './api/format.js'
import { runNlOrder, type NlStep } from './api/nl-order.js'
import type { Cart, CartQuote, Order, Product } from './api/types.js'

type View = 'home' | 'product' | 'cart' | 'order'

const api = createApi({
  baseUrl: '',
  token: 'customer-token',
})

export default function App() {
  const [view, setView] = useState<View>('home')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [stockNote, setStockNote] = useState('')
  const [cart, setCart] = useState<Cart | null>(null)
  const [quote, setQuote] = useState<CartQuote | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nlText, setNlText] = useState('帮我买两件 Agent Mug，用掉这张券 SAVE200')
  const [nlSteps, setNlSteps] = useState<NlStep[]>([])
  const [promoCode, setPromoCode] = useState('SAVE200')

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  async function refreshProducts(q?: string) {
    setError(null)
    try {
      const list = await api.listProducts(q)
      setProducts(list)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载商品失败（请先 npm run server）')
    }
  }

  useEffect(() => {
    void refreshProducts()
  }, [])

  async function ensureCart(): Promise<Cart> {
    if (cart) return cart
    const created = await api.createCart('web_customer')
    setCart(created)
    return created
  }

  async function openProduct(p: Product) {
    setSelected(p)
    setView('product')
    try {
      const stock = await api.checkInventory(p.id)
      setStockNote(`可售 ${stock.available}（在库 ${stock.onHand} / 预留 ${stock.reserved}）`)
    } catch {
      setStockNote('')
    }
  }

  async function addToCart(p: Product, qty = 1) {
    setBusy(true)
    setError(null)
    try {
      const c = await ensureCart()
      const next = await api.addItem(c.id, p.id, qty)
      setCart(next)
      const q = await api.quoteCart(next.id)
      setQuote(q)
      setView('cart')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加购失败')
    } finally {
      setBusy(false)
    }
  }

  async function applyPromo() {
    if (!cart || !promoCode.trim()) return
    setBusy(true)
    try {
      const next = await api.applyPromotion(cart.id, promoCode.trim())
      setCart(next)
      setQuote(await api.quoteCart(next.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '优惠券失败')
    } finally {
      setBusy(false)
    }
  }

  async function checkout() {
    if (!cart) return
    setBusy(true)
    setError(null)
    try {
      const placed = await api.placeOrder(cart.id)
      const paid = await api.payOrder(placed.id)
      setOrder(paid.order)
      setCart(null)
      setQuote(null)
      setView('order')
    } catch (e) {
      setError(e instanceof Error ? e.message : '结算失败')
    } finally {
      setBusy(false)
    }
  }

  async function runNl() {
    setBusy(true)
    setError(null)
    setNlSteps([])
    try {
      const result = await runNlOrder(api, nlText)
      setNlSteps(result.steps)
      if (result.error) setError(result.error)
      if (result.order) {
        setOrder(result.order)
        setView('order')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />
      <header className="top">
        <button type="button" className="brand" onClick={() => setView('home')}>
          Agent Commerce
        </button>
        <nav>
          <button type="button" onClick={() => setView('home')}>
            浏览
          </button>
          <button type="button" onClick={() => setView('cart')}>
            购物车{quote ? ` · ${formatCents(quote.totalCents)}` : ''}
          </button>
          {order ? (
            <button type="button" onClick={() => setView('order')}>
              订单
            </button>
          ) : null}
        </nav>
      </header>

      {error ? <p className="banner error">{error}</p> : null}

      {view === 'home' ? (
        <section className="hero">
          <p className="brand-mark">Agent Commerce</p>
          <h1>给人下单，也给 Agent 下单</h1>
          <p className="lede">同一套 HTTP API：浏览、加购、结算，或直接用人话让 AI 代劳。</p>
          <div className="cta-row">
            <button
              type="button"
              className="primary"
              onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
            >
              开始购物
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => document.getElementById('nl-panel')?.scrollIntoView({ behavior: 'smooth' })}
            >
              跟 AI 说人话
            </button>
          </div>
        </section>
      ) : null}

      {view === 'home' ? (
        <>
          <section id="catalog" className="section">
            <h2>商品</h2>
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault()
                startTransition(() => {
                  void refreshProducts(query)
                })
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索名称 / SKU / 标签"
                aria-label="搜索商品"
              />
              <button type="submit">搜索</button>
            </form>
            <ul className="product-list">
              {products.map((p) => (
                <li key={p.id}>
                  <button type="button" className="product-row" onClick={() => void openProduct(p)}>
                    <span className="pname">{p.name}</span>
                    <span className="psku">{p.sku}</span>
                    <span className="pprice">{formatCents(p.priceCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section id="nl-panel" className="section nl">
            <h2>跟 AI 说人话下单</h2>
            <p className="hint">走 `/api/agent/*`，不在前端算价或扣库存。</p>
            <textarea value={nlText} onChange={(e) => setNlText(e.target.value)} rows={3} />
            <button type="button" className="primary" disabled={busy} onClick={() => void runNl()}>
              {busy ? '处理中…' : '让 Agent 下单'}
            </button>
            {nlSteps.length > 0 ? (
              <ol className="steps">
                {nlSteps.map((s, i) => (
                  <li key={`${s.type}-${i}`}>
                    <code>{s.type}</code> {s.detail}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </>
      ) : null}

      {view === 'product' && selected ? (
        <section className="section detail">
          <button type="button" className="ghost" onClick={() => setView('home')}>
            ← 返回
          </button>
          <h2>{selected.name}</h2>
          <p className="pprice">{formatCents(selected.priceCents)}</p>
          <p>{selected.description || '—'}</p>
          <p className="stock">{stockNote}</p>
          <aside className="agent-notes">
            <h3>agentNotes</h3>
            <p>{selected.agentNotes || '（无）'}</p>
          </aside>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void addToCart(selected, 1)}
          >
            加入购物车
          </button>
        </section>
      ) : null}

      {view === 'cart' ? (
        <section className="section">
          <h2>购物车 / 结算</h2>
          {!cart || cart.items.length === 0 ? (
            <p>购物车是空的。</p>
          ) : (
            <>
              <ul className="cart-lines">
                {cart.items.map((line) => (
                  <li key={line.productId}>
                    {productMap.get(line.productId)?.name ?? line.productId} × {line.quantity} ·{' '}
                    {formatCents(line.unitPriceCents * line.quantity)}
                  </li>
                ))}
              </ul>
              <div className="promo-row">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="优惠码"
                />
                <button type="button" onClick={() => void applyPromo()} disabled={busy}>
                  应用
                </button>
              </div>
              {quote ? (
                <p className="totals">
                  小计 {formatCents(quote.subtotalCents)} · 优惠{' '}
                  {formatCents(quote.discountCents)} · <strong>应付 {formatCents(quote.totalCents)}</strong>
                </p>
              ) : null}
              <button type="button" className="primary" disabled={busy} onClick={() => void checkout()}>
                下单并支付
              </button>
            </>
          )}
        </section>
      ) : null}

      {view === 'order' && order ? (
        <section className="section">
          <h2>订单状态</h2>
          <p>
            <code>{order.id}</code>
          </p>
          <p className="status">{order.status}</p>
          <p>实付 {formatCents(order.totalCents)}</p>
          <ul>
            {order.lines.map((l) => (
              <li key={l.productId}>
                {l.productId} × {l.quantity}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
