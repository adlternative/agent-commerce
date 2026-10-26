# Workflow status (W1–W8)

Repo: [adlternative/agent-commerce](https://github.com/adlternative/agent-commerce)

| ID | Workflow | Status | Notes |
|----|----------|--------|-------|
| W1 | Server/MCP runtime compile + CI smoke | Done | `tsconfig.server.json` → `dist-server/`; boot + MCP stdio smokes; landed in #630 |
| W2 | SQLite persistence + migrations | Queued | May change package.json |
| W3 | Payment webhook, inventory hold, fulfillment | Done | Webhook idempotency + 15m hold auto-release + ship/receive/refund loop |
| W4 | Full-text search, agentNotes ranking, cursors | Queued | |
| W5 | Structured logs, metrics, OpenAPI regression | In progress | |
| W6 | API Key/JWT, RBAC, rate limit, audit API | Queued | |
| W7 | E2E customer order + merchant ship | Queued | |
| W8 | MCP resources, prompts, errors, sampling | Queued | |

## Rules
- Only this repo; never create/fork repos. Stop on push failure.
- Merge only with green CI; never weaken assertions.
- Per merge: workflow + PR# + sha + test count (files/tests).
