# Dependency upgrade audit (Task 8)

Date: 2026-10-24  
Branch: `adl/dev/deps-audit-task8-6f52`  
Scope: upgrade every direct dependency reported by `npm outdated` to **Latest**, one package at a time, keeping `npm test` / `npm run build` green.

## Baseline (`npm outdated` before upgrades)

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

Notes:

- `Current === Wanted` for all rows: caret ranges in `package.json` were already at the latest within-range resolve; upgrades required jumping majors to reach `Latest`.
- Baseline: `npm test` PASS (1 file / 1 test), `npm run build` PASS (vite 5.4.21).

## Upgrade order and results

Packages were upgraded one-by-one (or as a tightly coupled pair). After each step: `npm test` then `npm run build`.

| # | Change | From → To | `npm test` | `npm run build` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `typescript` | 5.9.3 → 7.0.2 | PASS | FAIL → PASS | TS2882 on `import './styles.css'`. Fixed by adding `src/vite-env.d.ts` with `/// <reference types="vite/client" />`. Re-ran; both green. |
| 2 | `vite` | 5.4.21 → 8.3.5 | PASS | PASS | Peer warning vs `@vitejs/plugin-react@4` (expected until step 3). Deprecation noise from old react-babel plugin. |
| 3 | `@vitejs/plugin-react` | 4.7.0 → 6.1.2 | PASS | PASS | Peer/deprecation warnings cleared. |
| 4 | `vitest` | 2.1.9 → 5.0.5 | PASS | PASS | `npm audit` dropped to 0 vulnerabilities after this step. |
| 5 | `react` + `react-dom` | 18.3.1 → 19.3.1 | PASS | PASS | Upgraded as a pair (runtime must stay in sync). Bundle size increased (~141 kB → ~220 kB JS) as expected for React 19. |
| 6 | `@types/react` + `@types/react-dom` | 18.x → 19.3.0 | PASS | PASS | Types aligned with React 19. |

## Follow-up code change required by upgrades

- **`src/vite-env.d.ts`** (new): Vite client types so TypeScript 7 accepts CSS side-effect imports. Without this, `tsc --noEmit` fails with `TS2882`.

No other source or config edits were required for Vite 8 / Vitest 5 / React 19 on this skeleton.

## Final verification

```text
$ npm outdated
(empty — all direct deps at Latest)

$ npm test
Test Files  1 passed (1)
Tests  1 passed (1)
RUN  v5.0.5

$ npm run build
tsc --noEmit && vite build → PASS (vite v8.3.5)

$ npm audit
found 0 vulnerabilities
```

## Final `package.json` dependency versions

| Package | Range after upgrade |
| --- | --- |
| `react` | `^19.3.1` |
| `react-dom` | `^19.3.1` |
| `@types/react` | `^19.3.0` |
| `@types/react-dom` | `^19.3.0` |
| `@vitejs/plugin-react` | `^6.1.2` |
| `typescript` | `^7.0.2` |
| `vite` | `^8.3.5` |
| `vitest` | `^5.0.5` |

## Risk / follow-ups

- Major bumps (React 19, Vite 8, Vitest 5, TypeScript 7) landed cleanly on the current skeleton (smoke test only). Feature work from other ISSUES.md tasks should re-run `npm test` / `npm run build` after merge.
- React 19 client bundle is larger; revisit only if product size budgets matter later.
