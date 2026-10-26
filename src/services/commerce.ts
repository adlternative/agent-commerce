import { createHash } from 'node:crypto'
import type { CommerceRepository } from '../repo/types.js'
import { DomainError } from '../domain/errors.js'
import { newId } from '../domain/ids.js'
import {
  makeIdempotencyRecord,
  requireIdempotencyKey,
  resolveIdempotency,
} from '../domain/idempotency.js'
import {
  UpsertProductInputSchema,
  parseProduct,
  searchProducts,
  type Product,
  type UpsertProductInput,
} from '../domain/product.js'
import {
  adjustOnHand,
  availableQty,
  commitStock,
  releaseStock,
  reserveStock,
  type Reservation,
  type StockLevel,
} from '../domain/inventory.js'
import {
  addCartItem,
  applyPromotionCode,
  createEmptyCart,
  quoteCart,
  removeCartItem,
  updateCartItem,
  type Cart,
} from '../domain/cart.js'
import {
  requirePromotion,
  type Promotion,
  type CartQuote,
} from '../domain/promotion.js'
import {
  createOrderFromQuote,
  transitionOrder,
  type Order,
} from '../domain/order.js'
import { capturePayment, createPendingPayment, type Payment } from '../domain/payment.js'
import {
  completeReturnRefund,
  createReturnRequest,
  type ReturnRequest,
} from '../domain/return.js'

function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)
}

function findProduct(products: Product[], id: string): Product {
  const p = products.find((x) => x.id === id)
  if (!p) throw new DomainError('PRODUCT_NOT_FOUND', `product ${id} not found`)
  return p
}

function findStock(stock: StockLevel[], productId: string): StockLevel {
  const s = stock.find((x) => x.productId === productId)
  if (!s) throw new DomainError('STOCK_NOT_FOUND', `no stock for product ${productId}`)
  return s
}

function upsertStock(stock: StockLevel[], next: StockLevel): void {
  const i = stock.findIndex((x) => x.productId === next.productId)
  if (i >= 0) stock[i] = next
  else stock.push(next)
}

export class CommerceService {
  constructor(private readonly repo: CommerceRepository) {}

  async listProducts(
    query: { q?: string; tag?: string; activeOnly?: boolean } = {},
  ): Promise<Product[]> {
    const db = await this.repo.read()
    return searchProducts(db.products, {
      ...query,
      activeOnly: query.activeOnly !== false,
    })
  }

  async getMetrics(): Promise<{
    gmvCents: number
    orderCount: number
    paidOrderCount: number
    outOfStockCount: number
  }> {
    const db = await this.repo.read()
    const counted = db.orders.filter((o) =>
      o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered',
    )
    const gmvCents = counted.reduce((sum, o) => sum + o.totalCents, 0)
    const outOfStockCount = db.stock.filter((s) => availableQty(s) <= 0).length
    return {
      gmvCents,
      orderCount: db.orders.length,
      paidOrderCount: counted.length,
      outOfStockCount,
    }
  }

  async getProduct(id: string): Promise<Product> {
    const db = await this.repo.read()
    return findProduct(db.products, id)
  }

  async checkInventory(productId: string): Promise<StockLevel & { available: number }> {
    const db = await this.repo.read()
    findProduct(db.products, productId)
    const stock = findStock(db.stock, productId)
    return { ...stock, available: availableQty(stock) }
  }

