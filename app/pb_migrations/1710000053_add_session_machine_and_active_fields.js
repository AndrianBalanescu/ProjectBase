// ProjectBase migration 53 — Session-as-a-Card: `machine` + `is_active` on agent_sessions.
//
// The session feeder (scripts/pb_session_syncer.py) reports which host a session
// lives on (body.machine) and whether it is live (body.is_active / status). The
// ingest endpoint sets these, but agent_sessions never declared them, so PocketBase
// silently dropped the values (Record#set on an unknown field is a no-op). The UI's
// AgentsView machine filter and "online" indicator therefore read null and showed
// stale/empty data.
//
// Additive + idempotent: declares the two fields if missing, never alters existing
// columns. Safe on a fresh install (collection created with both fields).

migrate((app) => {
    function text(name, opts = {}) {
        return new Field({
            name,
            type: "text",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function bool(name, opts = {}) {
        return new Field({
            name,
            type: "bool",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function ensureCollection(name, listRule = "", viewRule = "", fields = []) {
        let col
        try {
            col = app.findCollectionByNameOrId(name)
        } catch (_) {
            col = new Collection({
                name,
                type: "base",
                listRule: listRule !== undefined ? listRule : "",
                viewRule: viewRule !== undefined ? viewRule : "",
                createRule: "",
                updateRule: "",
                deleteRule: ""
            })
            fields.forEach(f => col.fields.add(f))
            try {
                col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }))
                col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
            } catch (_) {}
            app.save(col)
            return col
        }

        let updated = false
        if (listRule !== undefined && col.listRule !== listRule) {
            col.listRule = listRule
            updated = true
        }
        if (viewRule !== undefined && col.viewRule !== viewRule) {
            col.viewRule = viewRule
            updated = true
        }
        fields.forEach(f => {
            if (!col.fields.getByName(f.name)) {
                col.fields.add(f)
                updated = true
            }
        })
        if (updated) {
            app.save(col)
        }
        return col
    }

    // agent_sessions already exists (created in migration 35). Add the two columns.
    ensureCollection("agent_sessions", "", "", [
        // Which host this session was ingested from (hostname / /etc/machine-id).
        text("machine", { max: 255 }),
        // Live/online indicator driven by the feeder (status running/verifying or
        // explicit is_active). Lets the UI render a real "online" state.
        bool("is_active", { presentable: true })
    ])
})
