# ADR 0004: Fail-closed auth (JWT + API Key)

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Three roles (`customer` | `merchant` | `agent`) plus agent scopes (`agent:customer` | `agent:merchant`) protect REST and MCP. A hardcoded JWT secret once shipped in source (`DEFAULT_JWT_SECRET` in `src/server/auth.ts`); production must not boot with that or any implicit secret. Demo opaque tokens/keys are convenient locally but dangerous if left on in production.

## Decision

Unified auth in `src/server/auth.ts`, reused by HTTP router and MCP Streamable HTTP:

| Mechanism | How |
|-----------|-----|
| **API Key** | `X-API-Key` or `Authorization: ApiKey …` |
| **Opaque Bearer** | Demo token map when demos enabled |
| **JWT** | HS256 via `node:crypto` (`signJwt` / `verifyJwt`); claims `sub`, `role`, `scopes?`, `iat?`, `exp?` |

Fail-closed rules (`buildAuthConfig` / `resolveJwtSecret`):

- `NODE_ENV=production` without `JWT_SECRET` → throw `MissingJwtSecretError` (refuse start).
- Non-production missing secret → ephemeral random secret (never logged).
- Demo tokens/keys only when `ALLOW_DEMO_TOKENS=1` or `NODE_ENV !== 'production'`.
- Legacy public secrets (`DEFAULT_JWT_SECRET`, `DOCKER_INSECURE_JWT_SECRET`) are **not** defaults; kept so tests prove forged JWTs → **401**.
- MCP HTTP calls `authenticate(req, buildAuthConfig())` before tools (`src/mcp/http.ts`); merchant tools require merchant / `agent:merchant`.

Bare role `agent` grants nothing — scopes are explicit (`actorMayAccess`).

## Consequences

- Compose/prod must set `JWT_SECRET` (see `docker-compose.yml`); demos opt in explicitly.
- Attack surface for forged JWT with leaked historic secrets is regression-tested, not papered over.
- Rate limit and RBAC sit after authentication on REST (`src/server/router.ts`); MCP stdio trust model remains local-process (**stdio network auth 尚未实现** beyond transport assumptions).

## Alternatives

1. **Fail-open demo tokens in production** — rejected (ACP-19 / ACP-30).
2. **External IdP / OAuth only** — **尚未实现**; would wrap the same `Actor` model later.
3. **Separate MCP credentials** — rejected: dual policy drift; ACP-28 aligned MCP HTTP with REST.
