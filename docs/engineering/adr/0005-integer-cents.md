# ADR 0005: Integer cents

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Floating-point money causes rounding bugs in quotes, promotions, payments, and refunds. Agent and OpenAPI consumers need a single unambiguous unit across languages.

## Decision

All monetary amounts are **non-negative integer cents** (分):

- Schema: `CentsSchema` / `assertCents` / `addCents` / `subCents` in `src/domain/money.ts` (`z.number().int().nonnegative()`).
- Domain fields use `*Cents` naming (`priceCents`, `amountCents`, `totalCents`, etc. in product/order/payment/return schemas).
- APIs and OpenAPI expose integers only; UI formatting belongs in `src/api/format.ts` (display), not in storage.

`subCents` throws `NEGATIVE_CENTS` rather than allowing silent wrap.

## Consequences

- Callers convert major units at the edge if needed; core never stores `number` dollars.
- Refunds cannot exceed remaining order totals (enforced in return domain + service).
- Currencies beyond a single implicit unit / FX are **尚未实现**.

## Alternatives

1. **IEEE floats** — rejected: nondeterministic totals.
2. **Decimal strings / big.js** — deferred: integers suffice for MVP; can layer later without API rename if still cents.
3. **Minor units per ISO currency with FX** — **尚未实现**; would extend `Cents` with currency codes.
