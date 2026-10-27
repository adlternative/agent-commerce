# Security

Security expectations for Agent Commerce. Norms: [`CONTRIBUTING.md`](./CONTRIBUTING.md). Auth decision: [ADR 0004](./adr/0004-fail-closed-auth-jwt-api-key.md).

## Vulnerability reporting

1. **Do not** open a public GitHub issue with exploit details for auth bypass, secret leak, or data corruption.
2. Report privately to the repository maintainers (GitHub Security Advisory / private contact for `adlternative/agent-commerce`).
3. Include: affected version/commit, surface (REST path, MCP tool, Docker), reproduction without weaponized payloads when possible, and impact.
4. Allow time to patch before public disclosure. Fixes should add regression tests — **不许放宽已有断言**.

There is no paid bug-bounty program (**尚未实现**).

## Secrets handling

| Secret / credential | Rule |
|---------------------|------|
| `JWT_SECRET` | Required when `NODE_ENV=production`; compose uses `${JWT_SECRET:?…}` — no insecure default (`docker-compose.yml`, ACP-30). Generate with `openssl rand -hex 32`. |
| Demo tokens / API keys | Only when `ALLOW_DEMO_TOKENS=1` or non-production (`demoCredentialsEnabled` in `src/server/auth.ts`). Never enable demos on public internet deploys. |
| `DEFAULT_JWT_SECRET` / `DOCKER_INSECURE_JWT_SECRET` | Public historic values; **must not** be used as runtime secrets. Kept only so tests prove forged JWTs → 401. |
| Opaque demo tokens (`customer-token`, `*-key`, …) | Local/dev only; empty maps in production unless explicitly allowed. |
| Env files / local `data/` | Do not commit. Rotate any secret that appears in logs, screenshots, or PRs. |

Server boot path: `buildAuthConfig()` → `resolveJwtSecret()` (`src/server/auth.ts`). Ephemeral secrets in non-prod are random and must not be logged.

## Threat model (selected)

### Forged JWT

| Threat | Mitigation (code) | Residual |
|--------|-------------------|----------|
| Attacker signs HS256 JWT with leaked historic secret (`agent-commerce-dev-jwt-secret`, `dev-docker-change-me`) | Those strings are not defaults; `verifyJwt` only accepts configured `jwt.secret`; regression tests expect **401** | Operator still must set a strong unique `JWT_SECRET` |
| Missing/weak secret in production | `MissingJwtSecretError` refuses start when production and unset | Mis-set short secrets are not entropy-checked (**尚未实现**) |
| `alg=none` / wrong algorithm | Header must be `HS256` in `verifyJwt` | Asymmetric JWT alg families **尚未实现** |
| Expired token | `exp` checked with small clock skew | Refresh/session store **尚未实现** |

### MCP authentication

| Threat | Mitigation (code) | Residual |
|--------|-------------------|----------|
| Unauthenticated MCP Streamable HTTP tool calls | `src/mcp/http.ts` runs `authenticate(req, buildAuthConfig())` before `createMcpServer`; missing/invalid creds → JSON-RPC error with HTTP 401/403 (ACP-28) | Binding MCP HTTP to non-localhost without TLS is operator risk |
| Customer token calling merchant tools | Tool RBAC for `upsert_product` / `adjust_stock` / `list_orders` requires merchant or `agent:merchant` | Other tools still need least-privilege review as surface grows |
| Stdio MCP | Intended for local trusted process; no network auth layer | Remote stdio bridging **尚未实现** / not supported as a secure boundary |

### Rate-limit bypass

| Threat | Mitigation (code) | Residual |
|--------|-------------------|----------|
| Burst abuse on REST | In-process `TokenBucket` keyed by `role:subject` after auth (`src/ai/rate-limit.ts`, applied in `src/server/router.ts`); `RATE_LIMITED` + `Retry-After` | **Per-process only** — multiple Node replicas do not share buckets (**尚未实现** distributed limiter) |
| Unauthenticated flood | Auth failure paths still consume server CPU; public `/healthz` `/readyz` `/metrics` are unauthenticated by design | Edge/WAF rate limits **尚未实现** in-repo; operators should terminate TLS/rate-limit at reverse proxy |
| Key rotation / identity spoof to reset bucket | New subjects get fresh buckets (capacity 60, refill 1/s default in `create-server.ts`) | No global IP bucket (**尚未实现**) |
| MCP HTTP vs REST | MCP HTTP auth aligned with REST; MCP does not currently share the REST token-bucket (**尚未实现** unified MCP rate limit) | Agents on MCP HTTP can bypass REST bucket if exposed |

## Secure development expectations

- Prefer fail-closed defaults; document any intentional open surface (`/healthz`, `/openapi.json`, `/.well-known/ai-commerce.json`).
- Never weaken auth or rate-limit tests to green CI.
- No paid SaaS security scanners required for contribution; local `npm run test:unit` + e2e suffice for norms.
