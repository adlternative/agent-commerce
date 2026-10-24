# Agent notes — architecture constraints

## Source gap

`docs/ARCHITECTURE.md` is **not present** in this repository (checked on `main`). These notes are derived from the best available architecture documentation in-repo:

- [`README.md`](../README.md) — structure and design orientation
- Repository layout described there (`src/lib/pricing.ts`, `src/lib/cart.ts`, `src/lib/catalog.ts`, components, tests)

Agents should treat the three constraints below as hard invariants when implementing or reviewing commerce logic.

## Constraints

1. **Integer cents only.** All monetary amounts use integer 分 (cents). Do not introduce floating-point currency values in pricing, cart totals, or UI money math.

2. **Pure, immutable cart functions.** Cart operations are pure functions: they must not mutate input arguments (cart lines, payloads, catalog entries). Return new values instead of in-place updates.

3. **Agent-readable product data.** Catalog products expose `agentNotes` (LLM-facing selling points) and structured `tags` so agents can consume product semantics directly without scraping or parsing HTML.

## Related layout (from README)

| Area | Role |
|------|------|
| `src/lib/pricing.ts` | Deterministic满减 / 会员 / 包邮 pricing in integer cents |
| `src/lib/cart.ts` | Add-to-cart, stock clamp, out-of-stock checks (pure) |
| `src/lib/catalog.ts` | Structured products including `agentNotes` |
| `src/components/` | ProductCard / CartPanel |
| `tests/` | Pricing and cart unit tests |
