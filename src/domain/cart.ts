import { z } from 'zod'
import { CentsSchema, type Cents } from './money.js'
import { DomainError } from './errors.js'
import {
  applyPromotionToQuote,
  lineTotal,
  type CartQuote,
  type Promotion,
} from './promotion.js'

export const CartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: CentsSchema,
})

export type CartItem = z.infer<typeof CartItemSchema>

export const CartSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  items: z.array(CartItemSchema),
  promotionCode: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Cart = z.infer<typeof CartSchema>

export function createEmptyCart(id: string, customerId: string, now = new Date()): Cart {
  const iso = now.toISOString()
  return {
    id,
    customerId,
    items: [],
    createdAt: iso,
    updatedAt: iso,
  }
}

/** Immutable add/increase. Does not check stock — caller must. */
export function addCartItem(
  cart: Cart,
  productId: string,
  quantity: number,
  unitPriceCents: Cents,
  maxAvailable?: number,
): Cart {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', 'add quantity must be a positive integer')
  }
  const existing = cart.items.find((i) => i.productId === productId)
  const nextQty = (existing?.quantity ?? 0) + quantity
  if (maxAvailable !== undefined && nextQty > maxAvailable) {
    throw new DomainError('INSUFFICIENT_STOCK', 'cart quantity exceeds available stock', {
      hint: `productId=${productId} requested=${nextQty} available=${maxAvailable}`,
    })
  }
  const items = existing
    ? cart.items.map((i) =>
        i.productId === productId ? { ...i, quantity: nextQty, unitPriceCents } : i,
      )
    : [...cart.items, { productId, quantity, unitPriceCents }]
  return { ...cart, items, updatedAt: new Date().toISOString() }
}

export function updateCartItem(
  cart: Cart,
  productId: string,
  quantity: number,
  maxAvailable?: number,
): Cart {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DomainError('INVALID_QUANTITY', 'update quantity must be a non-negative integer')
  }
  const existing = cart.items.find((i) => i.productId === productId)
  if (!existing) {
    throw new DomainError('CART_ITEM_NOT_FOUND', `item ${productId} not in cart`)
  }
  if (quantity === 0) {
    return removeCartItem(cart, productId)
  }
  if (maxAvailable !== undefined && quantity > maxAvailable) {
    throw new DomainError('INSUFFICIENT_STOCK', 'cart quantity exceeds available stock', {
      hint: `productId=${productId} requested=${quantity} available=${maxAvailable}`,
    })
  }
  return {
    ...cart,
    items: cart.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    updatedAt: new Date().toISOString(),
  }
}

export function removeCartItem(cart: Cart, productId: string): Cart {
  if (!cart.items.some((i) => i.productId === productId)) {
    throw new DomainError('CART_ITEM_NOT_FOUND', `item ${productId} not in cart`)
  }
  return {
    ...cart,
    items: cart.items.filter((i) => i.productId !== productId),
    updatedAt: new Date().toISOString(),
  }
}

export function applyPromotionCode(cart: Cart, code: string): Cart {
  return {
    ...cart,
    promotionCode: code,
    updatedAt: new Date().toISOString(),
  }
}

export function clearPromotionCode(cart: Cart): Cart {
  const { promotionCode: _removed, ...rest } = cart
  return { ...rest, updatedAt: new Date().toISOString() }
}

export function quoteCart(cart: Cart, promo: Promotion | undefined): CartQuote {
  const lines = cart.items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    lineTotalCents: lineTotal(i.unitPriceCents, i.quantity),
  }))
  return applyPromotionToQuote(lines, promo)
}
