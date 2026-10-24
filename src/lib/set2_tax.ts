/**
 * Set2 Task 1 — tax helpers (integer cents, pure, boundary-safe).
 *
 * Rates use basis points: 100 bps = 1%, 10_000 bps = 100%.
 */

function assertFinite(...values: number[]): void {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new RangeError('set2_tax requires finite numbers')
    }
  }
}

/** Non-negative integer cents; non-finite / negative → 0. */
function normalizeCents(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.floor(cents)
}

/** Non-negative integer bps; non-finite / negative → 0. */
function normalizeBps(rateBps: number): number {
  if (!Number.isFinite(rateBps) || rateBps <= 0) return 0
  return Math.floor(rateBps)
}

/**
 * Tax amount in cents for a taxable subtotal.
 * Zero/negative amount or rate → 0. Rounds half-up via Math.round.
 */
export function taxCents(subtotalCents: number, rateBps: number): number {
  const amount = normalizeCents(subtotalCents)
  const bps = normalizeBps(rateBps)
  if (amount === 0 || bps === 0) return 0
  return Math.round((amount * bps) / 10_000)
}

/**
 * Subtotal plus tax, both in cents.
 */
export function totalWithTaxCents(subtotalCents: number, rateBps: number): number {
  const amount = normalizeCents(subtotalCents)
  return amount + taxCents(amount, rateBps)
}

/**
 * Extract the tax portion from a tax-inclusive price.
 * Formula: tax = inclusive - inclusive / (1 + rate).
 * Zero inclusive or rate → 0.
 */
export function taxFromInclusiveCents(inclusiveCents: number, rateBps: number): number {
  const inclusive = normalizeCents(inclusiveCents)
  const bps = normalizeBps(rateBps)
  if (inclusive === 0 || bps === 0) return 0
  const net = Math.round((inclusive * 10_000) / (10_000 + bps))
  return inclusive - net
}

/**
 * Clamp a rate (bps) into [0, maxBps]. Rejects non-finite inputs.
 * Swaps bounds if maxBps < 0 is passed incorrectly — maxBps must be ≥ 0.
 */
export function clampRateBps(rateBps: number, maxBps: number = 10_000): number {
  assertFinite(rateBps, maxBps)
  const hi = Math.max(0, Math.floor(maxBps))
  if (rateBps <= 0) return 0
  const rate = Math.floor(rateBps)
  return rate > hi ? hi : rate
}
