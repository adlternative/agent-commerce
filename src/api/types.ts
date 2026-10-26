export type Product = {
  id: string
  sku: string
  name: string
  description: string
  priceCents: number
  tags: string[]
  agentNotes: string
  active: boolean
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
  lines: { productId: string; quantity: number; unitPriceCents: number }[]
  promotionCode?: string
}

export type Stock = {
  productId: string
  onHand: number
  reserved: number
  available: number
}
