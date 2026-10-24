/**
 * Set2 Task 3 — refund helpers (pure, integer cents, explicit boundary handling).
 */

export interface RefundRequest {
  /** Amount originally paid (分) */
  paidCents: number
  /** Amount already refunded (分) */
  alreadyRefundedCents: number
  /** Amount requested this time (分) */
  requestCents: number
}

export interface RefundResult {
  /** Cents approved for this refund */
  refundedCents: number
  /** Remaining refundable after this approval */
  remainingCents: number
  /** True when request was capped by remaining balance */
  capped: boolean
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`)
  }
  if (value < 0) {
    throw new RangeError(`${name} must be >= 0`)
  }
}

/**
 * Remaining refundable balance: max(0, paid − alreadyRefunded).
 * Rejects non-finite / negative inputs.
 */
export function remainingRefundableCents(
  paidCents: number,
  alreadyRefundedCents: number,
): number {
  assertFiniteNonNegative('paidCents', paidCents)
  assertFiniteNonNegative('alreadyRefundedCents', alreadyRefundedCents)
  return Math.max(0, Math.floor(paidCents) - Math.floor(alreadyRefundedCents))
}

/**
 * Approve a refund request without mutating the input.
 * Caps at remaining refundable; zero request → zero refund (not capped).
 */
export function approveRefund(request: RefundRequest): RefundResult {
  const { paidCents, alreadyRefundedCents, requestCents } = request
  assertFiniteNonNegative('paidCents', paidCents)
  assertFiniteNonNegative('alreadyRefundedCents', alreadyRefundedCents)
  assertFiniteNonNegative('requestCents', requestCents)

  const remaining = remainingRefundableCents(paidCents, alreadyRefundedCents)
  const want = Math.floor(requestCents)

  if (want === 0) {
    return { refundedCents: 0, remainingCents: remaining, capped: false }
  }

  const refundedCents = Math.min(want, remaining)
  return {
    refundedCents,
    remainingCents: remaining - refundedCents,
    capped: want > remaining,
  }
}

/**
 * Full refund of whatever is still refundable (boundary: already fully refunded → 0).
 */
export function fullRefundCents(
  paidCents: number,
  alreadyRefundedCents: number = 0,
): number {
  return remainingRefundableCents(paidCents, alreadyRefundedCents)
}
