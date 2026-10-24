import { FormEvent, useState } from 'react'

/** Amounts are integer fen (分), matching Agent Commerce conventions. */
export type CheckoutLine = {
  sku: string
  name: string
  qty: number
  unitPriceFen: number
}

export type CheckoutTotals = {
  subtotalFen: number
  discountFen: number
  shippingFen: number
  payableFen: number
}

const DEMO_LINES: CheckoutLine[] = [
  { sku: 'SKU-NOTE-01', name: 'Agent 笔记本 Pro 14"', qty: 1, unitPriceFen: 899900 },
  { sku: 'SKU-DOCK-02', name: '雷电扩展坞', qty: 1, unitPriceFen: 49900 },
  { sku: 'SKU-CABLE-03', name: '编织 USB-C 线 2m', qty: 2, unitPriceFen: 5900 },
]

function computeTotals(lines: CheckoutLine[], member: boolean): CheckoutTotals {
  const subtotalFen = lines.reduce((sum, line) => sum + line.unitPriceFen * line.qty, 0)
  const thresholdFen = 100000
  const fullReduceFen = subtotalFen >= thresholdFen ? 5000 : 0
  const memberFen = member ? Math.floor(subtotalFen * 0.05) : 0
  const discountFen = fullReduceFen + memberFen
  const afterDiscount = Math.max(0, subtotalFen - discountFen)
  const shippingFen = afterDiscount >= 9900 ? 0 : 1200
  return {
    subtotalFen,
    discountFen,
    shippingFen,
    payableFen: afterDiscount + shippingFen,
  }
}

function formatYuan(fen: number): string {
  const sign = fen < 0 ? '-' : ''
  const abs = Math.abs(fen)
  const yuan = Math.floor(abs / 100)
  const rem = abs % 100
  return `${sign}¥${yuan}.${rem.toString().padStart(2, '0')}`
}

type Props = {
  lines?: CheckoutLine[]
  member?: boolean
}

export default function CheckoutPage({ lines = DEMO_LINES, member = true }: Props) {
  const [name, setName] = useState('Agent Buyer')
  const [phone, setPhone] = useState('13800138000')
  const [address, setAddress] = useState('上海市浦东新区张江路 100 号')
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat' | 'card'>('alipay')
  const [submitted, setSubmitted] = useState(false)

  const totals = computeTotals(lines, member)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="checkout" data-testid="checkout-page">
      <header className="checkout-brand">
        <p className="checkout-brand__mark">Agent Commerce</p>
        <h1 className="checkout-brand__title">结算</h1>
        <p className="checkout-brand__lede">确认商品、收货信息与支付方式后提交订单。</p>
      </header>

      <form className="checkout-layout" onSubmit={onSubmit}>
        <section className="checkout-panel" aria-labelledby="order-heading">
          <h2 id="order-heading">订单商品</h2>
          <ul className="checkout-lines">
            {lines.map((line) => (
              <li key={line.sku} className="checkout-line">
                <div>
                  <p className="checkout-line__name">{line.name}</p>
                  <p className="checkout-line__meta">
                    {line.sku} · ×{line.qty}
                  </p>
                </div>
                <p className="checkout-line__price">
                  {formatYuan(line.unitPriceFen * line.qty)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="checkout-panel" aria-labelledby="ship-heading">
          <h2 id="ship-heading">收货信息</h2>
          <div className="checkout-fields">
            <label>
              <span>收货人</span>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label>
              <span>手机号</span>
              <input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <label className="checkout-fields__full">
              <span>地址</span>
              <input
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                autoComplete="street-address"
              />
            </label>
          </div>
        </section>

        <section className="checkout-panel" aria-labelledby="pay-heading">
          <h2 id="pay-heading">支付方式</h2>
          <div className="checkout-pay" role="radiogroup" aria-label="支付方式">
            {(
              [
                ['alipay', '支付宝'],
                ['wechat', '微信支付'],
                ['card', '银行卡'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={payMethod === value ? 'is-active' : undefined}>
                <input
                  type="radio"
                  name="payMethod"
                  value={value}
                  checked={payMethod === value}
                  onChange={() => setPayMethod(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <aside className="checkout-summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading">应付明细</h2>
          <dl className="checkout-totals">
            <div>
              <dt>商品小计</dt>
              <dd>{formatYuan(totals.subtotalFen)}</dd>
            </div>
            <div>
              <dt>优惠减免{member ? '（含会员）' : ''}</dt>
              <dd className="is-discount">-{formatYuan(totals.discountFen)}</dd>
            </div>
            <div>
              <dt>运费</dt>
              <dd>{totals.shippingFen === 0 ? '包邮' : formatYuan(totals.shippingFen)}</dd>
            </div>
            <div className="checkout-totals__payable">
              <dt>应付金额</dt>
              <dd data-testid="payable-amount">{formatYuan(totals.payableFen)}</dd>
            </div>
          </dl>
          <button type="submit" className="checkout-submit" disabled={submitted}>
            {submitted ? '已提交' : '提交订单'}
          </button>
          {submitted ? (
            <p className="checkout-success" role="status" data-testid="checkout-success">
              订单已提交，等待支付确认。
            </p>
          ) : null}
        </aside>
      </form>
    </div>
  )
}
