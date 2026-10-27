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
  parseProduct,
  parseUpsertProductInput,
  searchProducts,
  type Product,
  type UpsertProductInput,
} from '../domain/product.js'
import { rankProducts, type ScoredProduct } from '../domain/search.js'
import {
  adjustOnHand,
  availableQty,
  batchAvailableByProductIds,
  batchStockByProductIds,
  commitStock,
  createReservation,
  isReservationExpired,
  releaseStock,
  reserveStock,
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
import {
  capturePayment,
  createPendingPayment,
  markPaymentFailed,
  PaymentWebhookEventSchema,
  type Payment,
  type PaymentWebhookEvent,
} from '../domain/payment.js'
import {
  approveReturn as domainApproveReturn,
  completeReturnRefund,
  createReturnRequest,
  rejectReturn as domainRejectReturn,
  type ReturnLine,
  type ReturnRequest,
} from '../domain/return.js'

/** Catalog product with sellable qty (onHand − reserved). */
export type ProductWithAvailability = Product & { available: number }

/** Merchant catalog row with full inventory snapshot. */
export type ProductWithStock = Product & {
  onHand: number
  reserved: number
  available: number
}

export type ScoredProductWithAvailability = {
  product: ProductWithAvailability
  score: number
}

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

  /**
   * Merchant product list with onHand/reserved/available on each item.
   * Stock via `getStockByProductIds` (SQLite: `WHERE product_id IN (...)` —
   * one statement for the whole list, not N+1 inventory GETs).
   */
  async listProductsWithStock(
    query: { q?: string; tag?: string; activeOnly?: boolean } = {},
  ): Promise<ProductWithStock[]> {
    const db = await this.repo.read()
    const products = searchProducts(db.products, {
      ...query,
      activeOnly: query.activeOnly !== false,
    })
    const ids = products.map((p) => p.id)
    const stockRows = await this.repo.getStockByProductIds(ids)
    const byId = batchStockByProductIds(stockRows, ids)
    return products.map((p) => {
      const snap = byId.get(p.id)!
      return {
        ...p,
        onHand: snap.onHand,
        reserved: snap.reserved,
        available: snap.available,
      }
    })
  }

  /** Ranked catalog search (FTS + Chinese fallback). Used for stable keyset pagination. */
  async rankProducts(
    query: { q?: string; tag?: string; activeOnly?: boolean } = {},
  ): Promise<ScoredProduct[]> {
    const db = await this.repo.read()
    return rankProducts(db.products, {
      ...query,
      activeOnly: query.activeOnly !== false,
    })
  }

  /**
   * Ranked catalog with batch `available` on each item (no per-product inventory round-trip).
   * Products from one `repo.read()`; stock via `getStockByProductIds` (SQLite:
   * `WHERE product_id IN (...)` — one statement for the whole list, not N+1).
   * Listing ~50 products → products read + one stock IN query (2 SQL-level lookups).
   */
  async rankProductsWithAvailability(
    query: { q?: string; tag?: string; activeOnly?: boolean } = {},
  ): Promise<ScoredProductWithAvailability[]> {
    const db = await this.repo.read()
    const ranked = rankProducts(db.products, {
      ...query,
      activeOnly: query.activeOnly !== false,
    })
    const ids = ranked.map((h) => h.product.id)
    const stockRows = await this.repo.getStockByProductIds(ids)
    const avail = batchAvailableByProductIds(stockRows, ids)
    return ranked.map((h) => ({
      score: h.score,
      product: {
        ...h.product,
        available: avail.get(h.product.id) ?? 0,
      },
    }))
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
  ): Promise<Product & StockLevel & { available: number }> {
    const key = requireIdempotencyKey(idempotencyKey)
    const parsed = parseUpsertProductInput(input)
    const requestHash = hashRequest(parsed)

    return this.repo.transaction((db) => {
      const scope = 'upsert_product'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const product = findProduct(db.products, resolved.resourceId)
        const stock = findStock(db.stock, product.id)
        return { ...product, ...stock, available: availableQty(stock) }
      }

      const now = new Date().toISOString()
      const bySku = db.products.find((p) => p.sku === parsed.sku)
      let product: Product
      // Exclude stock from product field merge — inventory is applied separately.
      const { stock: initialStock, ...productFields } = parsed

      if (parsed.id || bySku) {
        const target = parsed.id
          ? findProduct(db.products, parsed.id)
          : bySku!
        product = parseProduct({
          ...target,
          ...productFields,
          id: target.id,
          updatedAt: now,
        })
        const idx = db.products.findIndex((p) => p.id === product.id)
        db.products[idx] = product
        if (initialStock !== undefined) {
          const current = findStock(db.stock, product.id)
          if (initialStock < current.reserved) {
            throw new DomainError('INVALID_ADJUSTMENT', 'onHand cannot fall below reserved', {
              hint: `onHand would be ${initialStock}, reserved=${current.reserved}`,
            })
          }
          upsertStock(db.stock, {
            productId: product.id,
            onHand: initialStock,
            reserved: current.reserved,
          })
        }
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
        db.stock.push({
          productId: product.id,
          onHand: initialStock ?? 0,
          reserved: 0,
        })
      }

      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: product.id,
          requestHash,
        }),
      )
      const stock = findStock(db.stock, product.id)
      return { ...product, ...stock, available: availableQty(stock) }
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

  async listPromotions(): Promise<Promotion[]> {
    const db = await this.repo.read()
    return [...db.promotions]
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
      const holdNow = new Date()
      try {
        for (const line of quote.lines) {
          const stock = findStock(db.stock, line.productId)
          const { stock: next } = reserveStock(stock, line.quantity)
          upsertStock(db.stock, next)
          const reservation = createReservation({
            id: newId('rsv'),
            productId: line.productId,
            quantity: line.quantity,
            now: holdNow,
          })
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

  /**
   * Customer/merchant confirm goods received (shipped → delivered).
   * Same transition as deliverOrder; separate idempotency scope for the receive verb.
   */
  async receiveOrder(orderId: string, idempotencyKey: string): Promise<Order> {
    return this.transitionWithIdempotency(orderId, 'delivered', 'receive_order', idempotencyKey)
  }

  /**
   * Payment-provider webhook: idempotent on eventId.
   * - payment.captured → capture + commit stock (same effect as payOrder)
   * - payment.failed → record failed payment; order stays created
   */
  async handlePaymentWebhook(
    event: PaymentWebhookEvent,
  ): Promise<{ order: Order; payment: Payment; replayed: boolean }> {
    const parsed = PaymentWebhookEventSchema.parse(event)
    const key = parsed.eventId
    const requestHash = hashRequest({
      type: parsed.type,
      orderId: parsed.orderId,
      amountCents: parsed.amountCents ?? null,
    })

    return this.repo.transaction((db) => {
      const scope = 'payment_webhook'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const payment = db.payments.find((p) => p.id === resolved.resourceId)
        if (!payment) {
          throw new DomainError('PAYMENT_NOT_FOUND', 'idempotent webhook payment missing')
        }
        const order = db.orders.find((o) => o.id === payment.orderId)
        if (!order) throw new DomainError('ORDER_NOT_FOUND', 'idempotent webhook order missing')
        return { order, payment, replayed: true }
      }

      const orderIdx = db.orders.findIndex((o) => o.id === parsed.orderId)
      if (orderIdx < 0) {
        throw new DomainError('ORDER_NOT_FOUND', `order ${parsed.orderId} not found`)
      }
      let order = db.orders[orderIdx]!

      if (parsed.type === 'payment.failed') {
        if (order.status !== 'created') {
          throw new DomainError(
            'ORDER_NOT_PAYABLE',
            `cannot fail payment for order status ${order.status}`,
          )
        }
        const amountCents = parsed.amountCents ?? order.totalCents
        const pending = createPendingPayment({
          id: newId('pay'),
          orderId: order.id,
          amountCents,
          idempotencyKey: key,
          webhookEventId: parsed.eventId,
        })
        const failed = markPaymentFailed(pending)
        db.payments.push(failed)
        db.idempotency.push(
          makeIdempotencyRecord({
            key,
            scope,
            resourceId: failed.id,
            requestHash,
          }),
        )
        return { order, payment: failed, replayed: false }
      }

      // payment.captured
      if (parsed.amountCents !== undefined && parsed.amountCents !== order.totalCents) {
        throw new DomainError('PAYMENT_AMOUNT_MISMATCH', 'webhook amount must equal order total', {
          hint: `payment=${parsed.amountCents} order=${order.totalCents}`,
        })
      }

      const payment = createPendingPayment({
        id: newId('pay'),
        orderId: order.id,
        amountCents: order.totalCents,
        idempotencyKey: key,
        webhookEventId: parsed.eventId,
      })
      const captured = capturePayment(payment, order)
      order = captured.order

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
      return { order, payment: captured.payment, replayed: false }
    })
  }

  /**
   * Release inventory holds whose expiresAt has passed, and cancel unpaid
   * orders that owned those holds. Safe to call repeatedly (cron / merchant).
   */
  async releaseExpiredReservations(
    now: Date = new Date(),
  ): Promise<{ releasedReservationIds: string[]; cancelledOrderIds: string[] }> {
    return this.repo.transaction((db) => {
      const expiredIds = new Set(
        db.reservations.filter((r) => isReservationExpired(r, now)).map((r) => r.id),
      )
      if (expiredIds.size === 0) {
        return { releasedReservationIds: [], cancelledOrderIds: [] }
      }

      const affectedOrderIds = new Set<string>()
      for (const order of db.orders) {
        if (order.status !== 'created') continue
        if (order.reservationIds.some((id) => expiredIds.has(id))) {
          affectedOrderIds.add(order.id)
        }
      }

      const releasedReservationIds: string[] = []
      const releaseOne = (rsvId: string) => {
        const rsv = db.reservations.find((r) => r.id === rsvId)
        if (!rsv || rsv.status !== 'created') return
        const stock = findStock(db.stock, rsv.productId)
        upsertStock(db.stock, releaseStock(stock, rsv.quantity))
        rsv.status = 'released'
        releasedReservationIds.push(rsv.id)
      }

      // Cancel unpaid orders that hit the hold timeout; release all their holds.
      const cancelledOrderIds: string[] = []
      for (const orderId of affectedOrderIds) {
        const idx = db.orders.findIndex((o) => o.id === orderId)
        if (idx < 0) continue
        const order = db.orders[idx]!
        for (const rsvId of order.reservationIds) {
          releaseOne(rsvId)
        }
        db.orders[idx] = transitionOrder(order, 'cancelled')
        cancelledOrderIds.push(orderId)
      }

      // Orphan expired holds (no created order) still release stock.
      for (const rsvId of expiredIds) {
        releaseOne(rsvId)
      }

      return { releasedReservationIds, cancelledOrderIds }
    })
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

  async listReturns(filter?: { status?: ReturnRequest['status']; orderId?: string }): Promise<ReturnRequest[]> {
    const db = await this.repo.read()
    return db.returns.filter((r) => {
      if (filter?.status && r.status !== filter.status) return false
      if (filter?.orderId && r.orderId !== filter.orderId) return false
      return true
    })
  }

  async getReturn(returnId: string): Promise<ReturnRequest> {
    const db = await this.repo.read()
    const ret = db.returns.find((r) => r.id === returnId)
    if (!ret) throw new DomainError('RETURN_NOT_FOUND', `return ${returnId} not found`)
    return ret
  }

  /**
   * Customer/agent requests a return. Leaves status=`requested` until merchant approve/reject.
   * Optional `lines` select quantities to return; omit for full-order return.
   */
  async requestReturn(
    orderId: string,
    reason: string,
    idempotencyKey: string,
    lines?: ReturnLine[],
  ): Promise<{ return: ReturnRequest; order: Order }> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ orderId, reason, lines: lines ?? null })

    return this.repo.transaction((db) => {
      const scope = 'request_return'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const ret = db.returns.find((r) => r.id === resolved.resourceId)!
        const order = db.orders.find((o) => o.id === ret.orderId)!
        return { return: ret, order }
      }

      const orderIdx = db.orders.findIndex((o) => o.id === orderId)
      if (orderIdx < 0) throw new DomainError('ORDER_NOT_FOUND', `order ${orderId} not found`)
      const order = db.orders[orderIdx]!
      const payment = db.payments.find((p) => p.orderId === order.id && p.status === 'captured')
      if (!payment) {
        throw new DomainError('PAYMENT_NOT_FOUND', 'no captured payment for order')
      }

      const ret = createReturnRequest({
        id: newId('ret'),
        order,
        reason,
        lines,
        idempotencyKey: key,
        existingReturns: db.returns,
      })

      db.returns.push(ret)
      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: ret.id,
          requestHash,
        }),
      )
      return { return: ret, order }
    })
  }

  /**
   * Merchant approves a requested return: refunds by line amount, restocks lines,
   * sets order to `refunded` (full) or `partially_refunded`.
   */
  async approveReturn(
    returnId: string,
    idempotencyKey: string,
  ): Promise<{ return: ReturnRequest; order: Order; payment: Payment }> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ returnId, action: 'approve' })

    return this.repo.transaction((db) => {
      const scope = 'approve_return'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        const ret = db.returns.find((r) => r.id === resolved.resourceId)!
        const order = db.orders.find((o) => o.id === ret.orderId)!
        const payment = db.payments.find((p) => p.orderId === order.id && p.status !== 'failed')!
        return { return: ret, order, payment }
      }

      const retIdx = db.returns.findIndex((r) => r.id === returnId)
      if (retIdx < 0) throw new DomainError('RETURN_NOT_FOUND', `return ${returnId} not found`)
      let ret = db.returns[retIdx]!
      ret = domainApproveReturn(ret)

      const orderIdx = db.orders.findIndex((o) => o.id === ret.orderId)
      if (orderIdx < 0) throw new DomainError('ORDER_NOT_FOUND', `order ${ret.orderId} not found`)
      const order = db.orders[orderIdx]!
      const payment = db.payments.find((p) => p.orderId === order.id && p.status === 'captured')
      if (!payment) {
        throw new DomainError('PAYMENT_NOT_FOUND', 'no captured payment for order')
      }

      const completed = completeReturnRefund(ret, order, payment, db.returns)

      for (const line of completed.return.lines) {
        const stock = findStock(db.stock, line.productId)
        upsertStock(db.stock, adjustOnHand(stock, line.quantity))
      }

      db.returns[retIdx] = completed.return
      db.orders[orderIdx] = completed.order
      const payIdx = db.payments.findIndex((p) => p.id === payment.id)
      db.payments[payIdx] = completed.payment
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

  async rejectReturn(returnId: string, idempotencyKey: string): Promise<ReturnRequest> {
    const key = requireIdempotencyKey(idempotencyKey)
    const requestHash = hashRequest({ returnId, action: 'reject' })

    return this.repo.transaction((db) => {
      const scope = 'reject_return'
      const existing = db.idempotency.find((r) => r.key === key && r.scope === scope)
      const resolved = resolveIdempotency(existing, key, scope, requestHash)
      if (resolved.replay) {
        return db.returns.find((r) => r.id === resolved.resourceId)!
      }

      const retIdx = db.returns.findIndex((r) => r.id === returnId)
      if (retIdx < 0) throw new DomainError('RETURN_NOT_FOUND', `return ${returnId} not found`)
      const next = domainRejectReturn(db.returns[retIdx]!)
      db.returns[retIdx] = next
      db.idempotency.push(
        makeIdempotencyRecord({
          key,
          scope,
          resourceId: next.id,
          requestHash,
        }),
      )
      return next
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
