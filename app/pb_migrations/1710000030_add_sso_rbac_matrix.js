// ProjectBase migration 30 — Enterprise OIDC / SAML SSO Federation & Granular Workspace RBAC Matrix.
//
// Adds collections for SSO Federation, RBAC Matrix, Assignments & Security Audit Logging (Epic 19):
//   1. sso_providers: SSO Identity Providers (Google, GitHub Enterprise, Okta, Keycloak, OIDC/SAML).
//   2. rbac_roles: Custom and system roles with granular capability mappings.
//   3. rbac_assignments: User and agent role assignments across workspaces and projects.
//   4. rbac_scoped_tokens: Scoped API access tokens with capability constraints and TTL.
//   5. security_audit_logs: Immutable security and access audit event trail.

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

    // 1. SSO Providers collection
    ensureCollection("sso_providers", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("provider_key", { required: true, max: 64 }),
        text("name", { required: true, max: 128 }),
        text("provider_type", { required: true, max: 32 }), // oidc, oauth2, saml
        text("issuer_url", { max: 512 }),
        text("client_id", { max: 256 }),
        text("client_secret", { max: 512 }),
        text("discovery_url", { max: 512 }),
        text("authorization_endpoint", { max: 512 }),
        text("token_endpoint", { max: 512 }),
        text("userinfo_endpoint", { max: 512 }),
        text("scopes", { max: 256 }),
        bool("jit_provisioning"),
        text("default_role", { max: 64 }),
        bool("enabled"),
        json("metadata"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 2. RBAC Roles collection
    ensureCollection("rbac_roles", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("role_key", { required: true, max: 64 }),
        text("name", { required: true, max: 128 }),
        text("description", { max: 512 }),
        bool("is_system"),
        json("capabilities"),
        text("project_id", { max: 64 }),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 3. RBAC Assignments collection
    ensureCollection("rbac_assignments", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("user_id", { required: true, max: 128 }),
        text("user_type", { required: true, max: 32 }), // user, agent, service_account
        text("role_key", { required: true, max: 64 }),
        text("project_id", { max: 64 }),
        text("assigned_by", { max: 128 }),
        text("expires_at", { max: 64 }),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 4. Scoped API Tokens
    ensureCollection("rbac_scoped_tokens", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("token_id", { required: true, max: 64 }),
        text("token_hash", { required: true, max: 128 }),
        text("name", { required: true, max: 128 }),
        text("user_or_agent_id", { required: true, max: 128 }),
        json("scopes"),
        text("project_id", { max: 64 }),
        text("status", { max: 32 }), // active, revoked, expired
        text("expires_at", { max: 64 }),
        text("last_used_at", { max: 64 }),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 5. Security Audit Logs
    ensureCollection("security_audit_logs", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("event_type", { required: true, max: 64 }),
        text("actor_id", { required: true, max: 128 }),
        text("actor_type", { required: true, max: 32 }), // user, agent, system, anonymous
        text("action", { required: true, max: 128 }),
        text("target_resource", { max: 256 }),
        text("status", { required: true, max: 32 }), // success, denied, error
        text("ip_address", { max: 64 }),
        text("user_agent", { max: 256 }),
        json("details"),
        auto("created", true, false),
    ])
}, (app) => {
    // Reversible down migration
    const dropCollection = (name) => {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) app.delete(col)
        } catch (err) {}
    }
    dropCollection("security_audit_logs")
    dropCollection("rbac_scoped_tokens")
    dropCollection("rbac_assignments")
    dropCollection("rbac_roles")
    dropCollection("sso_providers")
})
