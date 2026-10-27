export type Product = {
  id: string
  sku: string
  name: string
  description: string
  priceCents: number
  tags: string[]
  agentNotes: string
  active: boolean
  /** Units on hand — present on merchant product list. */
  onHand?: number
  /** Units reserved — present on merchant product list. */
  reserved?: number
  /** Sellable units on list responses (onHand − reserved). */
  available?: number
}

export type Cart = {
  id: string
  customerId: string
  items: { productId: string; quantity: number; unitPriceCents: number }[]
  promotionCode?: string
}

export type CartQuote = {
  subtotalCents: number
  discountCents: number
  totalCents: number
  promotionCode?: string
  lines: {
    productId: string
    quantity: number
    unitPriceCents: number
    lineTotalCents: number
  }[]
}

export type Order = {
  id: string
  status: string
  totalCents: number
  subtotalCents: number
  discountCents: number
  lines: { productId: string; quantity: number; unitPriceCents: number; lineTotalCents?: number }[]
  promotionCode?: string
}

export type ReturnLine = {
  productId: string
  quantity: number
}

export type ReturnRequest = {
  id: string
  orderId: string
  reason: string
  lines: ReturnLine[]
  amountCents: number
  status: string
}

export type Stock = {
  productId: string
  onHand: number
  reserved: number
  available: number
}
