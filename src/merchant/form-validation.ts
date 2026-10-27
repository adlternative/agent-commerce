/** Client-side validation for merchant create-product + 满减 forms. */

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string }

/** Initial stock on create-product: required number, integer, >= 0. */
export function validateInitialStock(raw: unknown): ValidationResult & { stock?: number } {
  if (raw === '' || raw === null || raw === undefined) {
    return { ok: false, message: '初始库存必填' }
  }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, message: '初始库存必须是整数' }
  }
  if (n < 0) {
    return { ok: false, message: '初始库存不能为负数' }
  }
  return { ok: true, stock: n }
}

export type ThresholdOffInput = {
  code: string
  thresholdCents: unknown
  offCents: unknown
}

/**
 * 满减 (threshold_off): threshold >= 0, discount >= 0, discount must not exceed threshold.
 * Aligns with OpenAPI Promotion threshold_off fields (amounts in cents).
 */
export function validateThresholdOff(input: ThresholdOffInput): ValidationResult & {
  thresholdCents?: number
  offCents?: number
} {
  const code = input.code.trim()
  if (!code) {
    return { ok: false, message: '促销代码必填' }
  }

  const threshold = Number(input.thresholdCents)
  if (!Number.isFinite(threshold) || !Number.isInteger(threshold)) {
    return { ok: false, message: '满减门槛必须是整数（分）' }
  }
  if (threshold < 0) {
    return { ok: false, message: '满减门槛不能为负数' }
  }

  const off = Number(input.offCents)
  if (!Number.isFinite(off) || !Number.isInteger(off)) {
    return { ok: false, message: '优惠金额必须是整数（分）' }
  }
  if (off < 0) {
    return { ok: false, message: '优惠金额不能为负数' }
  }
  if (off > threshold) {
    return { ok: false, message: '优惠金额不能超过满减门槛' }
  }

  return { ok: true, thresholdCents: threshold, offCents: off }
}
