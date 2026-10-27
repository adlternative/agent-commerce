# ADR 0001: Zod as single validation source → OpenAPI

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

HTTP, MCP tools, and generated docs must agree on request/response shapes. Duplicating JSON Schema by hand drifts from runtime checks. The stack already depends on `zod` and `zod-to-json-schema` (`package.json`). Domain entities (e.g. `ProductSchema` in `src/domain/product.ts`) and HTTP bodies (`src/server/request-schemas.ts`) are Zod-first.

## Decision

**Zod is the single validation source.** Runtime parse/safeParse happens in domain and route boundaries; OpenAPI 3.1 is **derived** from those schemas via `zodToJsonSchema` in `src/server/openapi.ts` (`buildOpenApi`, `zodSchema` helper with `target: 'openApi3'`). CI guards drift with `npm run openapi:check` (`tests/server/openapi-check.test.ts`) against `docs/openapi.json`.

## Consequences

- Adding a field means updating Zod once; OpenAPI and handlers stay aligned when generators are re-run/checked.
- Some OpenAPI nuance (descriptions, optional list envelopes) is expressed through Zod `.describe()` / `.extend()` (see `ProductWithOptionalAvailableSchema`).
- Hand-edited `docs/openapi.json` without schema changes will fail `openapi:check`.

## Alternatives

1. **Hand-maintained OpenAPI as source** — rejected: duplicate types and easy route/doc skew.
2. **TypeBox / JSON Schema-first** — rejected: Zod already used across domain; switching cost without gain.
3. **Separate DTO types + manual mappers** — rejected: more boilerplate than zod inference.
