# Cycle 18 — Offline-first app shell shipped

## What shipped
- **Offline / local-first** (the last remaining ❌ in `FEATURE_MATRIX.md` — neither Linear nor Plane CE offer it):
  - `app/pb_public/sw.js` — Service Worker that pre-caches the complete static app shell (index.html, CSS, all vendor bundles, every component/API script), serves static assets cache-first, API/SSE network-first with cache fallback, and falls back to the cached shell for navigations when offline. Bumps `projectbase-shell-v1` on changes.
  - `app/pb_public/manifest.webmanifest` — PWA web manifest (standalone display, theme colors, icons) for installability.
  - `app/pb_public/vendor/icon-192.png` / `icon-512.png` — generated app icons.
  - `index.html` — registers the SW on load (progressive enhancement, non-fatal on failure) + links the web manifest; offline banner shown when `!isOnline`.
  - `app.js` — `isOnline` state bound to `navigator.onLine` via `online`/`offline` handlers.
- 5 new tests in `tests/test_api.py` (SW served, SW precache list, index registration, manifest valid + icons served, app online/offline handlers bound).

## Verification
- Full suite: **61 passed / 3 skipped** (was 59 pass; +5 offline tests, −3 GitHub rate-limit skips).
- `node --check` on sw.js + app.js; manifest parses as valid JSON.
- All new static assets served (200): `/sw.js`, `/manifest.webmanifest`, `/vendor/icon-192.png`, `/vendor/icon-512.png`.
- **Runtime SW validation (Node harness with mocked Service Worker globals):** all 37 shell entries pre-cached; static served cache-first offline (CACHED); navigation falls back to cached shell offline (CACHED-SHELL); API offline with no cache throws gracefully; API offline with a cached entry serves from cache; API online is network-first (FRESH). The full offline/cache-first/network-first contract is proven end-to-end.

## FOSS alignment
Offline/local-first is a pure FOSS differentiator — no monetization, fully self-contained, air-gapped-friendly. Aligns with the single-binary / Raspberry Pi moat.

## Post-ship hardening (deeper validation)
- **Bug found:** the SW's `/api/*` network-first branch also caught the PocketBase
  realtime **SSE stream** (`/api/realtime`). `cache.put(clone)` on an unbounded stream
  would hang the fetch handler and break live sync entirely.
- **Fix:** early passthrough for `/api/realtime` before the API branch (`sw.js`).
- **Regression guard:** `test_service_worker_excludes_realtime_sse` asserts the
  exclusion exists and precedes the `/api/` branch.
- **Runtime harness (11 checks, all PASS):** precache 37; realtime passthrough +
  not-cached; API online network-first; API offline no-cache rejects; static offline
  cache-first; nav offline shell fallback; stale-while-revalidate (cached hit online
  serves instantly + fires background refresh + heals the cache; cached hit offline
  still serves).
- **Staleness fix:** `cacheFirst` upgraded to stale-while-revalidate — a deploy that
  changes JS without bumping `CACHE_NAME` now heals on the next online visit instead of
  serving stale assets forever. (Icon false-alarm resolved: `WifiOff` exists in the
  vendored lucide bundle under PascalCase keys with `toPascalCase` kebab mapping.)

## Offline-boot audit (wave 4)
- **App resilience:** `loadAllData` catches failures with an error toast; `loadIssues`
  catches; SSE subscriptions warn-only — an offline boot renders the shell + banner, no crash.
- **Auth survives offline:** PocketBase SDK persists the auth store to `localStorage`
  (`pb_auth`), so `isAuthenticated` is true on an offline reload and cached data loads.
- **Cached data view proven:** a warmed API GET is served from the SW cache when offline
  (harness check "API offline cached-copy served"). Scope: read-only — there is **no write
  queue**, so offline mutations fail; the banner was reworded to say so honestly
  ("Edits need a connection; they are not queued").
- Harness now 12/12 PASS.

## Admin-UI isolation (wave 8)
- **Bug found:** offline navigation to PocketBase's admin UI (`/_/`) was hijacked by the
  SW's navigation fallback and served the ProjectBase SPA shell (wrong app). Proven with a
  harness probe before the fix.
- **Fix:** `/_/` paths are now excluded from SW interception entirely (passthrough).
- **Regression guard:** `test_service_worker_excludes_pocketbase_admin_ui`.
- Full 12-check runtime harness re-run: ALL PASS after the change.
