import { z } from 'zod'
import { DomainError } from './errors.js'

/** All monetary amounts are integer cents (分). Never use floats. */
export const CentsSchema = z
  .number()
  .int('amount must be integer cents')
  .nonnegative('amount must be >= 0')

export type Cents = z.infer<typeof CentsSchema>

export function assertCents(value: number, field = 'amount'): Cents {
  const parsed = CentsSchema.safeParse(value)
  if (!parsed.success) {
    throw new DomainError('INVALID_CENTS', `${field} must be non-negative integer cents`, {
      hint: parsed.error.issues[0]?.message,
    })
  }
  return parsed.data
}

export function addCents(a: Cents, b: Cents): Cents {
  return assertCents(a + b)
}

export function subCents(a: Cents, b: Cents): Cents {
  if (b > a) {
    throw new DomainError('NEGATIVE_CENTS', 'subtraction would yield negative cents', {
      hint: `a=${a} b=${b}`,
    })
  }
  return assertCents(a - b)
}
