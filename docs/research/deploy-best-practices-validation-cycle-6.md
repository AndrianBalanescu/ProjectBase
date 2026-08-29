# Cycle 6 — Demo deployment best practices: validation record (2026-08-23)

Scout engines for this cycle were degraded (`sonar` / `multi-source-research`
binaries missing from the job PATH — raw outputs show `SCOUT_SKIPPED`). The cycle-6 deploy
design was therefore validated directly against primary sources and live execution instead:

## 1. Official PocketBase v0.39.11 production docs (pocketbase.io/docs/going-to-production)
- **App structure** `pocketbase + pb_migrations/ + pb_hooks/` — matches our Docker image
  exactly (plus `pb_public/`); CI docker job builds and boots this structure green.
- **TLS/HTTPS**: official path is built-in Let's Encrypt via `pocketbase serve <domain>`
  (root/setcap for :80/:443). Our `--domain` mode uses a Caddy sidecar (compose override)
  because the app container is unprivileged; Caddy is the standard PB-recommended proxy
  equivalent for docker deployments. Both are ACME-based; documented alternative kept.
- **`/api/health`** used as the deploy health probe — verified live 200 + in CI logs.

## 2. Caddy TLS layer validated with the real binary
- `caddy validate --config deploy/Caddyfile` (with `DEMO_DOMAIN` env): **Valid configuration**.
- `caddy adapt --pretty`: compiles to a `:443` server, host match, HSTS/nosniff/referrer
  headers, `reverse_proxy projectbase:8120`, zstd/gzip encode. No manual JSON needed.

## 3. Live end-to-end proof (fresh git clone, spare port)
- deploy-demo.sh: build → boot → superuser → health 200 → 6 projects / 17 issues seeded.
- reset-demo.sh round-trip: mutate (18 issues) → reset → pristine 6/17, junk records 0.

## Residual gaps / next actions
- `--install-cron` /etc/cron.d write: static, not yet exercised on a real host.
- Scout PATH fix belongs to the engine repo (read-only for Build Flow); rerun sonar scouts
  before the public launch announcement for competitive/demo-page patterns.
