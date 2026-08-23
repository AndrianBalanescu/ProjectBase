// ProjectBase migration 13 — issue relationships (blocks / blocked_by / related).
//
// Adds one purely additive, idempotent JSON column:
//   issues.relations — array of directed relation edges, e.g.
//     [
//       { "issue": "abc123def456ghi", "type": "blocks" },
//       { "issue": "xyz789uvw012abc", "type": "related" }
//     ]
//
// Types: blocks, blocked_by, related.
// Reciprocal edges (A blocks B <=> B blocked_by A) are maintained by the
// custom routes in 32_issue_relations.pb.js, never by this migration.
//
// Purely additive: never touches existing data or other fields. Safe on both
// existing installs and fresh installs.
migrate((app) => {
    const ensureField = (collectionName, fieldName) => {
        try {
            const col = app.findCollectionByNameOrId(collectionName)
            if (!col) return
            const existing = col.fields.filter((f) => f.name === fieldName)
            if (existing.length === 0) {
                col.fields.add(new JSONField({ name: fieldName }))
                app.save(col)
            }
        } catch (err) {
            // Non-fatal: fresh-install race with 0000; the collection is owned there.
            console.error(`${fieldName} migration skipped:`, String((err && err.message) || err))
        }
    }

    ensureField("issues", "relations")
    console.log(">>> [Migration] Issue relations column ensured (issues.relations)")
})
