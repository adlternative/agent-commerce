/**
 * Set2 Task 4 — pure discount helpers with explicit boundary handling.
 * All amounts are integer cents; results never go negative.
 */

/** Clamp `n` into the inclusive range [min, max]. Swaps min/max if inverted. */
function clamp(n: number, min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

function assertFiniteNonNeg(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0`)
  }
}

/**
 * Percent-off discount.
 * `rate` is clamped to [0, 1]; non-finite rate → 0 discount (return subtotal).
 * Returns integer cents remaining after discount.
 */
export function applyPercentDiscount(subtotalCents: number, rate: number): number {
  assertFiniteNonNeg('subtotalCents', subtotalCents)
  if (!Number.isFinite(rate)) {
    return Math.floor(subtotalCents)
  }
  const r = clamp(rate, 0, 1)
  return Math.max(0, Math.round(subtotalCents * (1 - r)))
}

/**
 * Fixed-amount discount in cents.
 * Discount is clamped so the result never goes below 0.
 */
export function applyFixedDiscount(subtotalCents: number, discountCents: number): number {
  assertFiniteNonNeg('subtotalCents', subtotalCents)
  assertFiniteNonNeg('discountCents', discountCents)
  const off = Math.min(Math.floor(discountCents), Math.floor(subtotalCents))
  return Math.floor(subtotalCents) - off
}

/**
 * Threshold (满减) discount: apply `discountCents` when subtotal >= threshold (inclusive).
 * Below threshold → no discount. Result never negative.
 */
export function applyThresholdDiscount(
  subtotalCents: number,
  thresholdCents: number,
  discountCents: number,
): number {
  assertFiniteNonNeg('subtotalCents', subtotalCents)
  assertFiniteNonNeg('thresholdCents', thresholdCents)
  assertFiniteNonNeg('discountCents', discountCents)

  const sub = Math.floor(subtotalCents)
  if (sub < Math.floor(thresholdCents)) {
    return sub
  }
  return applyFixedDiscount(sub, discountCents)
}
