// pb_migrations/1710000002_add_user_roles.js
migrate((app) => {
    try {
        let usersCol = app.findCollectionByNameOrId("users")
        let roleField = null
        try {
            roleField = usersCol.fields.getByName("role")
        } catch (e) {}

        if (!roleField) {
            usersCol.fields.add(new SelectField({
                name: "role",
                values: ["admin", "manager", "member", "agent"],
                maxSelect: 1
            }))
            app.save(usersCol)
            console.log(">>> [Migration] Added role field to users collection")
        }
    } catch (err) {
        console.log(">>> [Migration] Error adding role field: " + err.message)
    }
}, (app) => {})
