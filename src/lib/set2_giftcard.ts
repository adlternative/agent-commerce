/**
 * Set2 gift card helpers — pure functions with explicit boundary handling.
 * All amounts are integer cents.
 */

function toNonNegativeCents(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/**
 * How many cents of a gift card apply to an order.
 * Never exceeds order total or card balance; non-finite/negative → 0.
 */
export function redeemAmountCents(orderTotalCents: number, balanceCents: number): number {
  const total = toNonNegativeCents(orderTotalCents)
  const balance = toNonNegativeCents(balanceCents)
  return Math.min(total, balance)
}

/**
 * Balance left after redeeming `redeemedCents` from `balanceCents`.
 * Redeemed is clamped to [0, balance]; non-finite inputs yield 0 remaining when balance is invalid.
 */
export function remainingBalanceCents(balanceCents: number, redeemedCents: number): number {
  const balance = toNonNegativeCents(balanceCents)
  const redeemed = toNonNegativeCents(redeemedCents)
  return Math.max(0, balance - Math.min(redeemed, balance))
}

/**
 * Amount the customer still owes after applying the gift card.
 * Zero when balance covers the total; non-finite/negative inputs treated as 0.
 */
export function payableAfterGiftCardCents(orderTotalCents: number, balanceCents: number): number {
  const total = toNonNegativeCents(orderTotalCents)
  const applied = redeemAmountCents(total, balanceCents)
  return total - applied
}

/**
 * Whether the card has a positive redeemable balance.
 */
export function isRedeemable(balanceCents: number): boolean {
  return toNonNegativeCents(balanceCents) > 0
}
