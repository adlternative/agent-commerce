import { z } from 'zod'
import { DomainError } from './errors.js'

export const IdempotencyRecordSchema = z.object({
  key: z.string().min(1),
  scope: z.string().min(1),
  /** Stable resource id produced by the first successful write. */
  resourceId: z.string().min(1),
  /** Optional fingerprint of the request body for conflict detection. */
  requestHash: z.string().optional(),
  createdAt: z.string().datetime(),
})

export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>

export function requireIdempotencyKey(key: string | undefined | null): string {
  if (!key || !key.trim()) {
    throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header/value is required', {
      hint: 'pass a unique key per logical write operation',
      retryable: false,
    })
  }
  return key.trim()
}

/**
 * Resolve idempotency: if key exists with same hash → replay resourceId;
 * if key exists with different hash → conflict; else → proceed (null).
 */
export function resolveIdempotency(
  existing: IdempotencyRecord | undefined,
  key: string,
  scope: string,
  requestHash?: string,
): { replay: true; resourceId: string } | { replay: false } {
  if (!existing) return { replay: false }
  if (existing.key !== key || existing.scope !== scope) return { replay: false }
  if (
    existing.requestHash !== undefined &&
    requestHash !== undefined &&
    existing.requestHash !== requestHash
  ) {
    throw new DomainError(
      'IDEMPOTENCY_KEY_REUSE',
      'Idempotency-Key reused with a different request payload',
      { hint: `key=${key} scope=${scope}`, retryable: false },
    )
  }
  return { replay: true, resourceId: existing.resourceId }
}

export function makeIdempotencyRecord(input: {
  key: string
  scope: string
  resourceId: string
  requestHash?: string
  now?: Date
}): IdempotencyRecord {
  return {
    key: input.key,
    scope: input.scope,
    resourceId: input.resourceId,
    requestHash: input.requestHash,
    createdAt: (input.now ?? new Date()).toISOString(),
  }
}
