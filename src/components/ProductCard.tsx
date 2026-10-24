export interface Product {
  id: string
  name: string
  priceCents: number
  stock: number
  tags: string[]
  /** 面向 agent 的结构化卖点，供 LLM 直接消费 */
  agentNotes: string
}

interface Props {
  product: Product
  onAdd: (id: string) => void
}

/** 单文件商品卡片：0 库存展示「已售罄」并禁用加购按钮。 */
export function ProductCard({ product, onAdd }: Props) {
  const soldOut = product.stock === 0

  return (
    <article className="card" data-sku={product.id}>
      <h3>{product.name}</h3>
      <p className="price">¥{(product.priceCents / 100).toFixed(2)}</p>
      <p className="tags">{product.tags.join(' · ')}</p>
      <p className="notes">{product.agentNotes}</p>
      <button type="button" onClick={() => onAdd(product.id)} disabled={soldOut}>
        {soldOut ? '已售罄' : `加入购物车（余 ${product.stock}）`}
      </button>
    </article>
  )
}
