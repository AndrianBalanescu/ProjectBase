# Cycle 16 — Custom Fields shipped

## What shipped
- **Custom fields** (the confirmed `FEATURE_MATRIX.md` GAP, roadmap cycle-3 item):
  - `app/pb_migrations/1710000009_custom_fields.js` — additive, idempotent JSON columns: `issues.custom_fields`, `projects.custom_field_defs`.
  - `app/pb_hooks/35_custom_fields.pb.js` — `GET/PUT/POST validate` endpoints at `/api/projectbase/projects/{id}/custom-fields*`. Field types: text, number, select, checkbox, date. Validates required + type + select options; rejects unsupported types, empty select options, and duplicate keys.
  - `app/pb_public/js/components/CustomFieldsModal.js` + `Fields` button in `Header.js` — per-project definition manager.
  - `IssueDrawer.js` renders/edits custom field values and persists them via `custom_fields`.
  - `app/pb_public/js/api.js` — `getCustomFields` / `saveCustomFields`.
- 5 new tests in `tests/test_api.py` (auth guard, get/put, invalid rejection, validation, issue roundtrip).

## Verification
- Full suite: **55/55 pass** (against live server on :8120 and scratch :8131).
- Live end-to-end curl: columns exist, define → validate → issue roundtrip all work.
- iBrowse inspections report **zero console errors / zero network failures**; all components incl. CustomFieldsModal.js loaded. (Login-click navigation blocked in iBrowse agent, not a code defect.)

## FOSS alignment
Prior-cycle Stripe/billing/waitlist work was correctly excluded per `GOAL.md` STRICT FOSS constraints. This cycle ships a FOSS-only feature.

## Note
Concurrent agent commits (Milkdown rich editor integration 7fb2ce2/0433db9) landed alongside; repo is clean and synced to origin/main.
