/**
 * Probe6 alpha — pure helpers with explicit boundary handling.
 */

/** Clamp `n` into the inclusive range [min, max]. Swaps min/max if inverted. */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('clamp requires finite numbers')
  }
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

/**
 * Integer quantity capped by available stock.
 * Non-finite or negative qty → 0; stock < 0 treated as 0.
 */
export function clampQuantity(qty: number, stock: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  const available = Number.isFinite(stock) && stock > 0 ? Math.floor(stock) : 0
  return Math.min(Math.floor(qty), available)
}

/**
 * Safe division: returns 0 when denominator is 0 or either side is non-finite.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0
  }
  return numerator / denominator
}
