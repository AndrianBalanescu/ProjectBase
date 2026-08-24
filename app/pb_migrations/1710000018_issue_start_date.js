// ProjectBase migration 18 — additive `start_date` on issues for the Timeline view
//
// The Gantt/timeline view (v1.1, roadmap "Next" after cycle-18) renders issue
// bars between a start and an end. Issues already carry `due_date`; this
// migration adds the missing nullable `start_date` (date only, no time) so
// schedule bars can be drawn. It is purely additive and safe on existing data:
// issues without a start date default to the cycle start (or created date) in
// the UI and render as milestones on the timeline.
migrate((app) => {
    const date = (name) => new DateField({ name })

    let collection
    try { collection = app.findCollectionByNameOrId("issues") } catch (err) { return }

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }

    if (!hasField(collection, "start_date")) {
        collection.fields.add(date("start_date"))
        app.save(collection)
        console.log(">>> [Migration] Added issues.start_date")
    } else {
        console.log(">>> [Migration] issues.start_date already present")
    }
}, (app) => {
    // Downgrade is an explicit operator action; no automatic removal.
})
