# Dependency upgrade audit

**Task:** ISSUES.md #8 — `chore: 依赖升级审计`  
**Date:** 2026-10-24  
**Method:** `npm outdated` → upgrade each direct dependency one-by-one → `npm test` after each step → final `npm outdated` clean.

## Baseline (`npm outdated`)

| Package | Current | Wanted | Latest |
| --- | --- | --- | --- |
| `@types/react` | 18.3.31 | 18.3.31 | 19.3.0 |
| `@types/react-dom` | 18.3.7 | 18.3.7 | 19.3.0 |
| `@vitejs/plugin-react` | 4.7.0 | 4.7.0 | 6.1.2 |
| `react` | 18.3.1 | 18.3.1 | 19.3.1 |
| `react-dom` | 18.3.1 | 18.3.1 | 19.3.1 |
| `typescript` | 5.9.3 | 5.9.3 | 7.0.2 |
| `vite` | 5.4.21 | 5.4.21 | 8.3.5 |
| `vitest` | 2.1.9 | 2.1.9 | 5.0.5 |

All packages were already at the caret `Wanted` max; upgrades required major-range bumps to reach `Latest`.

## Upgrade log (one package per step)

| # | Package | From → To | `npm test` |
| --- | --- | --- | --- |
| 1 | `typescript` | 5.9.3 → **7.0.2** | pass |
| 2 | `react` | 18.3.1 → **19.3.1** | pass |
| 3 | `react-dom` | 18.3.1 → **19.3.1** | pass |
| 4 | `@types/react` | 18.3.31 → **19.3.0** | pass |
| 5 | `@types/react-dom` | 18.3.7 → **19.3.0** | pass |
| 6 | `vite` | 5.4.21 → **8.3.5** | pass |
| 7 | `@vitejs/plugin-react` | 4.7.0 → **6.1.2** | pass |
| 8 | `vitest` | 2.1.9 → **5.0.5** | pass |

## Follow-up fix (TypeScript 7)

`tsc` under TypeScript 7.0.2 rejected the CSS side-effect import in `src/main.tsx` (`TS2882`). Added:

- `src/vite-env.d.ts` with `/// <reference types="vite/client" />`
- `vite/client` in `tsconfig.json` `compilerOptions.types`

After that, `npm run build` and `npm test` both succeed.

## Final state

| Package | Installed |
| --- | --- |
| `react` | 19.3.1 |
| `react-dom` | 19.3.1 |
| `@types/react` | 19.3.0 |
| `@types/react-dom` | 19.3.0 |
| `@vitejs/plugin-react` | 6.1.2 |
| `typescript` | 7.0.2 |
| `vite` | 8.3.5 |
| `vitest` | 5.0.5 |

**Acceptance**

- [x] `npm outdated` (baseline recorded above)
- [x] Packages upgraded one-by-one with tests after each step
- [x] `npm test` all green (final: vitest 5.0.5 — 1 file / 1 test)
- [x] Final `npm outdated` — empty (no remaining outdated directs)
- [x] This report at `docs/deps-audit.md`
