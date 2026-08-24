// pb_migrations/1710000007_lift_description_limits.js
// Raises the PocketBase text field character limit on long-form content fields
// (issues.description, comments.content, projects.description, cycles.description,
// milestones.description, labels.description) from the default 5000 to 100000.
//
// Context (cycle 5): the distraction-free description focus mode is meant for
// long-form writing, but PocketBase TextField defaults to max 5000 characters,
// so saving an 8000-char description failed with
// validation_max_text_constraint ("Must be no more than 5000 character(s)").
// This is additive and idempotent: each field's max is only raised when it is
// currently lower, so re-running on older/newer installs is safe.
migrate((app) => {
    const TARGET_MAX = 100000
    const LONG_FIELDS = [
        ["issues", "description"],
        ["comments", "content"],
        ["projects", "description"],
        ["cycles", "description"],
        ["milestones", "description"],
        ["labels", "description"],
    ]

    for (const [collectionName, fieldName] of LONG_FIELDS) {
        const collection = app.findCollectionByNameOrId(collectionName)
        if (!collection) continue

        const field = collection.fields.find((f) => f.name === fieldName && f.type === "text")
        if (!field) continue

        // PocketBase 0.39 TextField exposes `max` (character limit).
        const currentMax = typeof field.max === "number" ? field.max : 0
        if (currentMax === 0 || currentMax < TARGET_MAX) {
            field.max = TARGET_MAX
            app.save(collection)
        }
    }
}, (app) => {
    // Downgrade is data-preserving: leave the raised limits in place.
    // Lowering max below existing content would reject previously-saved rows.
})