  async upsertProduct(
    input: UpsertProductInput,
    idempotencyKey: string,
  ): Promise<Product> {
    const key = requireIdempotencyKey(idempotencyKey)
    const parsed = UpsertProductInputSchema.parse(input)
    const requestHash = hashRequest(parsed)

    return this.repo.transaction((db) => {
      const scope = 'upsert_product'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return findProduct(db.products, resolved.resourceId)
      }

      const now = new Date().toISOString()
      const bySku = db.products.find((p) => p.sku === parsed.sku)
      let product: Product

      if (parsed.id || bySku) {
        const target = parsed.id
          ? findProduct(db.products, parsed.id)
          : bySku!
        product = parseProduct({
          ...target,
          ...parsed,
          id: target.id,
          updatedAt: now,
        })
        const idx = db.products.findIndex((p) => p.id === product.id)
        db.products[idx] = product
      } else {
        product = parseProduct({
          id: newId('prod'),
          sku: parsed.sku,
          name: parsed.name,
          description: parsed.description ?? '',
          priceCents: parsed.priceCents,
          tags: parsed.tags ?? [],
          agentNotes: parsed.agentNotes ?? '',
          active: parsed.active ?? true,
          createdAt: now,
          updatedAt: now,
        })
        db.products.push(product)
        db.stock.push({ productId: product.id, onHand: 0, reserved: 0 })
      }

      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: product.id,
          requestHash,
        }),
      )
      return product
    })
  }

  async adjustStock(
    productId: string,
    delta: number,
    idempotencyKey: string,
  ): Promise<StockLevel & { available: number }> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ productId, delta })

    return this.repo.transaction((db) => {
      const scope = 'adjust_stock'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const stock = findStock(db.stock, resolved.resourceId)
        return { ...stock, available: availableQty(stock) }
      }

      findProduct(db.products, productId)
      const stock = findStock(db.stock, productId)
      const next = adjustOnHand(stock, delta)
      upsertStock(db.stock, next)
      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: productId,
          requestHash,
        }),
      )
      return { ...next, available: availableQty(next) }
    })
  }

  async createCart(customerId: string, idempotencyKey: string): Promise<Cart> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ customerId })

    return this.repo.transaction((db) => {
      const scope = 'create_cart'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const cart = db.carts.find((c) => c.id === resolved.resourceId)
        if (!cart) throw new DomainError('CART_NOT_FOUND', 'idempotent cart missing')
        return cart
      }
      const cart = createEmptyCart(newId('cart'), customerId)
      db.carts.push(cart)
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: cart.id, requestHash }),
      )
      return cart
    })
  }

  async getCart(cartId: string): Promise<Cart> {
    const db = await this.repo.read()
    const cart = db.carts.find((c) => c.id === cartId)
    if (!cart) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
    return cart
  }

  async addItem(
    cartId: string,
    productId: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<Cart> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ cartId, productId, quantity })

    return this.repo.transaction((db) => {
      const scope = 'add_cart_item'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const cart = db.carts.find((c) => c.id === resolved.resourceId)
        if (!cart) throw new DomainError('CART_NOT_FOUND', 'idempotent cart missing')
        return cart
      }

      const idx = db.carts.findIndex((c) => c.id === cartId)
      if (idx < 0) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
      const product = findProduct(db.products, productId)
      if (!product.active) {
        throw new DomainError('PRODUCT_INACTIVE', `product ${productId} is inactive`)
      }
      const stock = findStock(db.stock, productId)
      const cart = addCartItem(
        db.carts[idx]!,
        productId,
        quantity,
        product.priceCents,
        availableQty(stock),
      )
      db.carts[idx] = cart
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: cart.id, requestHash }),
      )
      return cart
    })
  }

  async updateItem(
    cartId: string,
    productId: string,
    quantity: number,
    idempotencyKey: string,
  ): Promise<Cart> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ cartId, productId, quantity })

    return this.repo.transaction((db) => {
      const scope = 'update_cart_item'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.carts.find((c) => c.id === resolved.resourceId)!
      }
      const idx = db.carts.findIndex((c) => c.id === cartId)
      if (idx < 0) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
      const stock = findStock(db.stock, productId)
      const cart = updateCartItem(db.carts[idx]!, productId, quantity, availableQty(stock))
      db.carts[idx] = cart
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: cart.id, requestHash }),
      )
      return cart
    })
  }

  async removeItem(
    cartId: string,
    productId: string,
    idempotencyKey: string,
  ): Promise<Cart> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ cartId, productId })

    return this.repo.transaction((db) => {
      const scope = 'remove_cart_item'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.carts.find((c) => c.id === resolved.resourceId)!
      }
      const idx = db.carts.findIndex((c) => c.id === cartId)
      if (idx < 0) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
      const cart = removeCartItem(db.carts[idx]!, productId)
      db.carts[idx] = cart
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: cart.id, requestHash }),
      )
      return cart
    })
  }

  async applyPromotion(
    cartId: string,
    code: string,
    idempotencyKey: string,
  ): Promise<Cart> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ cartId, code })

    return this.repo.transaction((db) => {
      const scope = 'apply_promotion'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.carts.find((c) => c.id === resolved.resourceId)!
      }
      requirePromotion(db.promotions, code)
      const idx = db.carts.findIndex((c) => c.id === cartId)
      if (idx < 0) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
      const cart = applyPromotionCode(db.carts[idx]!, code)
      db.carts[idx] = cart
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: cart.id, requestHash }),
      )
      return cart
    })
  }

  async quoteCart(cartId: string): Promise<CartQuote> {
    const db = await this.repo.read()
    const cart = db.carts.find((c) => c.id === cartId)
    if (!cart) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
    const promo = cart.promotionCode
      ? requirePromotion(db.promotions, cart.promotionCode)
      : undefined
    return quoteCart(cart, promo)
  }

  async upsertPromotion(promo: Promotion, idempotencyKey: string): Promise<Promotion> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest(promo)

    return this.repo.transaction((db) => {
      const scope = 'upsert_promotion'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.promotions.find((p) => p.code === resolved.resourceId)!
      }
      const idx = db.promotions.findIndex(
        (p) => p.code.toUpperCase() === promo.code.toUpperCase(),
      )
      if (idx >= 0) db.promotions[idx] = promo
      else db.promotions.push(promo)
      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: promo.code,
          requestHash,
        }),
      )
      return promo
    })
  }

  /**
   * Place order: reserve stock for every line, create order (status=created).
   * Idempotent on Idempotency-Key.
   */
  async placeOrder(
    cartId: string,
    idempotencyKey: string,
  ): Promise<Order> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ cartId })

    return this.repo.transaction((db) => {
      const scope = 'place_order'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const order = db.orders.find((o) => o.id === resolved.resourceId)
        if (!order) throw new DomainError('ORDER_NOT_FOUND', 'idempotent order missing')
        return order
      }

      const cart = db.carts.find((c) => c.id === cartId)
      if (!cart) throw new DomainError('CART_NOT_FOUND', `cart ${cartId} not found`)
      if (cart.items.length === 0) {
        throw new DomainError('EMPTY_CART', 'cannot place order with empty cart')
      }

      const promo = cart.promotionCode
        ? requirePromotion(db.promotions, cart.promotionCode)
        : undefined
      const quote = quoteCart(cart, promo)

      // Reserve stock for all lines; roll back on failure.
      const reservationIds: string[] = []
      const reservedSnapshots: { productId: string; quantity: number }[] = []
      try {
        for (const line of quote.lines) {
          const stock = findStock(db.stock, line.productId)
          const { stock: next } = reserveStock(stock, line.quantity)
          upsertStock(db.stock, next)
          const reservation: Reservation = {
            id: newId('rsv'),
            productId: line.productId,
            quantity: line.quantity,
            status: 'created',
            createdAt: new Date().toISOString(),
          }
          db.reservations.push(reservation)
          reservationIds.push(reservation.id)
          reservedSnapshots.push({ productId: line.productId, quantity: line.quantity })
        }
      } catch (err) {
        for (const snap of reservedSnapshots) {
          const stock = findStock(db.stock, snap.productId)
          upsertStock(db.stock, releaseStock(stock, snap.quantity))
        }
        for (const id of reservationIds) {
          const r = db.reservations.find((x) => x.id === id)
          if (r) r.status = 'released'
        }
        throw err
      }

      const order = createOrderFromQuote({
        id: newId('ord'),
        customerId: cart.customerId,
        cartId: cart.id,
        quote,
        reservationIds,
        idempotencyKey: key,
      })
      db.orders.push(order)
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: order.id, requestHash }),
      )
      return order
    })
  }

  async getOrder(orderId: string): Promise<Order> {
    const db = await this.repo.read()
    const order = db.orders.find((o) => o.id === orderId)
    if (!order) throw new DomainError('ORDER_NOT_FOUND', `order ${orderId} not found`)
    return order
  }

  async listOrders(filter: { customerId?: string; status?: Order['status'] } = {}): Promise<Order[]> {
    const db = await this.repo.read()
    return db.orders.filter((o) => {
      if (filter.customerId && o.customerId !== filter.customerId) return false
      if (filter.status && o.status !== filter.status) return false
      return true
    })
  }

  async payOrder(orderId: string, idempotencyKey: string): Promise<{ order: Order; payment: Payment }> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ orderId })

    return this.repo.transaction((db) => {
      const scope = 'pay_order'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const payment = db.payments.find((p) => p.id === resolved.resourceId)!
        const order = db.orders.find((o) => o.id === payment.orderId)!
        return { order, payment }
      }

      const orderIdx = db.orders.findIndex((o) => o.id === orderId)
      if (orderIdx < 0) throw new DomainError('ORDER_NOT_FOUND', `order ${orderId} not found`)
      let order = db.orders[orderIdx]!

      const payment = createPendingPayment({
        id: newId('pay'),
        orderId: order.id,
        amountCents: order.totalCents,
        idempotencyKey: key,
      })
      const captured = capturePayment(payment, order)
      order = captured.order

      // Commit reservations → deduct onHand.
      for (const rsvId of order.reservationIds) {
        const rsv = db.reservations.find((r) => r.id === rsvId)
        if (!rsv || rsv.status !== 'created') continue
        const stock = findStock(db.stock, rsv.productId)
        upsertStock(db.stock, commitStock(stock, rsv.quantity))
        rsv.status = 'committed'
      }

      db.orders[orderIdx] = order
      db.payments.push(captured.payment)
      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: captured.payment.id,
          requestHash,
        }),
      )
      return { order, payment: captured.payment }
    })
  }

  async shipOrder(orderId: string, idempotencyKey: string): Promise<Order> {
    return this.transitionWithIdempotency(orderId, 'shipped', 'ship_order', idempotencyKey)
  }

  async deliverOrder(orderId: string, idempotencyKey: string): Promise<Order> {
    return this.transitionWithIdempotency(orderId, 'delivered', 'deliver_order', idempotencyKey)
  }

  async cancelOrder(orderId: string, idempotencyKey: string): Promise<Order> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ orderId, to: 'cancelled' })

    return this.repo.transaction((db) => {
      const scope = 'cancel_order'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.orders.find((o) => o.id === resolved.resourceId)!
      }

      const idx = db.orders.findIndex((o) => o.id === orderId)
      if (idx < 0) throw new DomainError('ORDER_NOT_FOUND', `order ${orderId} not found`)
      const order = db.orders[idx]!

      if (order.status === 'paid') {
        // Restock committed inventory.
        for (const line of order.lines) {
          const stock = findStock(db.stock, line.productId)
          upsertStock(db.stock, adjustOnHand(stock, line.quantity))
        }
      } else if (order.status === 'created') {
        for (const rsvId of order.reservationIds) {
          const rsv = db.reservations.find((r) => r.id === rsvId)
          if (!rsv || rsv.status !== 'created') continue
          const stock = findStock(db.stock, rsv.productId)
          upsertStock(db.stock, releaseStock(stock, rsv.quantity))
          rsv.status = 'released'
        }
      }

      const next = transitionOrder(order, 'cancelled')
      db.orders[idx] = next
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: next.id, requestHash }),
      )
      return next
    })
  }

  async requestReturn(
    orderId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<{ return: ReturnRequest; order: Order; payment: Payment }> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ orderId, reason })

    return this.repo.transaction((db) => {
      const scope = 'request_return'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const ret = db.returns.find((r) => r.id === resolved.resourceId)!
        const order = db.orders.find((o) => o.id === ret.orderId)!
        const payment = db.payments.find((p) => p.orderId === order.id && p.status !== 'failed')!
        return { return: ret, order, payment }
      }

      const orderIdx = db.orders.findIndex((o) => o.id === orderId)
      if (orderIdx < 0) throw new DomainError('ORDER_NOT_FOUND', `order ${orderId} not found`)
      let order = db.orders[orderIdx]!
      const payment = db.payments.find((p) => p.orderId === order.id && p.status === 'captured')
      if (!payment) {
        throw new DomainError('PAYMENT_NOT_FOUND', 'no captured payment for order')
      }

      let ret = createReturnRequest({
        id: newId('ret'),
        order,
        reason,
        idempotencyKey: key,
      })
      // Auto-approve + refund for the simplified commerce core.
      ret = { ...ret, status: 'approved', updatedAt: new Date().toISOString() }
      const completed = completeReturnRefund(ret, order, payment)

      // Restock.
      for (const line of order.lines) {
        const stock = findStock(db.stock, line.productId)
        upsertStock(db.stock, adjustOnHand(stock, line.quantity))
      }

      db.orders[orderIdx] = completed.order
      const payIdx = db.payments.findIndex((p) => p.id === payment.id)
      db.payments[payIdx] = completed.payment
      db.returns.push(completed.return)
      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: completed.return.id,
          requestHash,
        }),
      )
      return completed
    })
  }

  private async transitionWithIdempotency(
    orderId: string,
    to: Order['status'],
    scope: string,
    idempotencyKey: string,
  ): Promise<Order> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ orderId, to })

    return this.repo.transaction((db) => {
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.orders.find((o) => o.id === resolved.resourceId)!
      }
      const idx = db.orders.findIndex((o) => o.id === orderId)
      if (idx < 0) throw new DomainError('ORDER_NOT_FOUND', `order ${orderId} not found`)
      const next = transitionOrder(db.orders[idx]!, to)
      db.orders[idx] = next
      db.idempotency.push(
        makeIdempotencyRecord({ key, scope, resourceId: next.id, requestHash }),
      )
      return next
    })
  }
}
