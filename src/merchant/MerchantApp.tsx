import { useEffect, useState } from 'react'
import { createMerchantApi, type Metrics, type Promotion } from '../api/merchant-client.js'
import { formatCents } from '../api/format.js'
import type { Order, Product, ReturnRequest, Stock } from '../api/types.js'

const api = createMerchantApi()

export default function MerchantApp() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<Record<string, Stock>>({})
  const [orders, setOrders] = useState<Order[]>([])
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sku, setSku] = useState('NEW-SKU')
  const [name, setName] = useState('New Product')
  const [priceCents, setPriceCents] = useState(1999)
  const [agentNotes, setAgentNotes] = useState('Merchant-created SKU for agents.')
  const [promoCode, setPromoCode] = useState('WELCOME100')
  const [promoOff, setPromoOff] = useState(100)

  async function refresh() {
    setError(null)
    try {
      const [m, p, o, r] = await Promise.all([
        api.metrics(),
        api.listProducts(),
        api.listOrders(),
        api.listReturns(),
      ])
      setMetrics(m)
      setProducts(p)
      setOrders(o)
      setReturns(r)
      const stockEntries = await Promise.all(
        p.map(async (prod) => [prod.id, await api.inventory(prod.id)] as const),
      )
      setStocks(Object.fromEntries(stockEntries))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function createProduct() {
    try {
      await api.upsertProduct({
        sku,
        name,
        priceCents,
        agentNotes,
        tags: ['merchant'],
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  async function bumpStock(productId: string, delta: number) {
    try {
      await api.adjustStock(productId, delta)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '库存调整失败')
    }
  }

  async function advance(order: Order) {
    try {
      if (order.status === 'paid') await api.ship(order.id)
      else if (order.status === 'shipped') await api.deliver(order.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '订单流转失败')
    }
  }

  async function decideReturn(ret: ReturnRequest, decision: 'approve' | 'reject') {
    try {
      if (decision === 'approve') await api.approveReturn(ret.id)
      else await api.rejectReturn(ret.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '退货处理失败')
    }
  }

  async function savePromo() {
    const promo: Promotion = {
      code: promoCode,
      type: 'coupon_fixed',
      offCents: promoOff,
      active: true,
    }
    try {
      await api.upsertPromotion(promo)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '促销保存失败')
    }
  }

  return (
    <div className="page merchant">
      <div className="atmosphere" aria-hidden />
      <header className="top">
        <a className="brand" href="#/">
          Agent Commerce
        </a>
        <nav>
          <a href="#/">顾客前台</a>
          <strong>商家后台</strong>
        </nav>
      </header>

      {error ? <p className="banner error">{error}</p> : null}

      <section className="section">
        <h2>指标看板</h2>
        {metrics ? (
          <dl className="metrics">
            <div>
              <dt>GMV</dt>
              <dd>{formatCents(metrics.gmvCents)}</dd>
            </div>
            <div>
              <dt>订单数</dt>
              <dd>{metrics.orderCount}</dd>
            </div>
            <div>
              <dt>已支付订单</dt>
              <dd>{metrics.paidOrderCount}</dd>
            </div>
            <div>
              <dt>缺货 SKU</dt>
              <dd>{metrics.outOfStockCount}</dd>
            </div>
          </dl>
        ) : (
          <p>加载中…</p>
        )}
      </section>

      <section className="section">
        <h2>商品 CRUD</h2>
        <div className="form-grid">
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
          <label>
            名称
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            价格（分）
            <input
              type="number"
              value={priceCents}
              onChange={(e) => setPriceCents(Number(e.target.value))}
            />
          </label>
          <label>
            agentNotes
            <input value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} />
          </label>
        </div>
        <button type="button" className="primary" onClick={() => void createProduct()}>
          创建 / 更新商品
        </button>
        <ul className="product-list">
          {products.map((p) => (
            <li key={p.id} className="merchant-row">
              <div>
                <strong>{p.name}</strong> · {p.sku} · {formatCents(p.priceCents)}
                <div className="muted">
                  库存可用 {stocks[p.id]?.available ?? '—'} / onHand {stocks[p.id]?.onHand ?? '—'}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => void bumpStock(p.id, 5)}>
                  +5
                </button>
                <button type="button" onClick={() => void bumpStock(p.id, -1)}>
                  -1
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>订单流转</h2>
        <ul className="product-list">
          {orders.map((o) => (
            <li key={o.id} className="merchant-row" data-order-id={o.id} data-order-status={o.status}>
              <div>
                <code>{o.id}</code> · <span className="order-status">{o.status}</span> ·{' '}
                {formatCents(o.totalCents)}
              </div>
              {(o.status === 'paid' || o.status === 'shipped') && (
                <button type="button" className="primary" onClick={() => void advance(o)}>
                  {o.status === 'paid' ? '发货' : '签收'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="section" data-testid="returns-section">
        <h2>退货审核</h2>
        {returns.length === 0 ? (
          <p className="muted">暂无退货申请</p>
        ) : (
          <ul className="product-list">
            {returns.map((r) => (
              <li key={r.id} className="merchant-row" data-return-id={r.id} data-return-status={r.status}>
                <div>
                  <code>{r.id}</code> · {r.status} · {formatCents(r.amountCents)}
                  <div className="muted">
                    订单 <code>{r.orderId}</code> · {r.reason} ·{' '}
                    {r.lines.map((l) => `${l.productId}×${l.quantity}`).join(', ')}
                  </div>
                </div>
                {r.status === 'requested' ? (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => void decideReturn(r, 'approve')}
                    >
                      批准
                    </button>
                    <button type="button" onClick={() => void decideReturn(r, 'reject')}>
                      拒绝
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>促销配置</h2>
        <div className="form-grid">
          <label>
            代码
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
          </label>
          <label>
            立减（分）
            <input
              type="number"
              value={promoOff}
              onChange={(e) => setPromoOff(Number(e.target.value))}
            />
          </label>
        </div>
        <button type="button" className="primary" onClick={() => void savePromo()}>
          保存固定券
        </button>
      </section>
    </div>
  )
}
