// ProjectBase migration 55 — repair legacy non-array `labels` rows.
//
// Cycle 86 hardened the issue hooks so scalar `labels` writes are rejected
// with a 400, but four rows created earlier the same day (pre-guard window)
// persisted the raw string (e.g. labels="not-an-array"). Those rows crash
// every frontend label iteration (`(issue.labels || []).forEach`): the
// `|| []` coalescer only catches null/undefined, so a string survives it and
// TypeError-blanks the entire List/Kanban view (caught by
// scripts/qa/verify_listview_sorting.js at cycle 94).
//
// This migration is a pure data repair, additive and idempotent:
//   - labels stored as a JSON array string (e.g. '["bug"]') -> parsed array
//   - labels stored as any other scalar -> []
// Fresh installs are unaffected (no rows match). New writes are already
// guarded by app/pb_hooks/20_issue_hooks.pb.js on both create and update.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("issues")
    const rows = app.findRecordsByFilter(collection, "labels != NULL && labels != ''", "", 0, 0)
    let repaired = 0
    for (const row of rows) {
        const raw = row.get("labels")
        if (Array.isArray(raw)) continue
        let next = []
        if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) next = parsed
            } catch (err) { /* scalar string -> [] */ }
        }
        row.set("labels", next)
        app.save(row)
        repaired++
    }
    if (repaired > 0) {
        console.log(">>> [Migration] repaired non-array labels rows: " + repaired)
    }
}, (app) => {
    // Down: irreparable data repair — no-op by design (old rows were invalid).
})
