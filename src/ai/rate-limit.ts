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

  /** Current configured capacity (for Retry-After / diagnostics). */
  getCapacity(): number {
    return this.capacity
  }

  getRefillPerSec(): number {
    return this.refillPerSec
  }

  /**
   * Seconds until at least `cost` tokens are available for `key`.
   * Returns 0 when the take would succeed immediately.
   */
  retryAfterSec(key: string, cost = 1): number {
    this.refill(key)
    const bucket = this.buckets.get(key)
    const tokens = bucket?.tokens ?? this.capacity
    if (tokens >= cost) return 0
    if (this.refillPerSec <= 0) return 60
    const need = cost - tokens
    return Math.max(1, Math.ceil(need / this.refillPerSec))
  }

  take(key: string, cost = 1): void {
    this.refill(key)
    const bucket = this.buckets.get(key)!
    if (bucket.tokens < cost) {
      const retryAfterSec = this.retryAfterSec(key, cost)
      throw new DomainError('RATE_LIMITED', 'too many requests', {
        hint: `capacity=${this.capacity} refillPerSec=${this.refillPerSec} retryAfterSec=${retryAfterSec}`,
        retryable: true,
      })
    }
    bucket.tokens -= cost
  }

  private refill(key: string): void {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = { tokens: this.capacity, updatedAt: now }
      this.buckets.set(key, bucket)
      return
    }
    const elapsed = (now - bucket.updatedAt) / 1000
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSec)
    bucket.updatedAt = now
  }

  /** Test helper */
  reset(): void {
    this.buckets.clear()
  }
}
