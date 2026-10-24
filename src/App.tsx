import { useMemo, useState } from 'react'
import { CartPanel } from './components/CartPanel'
import { ProductCard } from './components/ProductCard'
import { addToCart, checkStock, removeFromCart, subtotalCents, type CartLine } from './lib/cart'
import { catalog } from './lib/catalog'
import { totalCents as computeTotal } from './lib/pricing'

export default function App() {
  const [lines, setLines] = useState<CartLine[]>([])
  const [isMember, setIsMember] = useState(false)
  const [message, setMessage] = useState<string>('')

  const subtotal = useMemo(() => subtotalCents(lines, catalog), [lines])
  const total = useMemo(() => computeTotal(subtotal, isMember), [subtotal, isMember])

  function handleAdd(id: string) {
    setLines((prev) => addToCart(prev, catalog, id))
    setMessage('')
  }

  function handleCheckout() {
    const shortages = checkStock(lines, catalog)
    if (shortages.length > 0) {
      setMessage(`库存不足：${shortages.map((s) => `${s.productId} 需 ${s.requested} 仅 ${s.available}`).join('；')}`)
      return
    }
    setMessage(`下单成功，应付 ¥${(total / 100).toFixed(2)}`)
    setLines([])
  }

  return (
    <main>
      <header>
        <h1>Agent Commerce</h1>
        <p>为 Agent 设计的网购平台：结构化商品数据 + 确定性定价。</p>
        <label>
          <input type="checkbox" checked={isMember} onChange={(e) => setIsMember(e.target.checked)} />
          会员价
        </label>
      </header>
      <section className="grid">
        {catalog.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={handleAdd} />
        ))}
      </section>
      <CartPanel
        lines={lines}
        catalog={catalog}
        subtotalCents={subtotal}
        totalCents={total}
        onRemove={(id) => setLines((prev) => removeFromCart(prev, id))}
        onCheckout={handleCheckout}
      />
      {message && <p role="status">{message}</p>}
    </main>
  )
}
