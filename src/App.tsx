import { useEffect, useState } from 'react'
import CheckoutPage from './components/CheckoutPage'
import { DEMO_CHECKOUT_LINES, demoCheckoutTotals } from './checkoutDemo'

function readHashPath(): string {
  if (typeof window === 'undefined') return '/'
  const raw = window.location.hash.replace(/^#/, '')
  return raw || '/'
}

export default function App() {
  const [path, setPath] = useState(readHashPath)

  useEffect(() => {
    const onHash = () => setPath(readHashPath())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const isCheckout = path === '/checkout' || path === 'checkout'

  if (isCheckout) {
    const lines = DEMO_CHECKOUT_LINES
    const totals = demoCheckoutTotals(lines)
    return (
      <main>
        <CheckoutPage lines={lines} totals={totals} />
      </main>
    )
  }

  return (
    <main className="home">
      <h1>Agent Commerce</h1>
      <p>骨架仓库：功能由 Cursor Cloud Agents 在并发任务中实现。</p>
      <p>
        <a href="#/checkout">进入结算页</a>
      </p>
    </main>
  )
}
