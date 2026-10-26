import { z } from 'zod'
import type { CommerceService } from '../services/commerce.js'
import { isDomainError } from '../domain/errors.js'
import { UpsertProductInputSchema } from '../domain/product.js'

/** Shared helper: tool handlers return JSON text content for LLMs. */
export function toolResult(data: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function toolError(err: unknown): {
  isError: true
  content: { type: 'text'; text: string }[]
} {
  if (isDomainError(err)) {
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(err.toJSON()) }] }
  }
  const message = err instanceof Error ? err.message : String(err)
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ code: 'TOOL_ERROR', message, retryable: true }),
      },
    ],
  }
}

export const ToolSchemas = {
  search_products: z.object({
    q: z
      .string()
      .optional()
      .describe('Free-text query matched against name, sku, tags, description, agentNotes'),
    tag: z.string().optional().describe('Exact tag filter (case-insensitive)'),
  }),
  get_product: z.object({
    productId: z.string().min(1).describe('Product id returned by search_products / upsert_product'),
  }),
  check_inventory: z.object({
    productId: z.string().min(1).describe('Product id to inspect onHand / reserved / available'),
  }),
  create_cart: z.object({
    customerId: z
      .string()
      .min(1)
      .default('mcp_shopper')
      .describe('Customer subject owning the cart'),
    idempotencyKey: z
      .string()
      .min(1)
      .describe('Unique key for this create_cart call; replay returns the same cart'),
  }),
  add_cart_item: z.object({
    cartId: z.string().min(1),
    productId: z.string().min(1),
    quantity: z.number().int().positive().describe('Units to add (positive integer)'),
    idempotencyKey: z.string().min(1),
  }),
  update_cart_item: z.object({
    cartId: z.string().min(1),
    productId: z.string().min(1),
    quantity: z
      .number()
      .int()
      .nonnegative()
      .describe('New absolute quantity; 0 removes the line'),
    idempotencyKey: z.string().min(1),
  }),
  remove_cart_item: z.object({
    cartId: z.string().min(1),
    productId: z.string().min(1),
    idempotencyKey: z.string().min(1),
  }),
  apply_promotion: z.object({
    cartId: z.string().min(1),
    code: z.string().min(1).describe('Promotion / coupon code such as SAVE200'),
    idempotencyKey: z.string().min(1),
  }),
  quote_cart: z.object({
    cartId: z.string().min(1).describe('Cart to price; includes discounts if a promo is applied'),
  }),
  place_order: z.object({
    cartId: z.string().min(1).describe('Cart to convert into an order (reserves stock)'),
    idempotencyKey: z.string().min(1),
  }),
  get_order: z.object({
    orderId: z.string().min(1),
  }),
  cancel_order: z.object({
    orderId: z.string().min(1),
    idempotencyKey: z.string().min(1),
  }),
  request_return: z.object({
    orderId: z.string().min(1).describe('Paid/shipped/delivered order to refund'),
    reason: z.string().min(1).describe('Human-readable return reason'),
    idempotencyKey: z.string().min(1),
  }),
  upsert_product: UpsertProductInputSchema.extend({
    idempotencyKey: z.string().min(1),
  }),
  adjust_stock: z.object({
    productId: z.string().min(1),
    delta: z
      .number()
      .int()
      .describe('Signed integer delta applied to onHand (e.g. +10 restock, -3 write-off)'),
    idempotencyKey: z.string().min(1),
  }),
  list_orders: z.object({
    customerId: z.string().optional(),
    status: z
      .enum(['created', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'])
      .optional(),
  }),
} as const

export type ToolName = keyof typeof ToolSchemas

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  search_products:
    'Search the active catalog. Prefer this before creating a cart. Returns products with priceCents (integer 分) and agentNotes for LLM-friendly selling points.',
  get_product:
    'Fetch one product by id, including agentNotes and priceCents. Use after search_products when you need full detail.',
  check_inventory:
    'Return onHand, reserved, and available units for a product. Call before add_cart_item when quantity is large.',
  create_cart:
    'Create an empty shopping cart for a customer. Always pass a fresh Idempotency key unless intentionally replaying.',
  add_cart_item:
    'Add (or increase) a product line on a cart. Fails with INSUFFICIENT_STOCK if quantity exceeds available.',
  update_cart_item:
    'Set absolute quantity for a cart line. Quantity 0 removes the item. Stock-checked against available.',
  remove_cart_item: 'Remove a product line from the cart entirely.',
  apply_promotion:
    'Attach a promotion/coupon code to the cart. Quote afterward with quote_cart to see discountCents.',
  quote_cart:
    'Price the cart: subtotalCents, discountCents, totalCents. Does not reserve stock.',
  place_order:
    'Convert a cart into an order (status=created) and reserve inventory. Use a stable idempotencyKey to safely retry.',
  get_order: 'Fetch order status and totals by id.',
  cancel_order:
    'Cancel an order. Releases reservations when status=created; restocks when status=paid.',
  request_return:
    'Request a return/refund for a paid/shipped/delivered order. Auto-approves and restocks in this demo core.',
  upsert_product:
    'Merchant: create or update a product (sku, name, priceCents, tags, agentNotes). Creates zero stock row if new.',
  adjust_stock:
    'Merchant: adjust onHand by a signed delta. Cannot go negative or below reserved.',
  list_orders:
    'Merchant/agent: list orders, optionally filtered by customerId and status.',
}

/**
 * Pure handler map used by MCP registration and unit tests (no transport).
 */
export async function callTool(
  commerce: CommerceService,
  name: ToolName,
  rawArgs: unknown,
): Promise<ReturnType<typeof toolResult> | ReturnType<typeof toolError>> {
  try {
    switch (name) {
      case 'search_products': {
        const args = ToolSchemas.search_products.parse(rawArgs)
        return toolResult(await commerce.listProducts(args))
      }
      case 'get_product': {
        const args = ToolSchemas.get_product.parse(rawArgs)
        return toolResult(await commerce.getProduct(args.productId))
      }
      case 'check_inventory': {
        const args = ToolSchemas.check_inventory.parse(rawArgs)
        return toolResult(await commerce.checkInventory(args.productId))
      }
      case 'create_cart': {
        const args = ToolSchemas.create_cart.parse(rawArgs)
        return toolResult(await commerce.createCart(args.customerId, args.idempotencyKey))
      }
      case 'add_cart_item': {
        const args = ToolSchemas.add_cart_item.parse(rawArgs)
        return toolResult(
          await commerce.addItem(
            args.cartId,
            args.productId,
            args.quantity,
            args.idempotencyKey,
          ),
        )
      }
      case 'update_cart_item': {
        const args = ToolSchemas.update_cart_item.parse(rawArgs)
        return toolResult(
          await commerce.updateItem(
            args.cartId,
            args.productId,
            args.quantity,
            args.idempotencyKey,
          ),
        )
      }
      case 'remove_cart_item': {
        const args = ToolSchemas.remove_cart_item.parse(rawArgs)
        return toolResult(
          await commerce.removeItem(args.cartId, args.productId, args.idempotencyKey),
        )
      }
      case 'apply_promotion': {
        const args = ToolSchemas.apply_promotion.parse(rawArgs)
        return toolResult(
          await commerce.applyPromotion(args.cartId, args.code, args.idempotencyKey),
        )
      }
      case 'quote_cart': {
        const args = ToolSchemas.quote_cart.parse(rawArgs)
        return toolResult(await commerce.quoteCart(args.cartId))
      }
      case 'place_order': {
        const args = ToolSchemas.place_order.parse(rawArgs)
        return toolResult(await commerce.placeOrder(args.cartId, args.idempotencyKey))
      }
      case 'get_order': {
        const args = ToolSchemas.get_order.parse(rawArgs)
        return toolResult(await commerce.getOrder(args.orderId))
      }
      case 'cancel_order': {
        const args = ToolSchemas.cancel_order.parse(rawArgs)
        return toolResult(await commerce.cancelOrder(args.orderId, args.idempotencyKey))
      }
      case 'request_return': {
        const args = ToolSchemas.request_return.parse(rawArgs)
        return toolResult(
          await commerce.requestReturn(args.orderId, args.reason, args.idempotencyKey),
        )
      }
      case 'upsert_product': {
        const args = ToolSchemas.upsert_product.parse(rawArgs)
        const { idempotencyKey, ...input } = args
        return toolResult(await commerce.upsertProduct(input, idempotencyKey))
      }
      case 'adjust_stock': {
        const args = ToolSchemas.adjust_stock.parse(rawArgs)
        return toolResult(
          await commerce.adjustStock(args.productId, args.delta, args.idempotencyKey),
        )
      }
      case 'list_orders': {
        const args = ToolSchemas.list_orders.parse(rawArgs)
        return toolResult(await commerce.listOrders(args))
      }
      default: {
        const _exhaustive: never = name
        return toolError(new Error(`unknown tool ${_exhaustive}`))
      }
    }
  } catch (err) {
    return toolError(err)
  }
}
