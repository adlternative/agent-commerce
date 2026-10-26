import { DomainError } from '../domain/errors.js'

/**
 * Simple token-bucket limiter (per key, in-process).
 * refillPerSec tokens added each second, up to capacity.
 */
export class TokenBucket {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>()

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {}

  take(key: string, cost = 1): void {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { tokens: this.capacity, updatedAt: now }
      this.buckets.set(key, bucket)
    }
    const elapsed = (now - bucket.updatedAt) / 1000
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSec)
    bucket.updatedAt = now
    if (bucket.tokens < cost) {
      throw new DomainError('RATE_LIMITED', 'too many requests', {
        hint: `capacity=${this.capacity} refillPerSec=${this.refillPerSec}`,
        retryable: true,
      })
    }
    bucket.tokens -= cost
  }

  /** Test helper */
  reset(): void {
    this.buckets.clear()
  }
}
