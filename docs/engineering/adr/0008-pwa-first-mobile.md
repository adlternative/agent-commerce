# ADR 0008: PWA-first mobile (defer Expo / React Native)

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Customer and merchant UIs already ship as a single Vite + React 18 SPA (`src/App.tsx`, `src/merchant/MerchantApp.tsx`, hash routes in `src/main.tsx`). Mobile installability and an offline shell are needed without paid app-store distribution. Options: Progressive Web App on the existing SPA vs Expo / React Native.

| Dimension | PWA (reuse Vite React) | Expo / React Native |
|-----------|------------------------|---------------------|
| **Reuse React UI** | Direct reuse of components, CSS, and `src/api/*` clients | Near-rewrite: no DOM CSS; new navigation, layout, and packaging |
| **Offline** | Service worker caches app shell + offline fallback; API still needs network (commerce writes) | Stronger offline story via native storage, but still needs API for orders |
| **Push** | Web Push possible later; **尚未实现** (no VAPID keys, no push subscription API) | Native push via Expo Notifications; **尚未实现** and implies store/credentials cost |
| **Release cost** | Deploy static `dist/` with existing Docker/`STATIC_DIR` — zero store fees | Apple Developer + Google Play accounts, review cycles, signing |
| **Store listing** | Optional later (TWA / store wrappers); not required for MVP | Required for distribution through App Store / Play |

Code strongly favors reuse: there is no native module surface today, and the product is self-hosted open source (see `docs/product/POSITIONING.md`). Nothing in the tree requires device APIs that only native provides.

## Decision

**PWA-first.** Keep one React SPA; make it installable via Web App Manifest + service worker + icons + offline fallback under `public/`. Do **not** introduce Expo/RN until a concrete native-only requirement appears (camera barcode, background geolocation, mandatory store listing, etc.).

| Capability | Status |
|------------|--------|
| Manifest + icons + installable shell | This change (`public/manifest.webmanifest`, `public/icons/`, `index.html`) |
| Service worker + offline fallback | This change (`public/sw.js`, `public/offline.html`) |
| Mobile viewport customer order E2E | This change (`e2e/mobile-customer-order.spec.ts`) |
| Web Push / Push API | **尚未实现** |
| Native iOS/Android (Expo/RN) | **尚未实现** — deferred |
| App Store / Play listing | **尚未实现** — out of scope (no paid store) |

## Consequences

- One codebase continues to serve desktop, mobile browser, and “Add to Home Screen”.
- Offline is shell-only: placing/paying orders still requires API reachability; SW must not invent commerce state.
- Push and rich native features stay explicit gaps (`尚未实现`) rather than half-wired SDKs.
- Future Expo/RN would be a new ADR and a separate app package — not an incremental edit to `src/App.tsx`.

## Alternatives

1. **Expo / React Native now** — Rejected: duplicates UI, adds store/signing cost, and the current SPA already covers the customer order path at mobile viewport.
2. **Capacitor / Cordova wrapper** — Rejected for MVP: extra native shell without solving reuse better than a PWA; revisit only if a store listing becomes mandatory.
3. **No mobile client** — Rejected: customer order flow must be usable on phone viewports; Playwright mobile project guards regressions.
