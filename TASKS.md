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
| W9-2 | Metrics path cardinality cap | Queued | After W9-1 |
| W9-3 | Agent scope split | Queued | After W9-1 |
| W9-4 | Playwright free port | Done | [#643](https://github.com/adlternative/agent-commerce/pull/643) Prefer `PW_PORT` / auto-pick when occupied; `reuseExistingServer: false`; 31 files / 149 unit + 2 e2e |

## Rules
- Only this repo; never create/fork repos. Stop on push failure.
- Merge only with green CI; never weaken assertions.
- Per merge: workflow + PR# + sha + test count (files/tests).
