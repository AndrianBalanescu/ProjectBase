// pb_migrations/1710000001_harden_auth_rules.js
migrate((app) => {
    const authRule = "@request.auth.id != ''"
    const adminOrManagerRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'"

    const targetCollections = ["projects", "cycles", "milestones", "labels", "issues", "comments", "activity"]

    for (let name of targetCollections) {
        try {
            let col = app.findCollectionByNameOrId(name)
            col.listRule = authRule
            col.viewRule = authRule
            col.createRule = authRule
            col.updateRule = authRule
            col.deleteRule = adminOrManagerRule
            app.save(col)
            console.log(">>> [Migration] Hardened auth rules for: " + name)
        } catch (err) {
            console.log(">>> [Migration] Skipping collection: " + name + " (" + err.message + ")")
        }
    }

    try {
        let usersCol = app.findCollectionByNameOrId("users")
        usersCol.listRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'"
        usersCol.viewRule = "id = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'manager'"
        usersCol.createRule = "@request.auth.role = 'admin'"
        usersCol.updateRule = "id = @request.auth.id || @request.auth.role = 'admin'"
        usersCol.deleteRule = "@request.auth.role = 'admin'"
        app.save(usersCol)
        console.log(">>> [Migration] Hardened auth rules for users collection")
    } catch (err) {}
}, (app) => {
    // Reversible if needed
})
