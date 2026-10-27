import { useEffect, useState } from 'react'
import { createMerchantApi, type Metrics, type Promotion } from '../api/merchant-client.js'
import { formatCents } from '../api/format.js'
import type { Order, Product, ReturnRequest, Stock } from '../api/types.js'
import { validateInitialStock, validateThresholdOff } from './form-validation.js'

const api = createMerchantApi()

type PromoType = Promotion['type']

function describePromo(p: Promotion): string {
  switch (p.type) {
    case 'threshold_off':
      return `满减 · 满 ${formatCents(p.thresholdCents)} 减 ${formatCents(p.offCents)}`
    case 'coupon_percent':
      return `折扣 · ${p.percentOff}%${p.maxOffCents != null ? `（封顶 ${formatCents(p.maxOffCents)}）` : ''}`
    case 'coupon_fixed':
      return `立减 · ${formatCents(p.offCents)}`
    default: {
      const _exhaustive: never = p
      return _exhaustive
    }
  }
}

export default function MerchantApp() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<Record<string, Stock>>({})
  const [orders, setOrders] = useState<Order[]>([])
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sku, setSku] = useState('NEW-SKU')
  const [name, setName] = useState('New Product')
  const [priceCents, setPriceCents] = useState(1999)
  const [stock, setStock] = useState(10)
  const [agentNotes, setAgentNotes] = useState('Merchant-created SKU for agents.')
  const [promoCode, setPromoCode] = useState('FULL100')
  const [promoType, setPromoType] = useState<PromoType>('threshold_off')
  const [promoThreshold, setPromoThreshold] = useState(2000)
  const [promoOff, setPromoOff] = useState(100)
  const [promoPercent, setPromoPercent] = useState(10)

  async function refresh() {
    setError(null)
    let lastErr: unknown
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const [m, p, o, r, promos] = await Promise.all([
          api.metrics(),
          api.listProducts(),
          api.listOrders(),
          api.listReturns(),
          api.listPromotions(),
        ])
        setMetrics(m)
        setProducts(p)
        setOrders(o)
        setReturns(r)
        setPromotions(promos)
        // Stock columns come from the list response (onHand/reserved/available) — no N+1 inventory GETs.
        setStocks(
          Object.fromEntries(
            p.map((prod) => [
              prod.id,
              {
                productId: prod.id,
                onHand: prod.onHand ?? 0,
                reserved: prod.reserved ?? 0,
                available: prod.available ?? 0,
              },
            ]),
          ),
        )
        return
      } catch (e) {
        lastErr = e
        const msg = e instanceof Error ? e.message : ''
        if (!/too many requests|RATE_LIMITED/i.test(msg) || attempt === 3) break
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
    setError(lastErr instanceof Error ? lastErr.message : '加载失败')
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function createProduct() {
    const stockCheck = validateInitialStock(stock)
    if (!stockCheck.ok) {
      setError(stockCheck.message)
      return
    }
    try {
      const product = await api.upsertProduct({
        sku,
        name,
        priceCents,
        agentNotes,
        tags: ['merchant'],
        stock: stockCheck.stock,
      })
      setProducts((prev) => {
        const idx = prev.findIndex((x) => x.id === product.id || x.sku === product.sku)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = product
          return next
        }
        return [product, ...prev]
      })
      if (stockCheck.stock !== undefined) {
        setStocks((prev) => ({
          ...prev,
          [product.id]: {
            productId: product.id,
            onHand: stockCheck.stock!,
            reserved: 0,
            available: stockCheck.stock!,
          },
        }))
      }
      setError(null)
      void refresh()
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

  function buildPromo(): Promotion | null {
    const code = promoCode.trim()
    if (!code) {
      setError('促销代码必填')
      return null
    }
    if (promoType === 'threshold_off') {
      const check = validateThresholdOff({
        code,
        thresholdCents: promoThreshold,
        offCents: promoOff,
      })
      if (!check.ok) {
        setError(check.message)
        return null
      }
      return {
        code,
        type: 'threshold_off',
        thresholdCents: check.thresholdCents!,
        offCents: check.offCents!,
        active: true,
      }
    }
    if (promoType === 'coupon_percent') {
      if (!Number.isInteger(promoPercent) || promoPercent < 1 || promoPercent > 100) {
        setError('折扣百分比须为 1–100 的整数')
        return null
      }
      return {
        code,
        type: 'coupon_percent',
        percentOff: promoPercent,
        active: true,
      }
    }
    if (!Number.isInteger(promoOff) || promoOff < 0) {
      setError('优惠金额不能为负数')
      return null
    }
    return {
      code,
      type: 'coupon_fixed',
      offCents: promoOff,
      active: true,
    }
  }

  async function savePromo() {
    const promo = buildPromo()
    if (!promo) return
    try {
      const saved = await api.upsertPromotion(promo)
      setPromotions((prev) => {
        const idx = prev.findIndex((p) => p.code.toUpperCase() === saved.code.toUpperCase())
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [...prev, saved]
      })
      setError(null)
      void refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '促销保存失败')
    }
  }

  async function deactivatePromo(promo: Promotion) {
    try {
      const saved = await api.upsertPromotion({ ...promo, active: false })
      setPromotions((prev) =>
        prev.map((p) => (p.code.toUpperCase() === saved.code.toUpperCase() ? saved : p)),
      )
      setError(null)
      void refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '停用失败')
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

      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}

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
            初始库存
            <input
              type="number"
              min={0}
              step={1}
              required
              aria-label="初始库存"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
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
                <div className="muted" data-testid="merchant-stock">
                  库存可用 {stocks[p.id]?.available ?? p.available ?? '—'} / onHand{' '}
                  {stocks[p.id]?.onHand ?? p.onHand ?? '—'}
                  {stocks[p.id]?.reserved != null || p.reserved != null
                    ? ` / reserved ${stocks[p.id]?.reserved ?? p.reserved}`
                    : ''}
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

      <section className="section" id="promotions-panel">
        <h2>促销配置</h2>
        <div className="form-grid">
          <label>
            代码
            <input
              aria-label="促销代码"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
          </label>
          <label>
            类型
            <select
              aria-label="促销类型"
              value={promoType}
              onChange={(e) => setPromoType(e.target.value as PromoType)}
            >
              <option value="threshold_off">满减 (threshold_off)</option>
              <option value="coupon_fixed">立减 (coupon_fixed)</option>
              <option value="coupon_percent">折扣 (coupon_percent)</option>
            </select>
          </label>
          {promoType === 'threshold_off' ? (
            <label>
              门槛（分）
              <input
                type="number"
                min={0}
                step={1}
                aria-label="满减门槛"
                value={promoThreshold}
                onChange={(e) => setPromoThreshold(Number(e.target.value))}
              />
            </label>
          ) : null}
          {promoType === 'coupon_percent' ? (
            <label>
              折扣（%）
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                aria-label="折扣百分比"
                value={promoPercent}
                onChange={(e) => setPromoPercent(Number(e.target.value))}
              />
            </label>
          ) : (
            <label>
              优惠（分）
              <input
                type="number"
                min={0}
                step={1}
                aria-label="优惠金额"
                value={promoOff}
                onChange={(e) => setPromoOff(Number(e.target.value))}
              />
            </label>
          )}
        </div>
        <button type="button" className="primary" onClick={() => void savePromo()}>
          创建促销
        </button>
        <ul className="product-list" aria-label="促销列表">
          {promotions.map((p) => (
            <li key={p.code} className="merchant-row">
              <div>
                <strong>{p.code}</strong> · {describePromo(p)}
                <div className="muted">{p.active ? '生效中' : '已停用'}</div>
              </div>
              {p.active ? (
                <button type="button" onClick={() => void deactivatePromo(p)}>
                  停用
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
