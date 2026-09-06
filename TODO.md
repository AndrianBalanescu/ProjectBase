# TODO — ProjectBase

## Cycle 76 (harden)

- [x] **Cycle-75 veto investigated and proven false-positive.** The inspect session was killed at timeout before writing `/tmp/flow-inspect-result.json`; the supervisor's log-fallback regex matched `FAILED_AUDIT`/`BINDING_VETO` tokens that appear in quoted skill instructions inside the log. Substance check: full suite 606/606 green on live 8120, all cycle-74/75 findings already resolved by PR #26 (6205bb2).
- [x] **Inspect's open anomaly root-caused** (activity record 404-by-id on instrumented instances): PocketBase 0.39.11 first-boot quirk — on a fresh data dir, the records API is blind to rows in migration-created collections (even API-written ones) until the process restarts. Minimal repro: saving the same collection twice within migrations breaks first-boot visibility. Live instance unaffected. Fix shipped in 8067a80 (`scripts/serve-firstboot.sh` wired into Dockerfile ENTRYPOINT + systemd unit) and ec4cc4e (`__SCRIPTS_DIR__` placeholder).
- [x] **Data hygiene:** 3 orphan activity rows (issue refs pointing at deleted fixture issues) deleted via API; verified 0 remaining and cascadeDelete works (probe created→deleted issue with activity rows gone).
- [ ] **flomaster engine bug to file as PR (engine read-only this phase):** `flow/supervisor.py` `inspect_verdict()` log fallback matches `FAILED_AUDIT|BINDING_VETO` tokens anywhere in the inspect log, including quoted skill instructions and stale result JSON from a previous cycle. Two concrete fixes: (1) exclude matches inside quoted skill text / markdown fences, (2) ignore result JSON whose `cycle` field is older than the current cycle instead of only "matching current cycle counts".
- [ ] Upstream: report PB 0.39.11 first-boot records-invisibility to PocketBase (minimal repro: two-migration double-save of a collection + seeded row; API rules evaluate as anonymous on first boot, heal on restart).

## Standing rules

- Frontend changes require iBrowse QA (0 console errors / 0 4xx-5xx) before HAD_WORK.
- Every cycle that touches real code ends with a structured ProjectBase audit comment.
- DEV_MODE=harden: bugfixes only, no new features.