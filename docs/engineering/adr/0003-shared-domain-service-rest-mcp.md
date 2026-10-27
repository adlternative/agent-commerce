# ADR 0003: Shared domain service for REST + MCP

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Agents and humans must see the same catalog, cart, inventory holds, and order state machine. A second “MCP-only” business layer would fork pricing, stock, and idempotency rules. MCP already registers tools that call into commerce (`src/mcp/create-mcp-server.ts` → `callTool(commerce, …)`).

## Decision

Expose **one** `CommerceService` (`src/services/commerce.ts`) constructed with a `CommerceRepository`:

- HTTP: `createAppServer` → `new CommerceService(repo)` → `registerRoutes(router, commerce, …)` (`src/server/create-server.ts`, `src/server/routes.ts`).
- MCP stdio/HTTP: `new CommerceService(opened.repo)` then `createMcpServer(commerce[, { actor }])` (`src/mcp/stdio.ts`, `src/mcp/http.ts`).

Transports adapt auth, encoding, and errors; they do not reimplement place/pay/ship/return.

## Consequences

- Bug fixes and inventory math land once; REST and MCP stay behaviorally aligned.
- MCP tool schemas may mirror HTTP Zod shapes but still invoke the same service methods.
- Transport-specific concerns (JSON-RPC errors, Streamable HTTP sessions) stay in `src/mcp/*` via `toMcpError` / `toMappedErrorBody`.

## Alternatives

1. **Separate MCP service with its own store** — rejected: divergent stock and orders.
2. **Generate MCP solely from OpenAPI without a service layer** — rejected: loses idempotency and domain transitions.
3. **gRPC/internal-only core + dual adapters** — unnecessary complexity for a single-process Node app.
