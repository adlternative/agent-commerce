/**
 * Set2 shipping — pure helpers with explicit free-shipping boundary handling.
 * Amounts are integer cents (分).
 */

export interface ShippingRules {
  /** Flat shipping fee (分) when below free-shipping threshold */
  shippingCents: number
  /** Inclusive free-shipping threshold (分) */
  freeShippingCents: number
}

export const DEFAULT_SHIPPING_RULES: ShippingRules = {
  shippingCents: 800,
  freeShippingCents: 9900,
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite number >= 0`)
  }
}

function assertRules(rules: ShippingRules): void {
  assertNonNegativeFinite(rules.shippingCents, 'shippingCents')
  assertNonNegativeFinite(rules.freeShippingCents, 'freeShippingCents')
}

/**
 * Whether `subtotalCents` qualifies for free shipping.
 * Boundary: exactly at `freeShippingCents` qualifies (`>=`).
 */
export function qualifiesForFreeShipping(
  subtotalCents: number,
  rules: ShippingRules = DEFAULT_SHIPPING_RULES,
): boolean {
  assertNonNegativeFinite(subtotalCents, 'subtotalCents')
  assertRules(rules)
  return subtotalCents >= rules.freeShippingCents
}

/**
 * Shipping cost in cents for a subtotal.
 * Free when subtotal >= freeShippingCents; otherwise flat `shippingCents`.
 */
export function shippingCents(
  subtotalCents: number,
  rules: ShippingRules = DEFAULT_SHIPPING_RULES,
): number {
  return qualifiesForFreeShipping(subtotalCents, rules) ? 0 : rules.shippingCents
}

/**
 * Payable total = subtotal + shipping (integer cents).
 * Does not mutate inputs.
 */
export function totalWithShipping(
  subtotalCents: number,
  rules: ShippingRules = DEFAULT_SHIPPING_RULES,
): number {
  return subtotalCents + shippingCents(subtotalCents, rules)
}
