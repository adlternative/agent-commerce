import type { Product } from '../lib/cart'

interface Props {
  product: Product
  onAdd: (id: string) => void
}

export function ProductCard({ product, onAdd }: Props) {
  return (
    <article className="card" data-sku={product.id}>
      <h3>{product.name}</h3>
      <p className="price">¥{(product.priceCents / 100).toFixed(2)}</p>
      <p className="tags">{product.tags.join(' · ')}</p>
      <p className="notes">{product.agentNotes}</p>
      <button onClick={() => onAdd(product.id)} disabled={product.stock === 0}>
        {product.stock === 0 ? '已售罄' : `加入购物车（余 ${product.stock}）`}
      </button>
    </article>
  )
}
