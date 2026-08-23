// ProjectBase migration 9 — additive custom fields.
//
// Adds two purely additive, idempotent JSON columns:
//   1. issues.custom_fields      — per-issue values keyed by field slug
//      e.g. { "effort": 5, "client": "Acme", "qa_signoff": true }
//   2. projects.custom_field_defs — ordered list of field definitions scoped to
//      that project, e.g.
//      [
//        { "key": "client", "label": "Client", "type": "text", "required": false },
//        { "key": "effort", "label": "Effort (pts)", "type": "number", "options": [] }
//      ]
//
// Supported types: text, number, select, checkbox, date.
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

    ensureField("issues", "custom_fields")
    ensureField("projects", "custom_field_defs")
    console.log(">>> [Migration] Custom fields columns ensured (issues.custom_fields, projects.custom_field_defs)")
})
