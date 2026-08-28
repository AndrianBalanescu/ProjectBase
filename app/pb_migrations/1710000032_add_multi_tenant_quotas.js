// ProjectBase migration 32 — Native Cross-Workspace Multi-Tenant Tenant Isolation & Granular Resource Quotas.
//
// Adds collections for Multi-Tenant Workspaces, Resource Quotas & Memberships (Epic 21):
//   1. tenants: Isolated workspace tenants with plan tiers and custom settings.
//   2. tenant_quotas: Granular resource allocations, limits, and enforcement modes.
//   3. tenant_memberships: Tenant-user-agent associations and workspace roles.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }

    const ensureCollection = (name, listRule, viewRule, fields) => {
        let col = null
        try { col = app.findCollectionByNameOrId(name) } catch (err) {}
        if (!col) {
            col = new Collection({
                name,
                type: "base",
                listRule,
                viewRule,
                createRule: null,
                updateRule: null,
                deleteRule: null,
            })
            fields.forEach(f => col.fields.add(f))
            app.save(col)
        } else {
            let changed = false
            fields.forEach(f => {
                if (!hasField(col, f.name)) {
                    col.fields.add(f)
                    changed = true
                }
            })
            if (changed) {
                app.save(col)
            }
        }
        return col
    }

    // 1. tenants
    ensureCollection("tenants", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("slug", { required: true }),
        text("description"),
        text("plan_tier"),
        bool("is_active"),
        text("owner"),
        json("settings"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 2. tenant_quotas
    ensureCollection("tenant_quotas", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("tenant", { required: true }),
        number("max_projects"),
        number("max_issues"),
        number("max_agents"),
        number("max_storage_mb"),
        number("max_monthly_api_calls"),
        number("max_workflow_runs"),
        text("enforcement_mode"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 3. tenant_memberships
    ensureCollection("tenant_memberships", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("tenant", { required: true }),
        text("user", { required: true }),
        text("role"),
        bool("is_active"),
        text("joined_at"),
        auto("created", true, false),
        auto("updated", true, true),
    ])
})
