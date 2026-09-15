// Harden saved_views owner enforcement for databases that already applied
// migration 54. Additive migration: only updates the collection create rule.
migrate((app) => {
    let col = null
    try { col = app.findCollectionByNameOrId("saved_views") } catch (err) {}
    if (!col) return

    col.createRule = "@request.auth.id != '' && (@request.body.owner = '' || @request.body.owner = @request.auth.id)"
    app.save(col)
}, (app) => {
    let col = null
    try { col = app.findCollectionByNameOrId("saved_views") } catch (err) {}
    if (!col) return

    col.createRule = "@request.auth.id != ''"
    app.save(col)
})
