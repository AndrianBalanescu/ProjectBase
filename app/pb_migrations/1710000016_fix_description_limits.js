// pb_migrations/1710000016_fix_description_limits.js
// Re-applies the description-limit raise that 1710000014 and 1710000015
// failed to persist, using the correct PocketBase 0.39 field API.
//
// History:
//   - 1710000014 used `collection.fields.find(...)` which returns a detached
//     copy (or undefined); the mutation never reached the persisted schema.
//   - 1710000015 switched to `collection.fields.getByName(...)` but guarded on
//     `field.type !== "text"`. On PocketBase 0.39 `getByName` returns a field
//     whose `.type` is a getter function, not the string "text", so that guard
//     was always true and the save was silently skipped.
//
// This migration raises each long-form text field's max to 100000, guarding
// only on `field.max` (never on `field.type`). It is idempotent: a field is
// only saved when its current max is lower than the target.
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

        const field = collection.fields.getByName(fieldName)
        if (!field) continue

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
