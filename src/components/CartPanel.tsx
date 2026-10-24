import type { CartLine, Product } from '../lib/cart'

interface Props {
  lines: CartLine[]
  catalog: Product[]
  subtotalCents: number
  totalCents: number
  onRemove: (id: string) => void
  onCheckout: () => void
}

export function CartPanel({ lines, catalog, subtotalCents, totalCents, onRemove, onCheckout }: Props) {
  return (
    <aside className="cart">
      <h2>购物车</h2>
      {lines.length === 0 && <p className="empty">空空如也</p>}
      <ul>
        {lines.map((line) => {
          const product = catalog.find((p) => p.id === line.productId)
          return (
            <li key={line.productId}>
              <span>{product?.name ?? line.productId} × {line.qty}</span>
              <button onClick={() => onRemove(line.productId)}>移除</button>
            </li>
          )
        })}
      </ul>
      <dl>
        <dt>小计</dt>
        <dd>¥{(subtotalCents / 100).toFixed(2)}</dd>
        <dt>应付</dt>
        <dd data-testid="total">¥{(totalCents / 100).toFixed(2)}</dd>
      </dl>
      <button onClick={onCheckout} disabled={lines.length === 0}>结算</button>
    </aside>
  )
}
