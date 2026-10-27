# Workflow status (W1–W9)

Repo: [adlternative/agent-commerce](https://github.com/adlternative/agent-commerce)

| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| W1 | Server/MCP runtime compile + CI smoke | Done | `tsconfig.server.json` → `dist-server/`; boot + MCP stdio smokes; landed in #630 |
| W2 | SQLite persistence + migrations | Done | `node:sqlite` + JSON→SQLite migrate; concurrency tests; #634 |
| W3 | Payment webhook, inventory hold, fulfillment | Done | Webhook idempotency + 15m hold auto-release + ship/receive/refund loop |
| W4 | Full-text search, agentNotes ranking, cursors | Done | Ranked FTS + CJK fallback; agentNotes weighted; stable score/id keyset; #632 |
| W5 | Structured logs, metrics, OpenAPI regression | Done | #633 @ `b06ea85`; 18 files / 69 tests |
| W6 | API Key/JWT, RBAC, rate limit, audit API | Done | #638 @ `b17f711`; 26 files / 129 tests |
| W7 | E2E customer order + merchant ship | Done | [#637](https://github.com/adlternative/agent-commerce/pull/637) Playwright place+pay + ship; 30 files / 142 unit + 2 e2e |
| W8 | MCP resources, prompts, errors, sampling | Done | #639 @ `e7e27de`; 30 files / 142 tests |
| W9-1 | healthz/readyz + 404 NOT_FOUND | Done | #642 @ `9a42992`; public /healthz+/readyz (sqlite RW); unmatched → 404; 31 files / 149 unit + 2 e2e |
| W9-2 | Metrics path cardinality cap | In progress | Unmatched → path="<unmatched>"; templates for params; cardinality ≤ 3 |
| W9-3 | Agent scope split | Done | #646 @ `3fcd5e7`; `agent:customer`/`agent:merchant`; no implicit merchant; 31 files / 151 unit + 2 e2e |
| W9-4 | Playwright free port | Done | #643 @ `7e0d94d`; Prefer `PW_PORT` / auto-pick when occupied; `reuseExistingServer: false`; 31 files / 149 unit + 2 e2e |
| ACP-14 | Merchant product `stock` → initial onHand | Done | #658 @ `c70617d`; stock→onHand; unknown→400 UNKNOWN_FIELD; 32 files / 168 unit + 3 e2e |
| ACP-17 | NL order parse qty/query (#652) | Done | #657 @ `d585882`; parseNlIntent CN/EN qty + clean query; 31 files / 159 unit + 3 e2e |
| ACP-16 | Product list always `{items,nextCursor}` (#651) | Done | #663 @ `5c59dca`; always page envelope + OpenAPI limit/cursor; 33 files / 176 unit + 3 e2e |
| ACP-18 | README test/E2E docs | Done | #656 @ `b205bff`; scripts table + playwright install + `E2E_API_PORT` |
| ACP-19 | Fail-closed JWT_SECRET + demo token gate (#654) | Done | #660 @ `8049d2c`; fail-closed JWT_SECRET; gated demos; forged legacy secret → 401; 33 files / 183 unit + 3 e2e |
| ACP-20 | Agent product list `available` | Done | #662 @ `fef4a7d`; batch stock + OpenAPI `available` + 409 on OOS add |
| ACP-21 | Docker + configurable `DATA_DIR` | Done | #671 @ `0869e8f`; DATA_DIR+Docker; 35 files / 188 unit + 3 e2e |
| ACP-23 | MCP Streamable HTTP real client smoke | Done | #669 @ `714503a`; SDK StreamableHTTP client smoke; `test:mcp:http` + CI; 36/189 + 3 e2e |
| ACP-25 | Clean legacy skeleton issues #1–#8 | Done | #668 @ `c44c16a`; archive ISSUES.md; #1–#8 need user close (403); 33/183 + 3 e2e |
| ACP-22 | Returns/refund UI + E2E | Done | #672 @ `aa5f818`; customer return + merchant approve/reject + E2E |
| ACP-24 | Merchant stock + promotions UI | Done | #674 @ `72273c3`; create-product stock + promotions panel |
| ACP-28 | MCP Streamable HTTP authentication (#676) | Done | #678 @ `6ef3519`; REST auth on MCP HTTP; merchant tool RBAC |
| ACP-29 | Playwright e2e on SQLite not JSON (#677) | Done | #679 @ `576efd3`; DATA_DIR per worker; healthz store=sqlite; JSON legacy config |
| ACP-30 | Docker JWT no insecure defaults (#680) | Done | #684 @ `779552c`; require JWT_SECRET in compose; demos default off |
| ACP-31 | Merchant product list stock fields (#681) | Done | #685 @ `fe49285`; onHand/reserved/available on GET /api/merchant/products |
| ACP-32 | Dockerfile without apt/tini (#682) | Done | #683 @ `0ad9305`; no runtime apt; compose `init: true` + node fetch healthcheck |
| ACP-33 | Product positioning docs + README | Done | #686 @ `b0c5e01`; `docs/product/*` + README rewrite |
| ACP-34 | Engineering norms + ADRs | Done | #687 @ `aa354bf`; CONTRIBUTING, SECURITY, adr/0001–0006 |
| ACP-35 | Previewable docs site (VitePress) | In progress | `docs:dev`/`docs:build`; OpenAPI+MCP codegen; Pages/CF deploy; ADR-0007 — [#689](https://github.com/adlternative/agent-commerce/pull/689) |

## Rules
- Only this repo; never create/fork repos. Stop on push failure.
- Merge only with green CI; never weaken assertions.
- Per merge: workflow + PR# + sha + test count (files/tests).
