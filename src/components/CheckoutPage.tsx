import { FormEvent, useState } from 'react'

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
  totalFen: number
}

type Props = {
  lines: CheckoutLine[]
  totals: CheckoutTotals
  onPlaceOrder?: (payload: {
    name: string
    phone: string
    address: string
  }) => void
}

function formatYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`
}

export default function CheckoutPage({ lines, totals, onPlaceOrder }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onPlaceOrder?.({ name, phone, address })
    setSubmitted(true)
  }

  return (
    <section className="checkout" aria-labelledby="checkout-title">
      <header className="checkout__brand">
        <p className="checkout__wordmark">Agent Commerce</p>
        <h1 id="checkout-title">结算</h1>
        <p className="checkout__lede">确认订单与收货信息后提交。</p>
      </header>

      <div className="checkout__layout">
        <form className="checkout__form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>收货信息</legend>
            <label>
              姓名
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="收件人姓名"
              />
            </label>
            <label>
              手机
              <input
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="11 位手机号"
                pattern="[0-9]{11}"
              />
            </label>
            <label>
              地址
              <textarea
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                rows={3}
                autoComplete="street-address"
                placeholder="省市区与详细地址"
              />
            </label>
          </fieldset>

          <button type="submit" className="checkout__submit" disabled={lines.length === 0}>
            提交订单 · {formatYuan(totals.totalFen)}
          </button>

          {submitted && (
            <p className="checkout__success" role="status">
              订单已提交（演示）。金额 {formatYuan(totals.totalFen)}。
            </p>
          )}
        </form>

        <aside className="checkout__summary" aria-label="订单摘要">
          <h2>订单摘要</h2>
          <ul className="checkout__lines">
            {lines.map((line) => (
              <li key={line.sku}>
                <div>
                  <strong>{line.name}</strong>
                  <span className="checkout__sku">
                    {line.sku} × {line.qty}
                  </span>
                </div>
                <span>{formatYuan(line.unitPriceFen * line.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="checkout__totals">
            <div>
              <dt>小计</dt>
              <dd>{formatYuan(totals.subtotalFen)}</dd>
            </div>
            <div>
              <dt>满减</dt>
              <dd>−{formatYuan(totals.discountFen)}</dd>
            </div>
            <div>
              <dt>运费</dt>
              <dd>{totals.shippingFen === 0 ? '包邮' : formatYuan(totals.shippingFen)}</dd>
            </div>
            <div className="checkout__grand">
              <dt>应付</dt>
              <dd>{formatYuan(totals.totalFen)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
