/**
 * Set2 Task 5 — loyalty helpers (integer cents / points, pure, boundary-safe).
 *
 * Earn: floor(spend / centsPerPoint). Redeem: points × centsPerPoint, never
 * exceeding available balance or the payable subtotal.
 */

export interface LoyaltyRules {
  /** Cents of spend required to earn 1 point (must be >= 1) */
  centsPerPoint: number
  /** Cents of discount granted per redeemed point (must be >= 1) */
  redeemCentsPerPoint: number
}

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  centsPerPoint: 100,
  redeemCentsPerPoint: 1,
}

function assertFiniteNonNeg(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0`)
  }
}

function assertRules(rules: LoyaltyRules): void {
  assertFiniteNonNeg('centsPerPoint', rules.centsPerPoint)
  assertFiniteNonNeg('redeemCentsPerPoint', rules.redeemCentsPerPoint)
  if (rules.centsPerPoint < 1) {
    throw new RangeError('centsPerPoint must be >= 1')
  }
  if (rules.redeemCentsPerPoint < 1) {
    throw new RangeError('redeemCentsPerPoint must be >= 1')
  }
}

/**
 * Points earned from a purchase subtotal.
 * Boundary: exactly N × centsPerPoint earns N points (floor division).
 * Zero/empty spend → 0.
 */
export function earnPoints(
  subtotalCents: number,
  rules: LoyaltyRules = DEFAULT_LOYALTY_RULES,
): number {
  assertFiniteNonNeg('subtotalCents', subtotalCents)
  assertRules(rules)
  const spend = Math.floor(subtotalCents)
  if (spend === 0) return 0
  return Math.floor(spend / Math.floor(rules.centsPerPoint))
}

/**
 * Discount value in cents for redeeming `points`, clamped to `availablePoints`.
 * Non-positive points or empty balance → 0.
 */
export function redeemValueCents(
  points: number,
  availablePoints: number,
  rules: LoyaltyRules = DEFAULT_LOYALTY_RULES,
): number {
  assertFiniteNonNeg('points', points)
  assertFiniteNonNeg('availablePoints', availablePoints)
  assertRules(rules)
  const want = Math.floor(points)
  const bal = Math.floor(availablePoints)
  if (want <= 0 || bal <= 0) return 0
  const usable = Math.min(want, bal)
  return usable * Math.floor(rules.redeemCentsPerPoint)
}

/**
 * Apply a loyalty redemption to a subtotal.
 * Discount is clamped so the result never goes below 0, and never exceeds
 * what `availablePoints` can fund.
 */
export function applyLoyaltyRedeem(
  subtotalCents: number,
  pointsToRedeem: number,
  availablePoints: number,
  rules: LoyaltyRules = DEFAULT_LOYALTY_RULES,
): number {
  assertFiniteNonNeg('subtotalCents', subtotalCents)
  const sub = Math.floor(subtotalCents)
  const discount = redeemValueCents(pointsToRedeem, availablePoints, rules)
  return Math.max(0, sub - Math.min(discount, sub))
}
