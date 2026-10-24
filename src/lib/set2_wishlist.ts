/**
 * Set2 Task 11 — wishlist helpers (pure, immutable, explicit boundary handling).
 *
 * Wishlist is an ordered list of SKU strings. Operations never mutate inputs.
 */

/** Default maximum number of SKUs a wishlist may hold. */
export const DEFAULT_WISHLIST_MAX = 50

function assertFiniteNonNegativeInt(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0`)
  }
}

/**
 * Normalize a SKU: trim whitespace. Empty / non-string → empty string.
 */
export function normalizeSku(sku: unknown): string {
  if (typeof sku !== 'string') return ''
  return sku.trim()
}

/**
 * Whether `sku` is already on the wishlist (after normalization).
 * Empty / blank SKU → false.
 */
export function isInWishlist(items: readonly string[], sku: unknown): boolean {
  const key = normalizeSku(sku)
  if (key === '') return false
  return items.some((item) => normalizeSku(item) === key)
}

/**
 * Number of non-blank SKUs currently on the wishlist.
 */
export function wishlistSize(items: readonly string[]): number {
  return items.filter((item) => normalizeSku(item) !== '').length
}

/**
 * Add a SKU to the wishlist without mutating `items`.
 *
 * Boundaries:
 * - blank / empty SKU → returns a shallow copy unchanged
 * - already present → returns a shallow copy unchanged (idempotent)
 * - at `maxItems` capacity → returns a shallow copy unchanged (no throw)
 * - `maxItems` must be finite and >= 0 (0 means nothing can be added)
 */
export function addToWishlist(
  items: readonly string[],
  sku: unknown,
  maxItems: number = DEFAULT_WISHLIST_MAX,
): string[] {
  assertFiniteNonNegativeInt('maxItems', maxItems)
  const max = Math.floor(maxItems)
  const key = normalizeSku(sku)
  const next = items.map((item) => normalizeSku(item)).filter((item) => item !== '')

  if (key === '') return next
  if (next.some((item) => item === key)) return next
  if (next.length >= max) return next

  return [...next, key]
}

/**
 * Remove a SKU from the wishlist without mutating `items`.
 *
 * Boundaries:
 * - blank / empty SKU → shallow copy unchanged
 * - missing SKU → shallow copy unchanged
 */
export function removeFromWishlist(items: readonly string[], sku: unknown): string[] {
  const key = normalizeSku(sku)
  const next = items.map((item) => normalizeSku(item)).filter((item) => item !== '')
  if (key === '') return next
  return next.filter((item) => item !== key)
}

/**
 * Toggle membership: remove if present, otherwise add (respecting `maxItems`).
 * Blank SKU → shallow copy of cleaned list unchanged.
 */
export function toggleWishlist(
  items: readonly string[],
  sku: unknown,
  maxItems: number = DEFAULT_WISHLIST_MAX,
): string[] {
  if (isInWishlist(items, sku)) {
    return removeFromWishlist(items, sku)
  }
  return addToWishlist(items, sku, maxItems)
}
