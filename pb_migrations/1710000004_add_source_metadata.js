// ProjectBase migration 4 — additive source_metadata JSON field on issues.
// Import provenance for the CSV importer (cycle 2). Purely additive + idempotent:
// adds the column if missing and never touches existing data or other fields.
// Safe on both existing installs and fresh installs.
migrate((app) => {
    try {
        const issues = app.findCollectionByNameOrId("issues")
        if (!issues) return // collection absent on fresh installs pre-0000; skip

        const existing = issues.fields.filter((f) => f.name === "source_metadata")
        if (existing.length === 0) {
            issues.fields.add(new JSONField({ name: "source_metadata" }))
            app.save(issues)
        }
    } catch (err) {
        // Non-fatal: fresh-install race with 0000; the collection is owned there.
        console.error("source_metadata migration skipped:", String((err && err.message) || err))
    }
})
