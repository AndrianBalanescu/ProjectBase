// pb_hooks/15_auth_schema.pb.js
// Multi-user auth foundation for public deployments.

onBootstrap((e) => {
    e.next()
    try {
        let users = null
        try { users = e.app.findCollectionByNameOrId("users") } catch (err) {}
        if (!users) {
            users = new Collection({
                name: "users",
                type: "auth",
                listRule: "@request.auth.role = 'admin'",
                viewRule: "id = @request.auth.id || @request.auth.role = 'admin'",
                createRule: "",
                updateRule: "id = @request.auth.id || @request.auth.role = 'admin'",
                deleteRule: "id = @request.auth.id || @request.auth.role = 'admin'",
                passwordAuth: { enabled: true, identityFields: ["email"] },
                fields: [
                    { name: "name", type: "text" },
                    { name: "role", type: "select", values: ["admin", "manager", "member", "agent"] },
                    { name: "avatar", type: "file", maxSelect: 1, maxSize: 2097152, thumbs: ["100x100"] }
                ]
            })
            e.app.save(users)
            console.log(">>> [ProjectBase Auth] Created users auth collection")
        }

        // Ensure project and issue records require an authenticated user in public deployments.
        for (let name of ["projects", "cycles", "milestones", "labels", "issues", "comments", "activity"]) {
            try {
                let col = e.app.findCollectionByNameOrId(name)
                if (col.listRule === "") col.listRule = "@request.auth.id != ''"
                if (col.viewRule === "") col.viewRule = "@request.auth.id != ''"
                if (col.createRule === "") col.createRule = "@request.auth.id != ''"
                if (col.updateRule === "") col.updateRule = "@request.auth.id != ''"
                if (col.deleteRule === "") col.deleteRule = "@request.auth.role = 'admin' || @request.auth.role = 'manager'"
                e.app.save(col)
            } catch (err) {
                console.warn(">>> [ProjectBase Auth] Rule update skipped for " + name)
            }
        }
    } catch (err) {
        console.error(">>> [ProjectBase Auth Error]:", err)
    }
})
