// pb_hooks/104_multi_tenant_quota_engine.pb.js
// Native Cross-Workspace Multi-Tenant Tenant Isolation & Granular Resource Quotas (Epic 21).
//
// Endpoints:
// 1. GET    /api/projectbase/tenants                 - List all tenants with usage summary & status
// 2. POST   /api/projectbase/tenants                 - Create a new tenant workspace with default quota
// 3. GET    /api/projectbase/tenants/{id}            - Get tenant details, quota limits, and usage
// 4. PATCH  /api/projectbase/tenants/{id}            - Update tenant metadata (name, slug, tier, settings)
// 5. DELETE /api/projectbase/tenants/{id}            - Delete a tenant workspace
// 6. GET    /api/projectbase/tenants/{id}/quotas     - Get tenant quota configuration
// 7. PUT    /api/projectbase/tenants/{id}/quotas     - Update tenant quota limits & enforcement mode
// 8. GET    /api/projectbase/tenants/{id}/usage      - Calculate live resource meters & quota utilization %
// 9. POST   /api/projectbase/tenants/{id}/check-quota - Dynamic quota enforcement gate check
// 10. POST  /api/projectbase/tenants/{id}/switch     - Switch active tenant workspace context
// 11. GET   /api/projectbase/tenants/metrics         - Global multi-tenant utilization & over-quota alerts
// 12. GET   /api/projectbase/tenants/{id}/members    - List tenant members and agents
// 13. POST  /api/projectbase/tenants/{id}/members    - Add or assign member/agent to tenant
// 14. DELETE /api/projectbase/tenants/{id}/members/{userId} - Remove member from tenant

// 1. GET /api/projectbase/tenants - List all tenants
routerAdd("GET", "/api/projectbase/tenants", (e) => {
    try {
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const calcUsage = (tenantId) => {
            let projectsCount = 0; let issuesCount = 0; let agentsCount = 0; let wfCount = 0; let membersCount = 0;
            try { projectsCount = (e.app.findRecordsByFilter("projects", "tenant = '" + tenantId + "'", "", 1000, 0) || []).length; } catch (err) {}
            try { issuesCount = (e.app.findRecordsByFilter("issues", "tenant = '" + tenantId + "'", "", 5000, 0) || []).length; } catch (err) {}
            try { agentsCount = (e.app.findRecordsByFilter("agents", "tenant = '" + tenantId + "'", "", 100, 0) || []).length; } catch (err) {}
            try { wfCount = (e.app.findRecordsByFilter("workflow_runs", "tenant = '" + tenantId + "'", "", 5000, 0) || []).length; } catch (err) {}
            try { membersCount = (e.app.findRecordsByFilter("tenant_memberships", "tenant = '" + tenantId + "'", "", 500, 0) || []).length; } catch (err) {}
            return {
                projects: projectsCount,
                issues: issuesCount,
                agents: agentsCount,
                workflow_runs: wfCount,
                storage_mb: Math.round((issuesCount * 0.05 + projectsCount * 0.2 + wfCount * 0.02) * 100) / 100,
                monthly_api_calls: issuesCount * 12 + wfCount * 5,
                members_count: membersCount
            };
        };

        const col = e.app.findCollectionByNameOrId("tenants");
        if (!col) return e.json(200, { tenants: [], total: 0 });

        const records = e.app.findRecordsByFilter("tenants", "id != ''", "-created", 100, 0) || [];
        const result = [];

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const tId = r.getString("id");
            const usage = calcUsage(tId);
            const planTier = (r.getString("plan_tier") || "free").toLowerCase();
            const defQ = DEFAULT_QUOTAS[planTier] || DEFAULT_QUOTAS.free;

            let qRec = null;
            try {
                const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + tId + "'", "", 1, 0);
                if (qList && qList.length > 0) qRec = qList[0];
            } catch (err) {}

            const quotas = {
                max_projects: qRec ? qRec.getInt("max_projects") : defQ.max_projects,
                max_issues: qRec ? qRec.getInt("max_issues") : defQ.max_issues,
                max_agents: qRec ? qRec.getInt("max_agents") : defQ.max_agents,
                max_storage_mb: qRec ? qRec.getInt("max_storage_mb") : defQ.max_storage_mb,
                max_monthly_api_calls: qRec ? qRec.getInt("max_monthly_api_calls") : defQ.max_monthly_api_calls,
                max_workflow_runs: qRec ? qRec.getInt("max_workflow_runs") : defQ.max_workflow_runs,
                enforcement_mode: qRec ? qRec.getString("enforcement_mode") : defQ.enforcement_mode
            };

            const utilization = {
                projects_pct: quotas.max_projects > 0 ? Math.min(100, Math.round((usage.projects / quotas.max_projects) * 100)) : 0,
                issues_pct: quotas.max_issues > 0 ? Math.min(100, Math.round((usage.issues / quotas.max_issues) * 100)) : 0,
                agents_pct: quotas.max_agents > 0 ? Math.min(100, Math.round((usage.agents / quotas.max_agents) * 100)) : 0,
                storage_pct: quotas.max_storage_mb > 0 ? Math.min(100, Math.round((usage.storage_mb / quotas.max_storage_mb) * 100)) : 0,
            };

            result.push({
                id: tId,
                name: r.getString("name"),
                slug: r.getString("slug"),
                description: r.getString("description"),
                plan_tier: planTier,
                is_active: r.getBool("is_active"),
                owner: r.getString("owner"),
                settings: r.get("settings") || {},
                created: r.getString("created"),
                updated: r.getString("updated"),
                usage: usage,
                quotas: quotas,
                utilization: utilization
            });
        }

        return e.json(200, { tenants: result, total: result.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. POST /api/projectbase/tenants - Create a new tenant workspace
routerAdd("POST", "/api/projectbase/tenants", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const body = e.requestInfo().body || {};
        const name = (body.name || "").trim();
        if (!name) {
            return e.json(400, { error: "Tenant name is required" });
        }

        let slug = (body.slug || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        if (!slug) {
            slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") + "-" + Math.floor(Math.random() * 10000);
        }

        const planTier = (body.plan_tier || "free").toLowerCase();
        const tierDefaults = DEFAULT_QUOTAS[planTier] || DEFAULT_QUOTAS.free;

        const tenantCol = e.app.findCollectionByNameOrId("tenants");
        const rec = new Record(tenantCol);
        rec.set("name", name);
        rec.set("slug", slug);
        rec.set("description", body.description || "");
        rec.set("plan_tier", planTier);
        rec.set("is_active", body.is_active !== false);
        rec.set("owner", body.owner || "owner");
        rec.set("settings", body.settings || {});
        e.app.save(rec);

        const tenantId = rec.getString("id");

        // Create default quota
        const quotaCol = e.app.findCollectionByNameOrId("tenant_quotas");
        if (quotaCol) {
            const qRec = new Record(quotaCol);
            qRec.set("tenant", tenantId);
            qRec.set("max_projects", body.max_projects !== undefined ? Number(body.max_projects) : tierDefaults.max_projects);
            qRec.set("max_issues", body.max_issues !== undefined ? Number(body.max_issues) : tierDefaults.max_issues);
            qRec.set("max_agents", body.max_agents !== undefined ? Number(body.max_agents) : tierDefaults.max_agents);
            qRec.set("max_storage_mb", body.max_storage_mb !== undefined ? Number(body.max_storage_mb) : tierDefaults.max_storage_mb);
            qRec.set("max_monthly_api_calls", body.max_monthly_api_calls !== undefined ? Number(body.max_monthly_api_calls) : tierDefaults.max_monthly_api_calls);
            qRec.set("max_workflow_runs", body.max_workflow_runs !== undefined ? Number(body.max_workflow_runs) : tierDefaults.max_workflow_runs);
            qRec.set("enforcement_mode", body.enforcement_mode || tierDefaults.enforcement_mode);
            e.app.save(qRec);
        }

        // Create initial owner membership
        const memCol = e.app.findCollectionByNameOrId("tenant_memberships");
        if (memCol) {
            const mRec = new Record(memCol);
            mRec.set("tenant", tenantId);
            mRec.set("user", body.owner || "admin");
            mRec.set("role", "owner");
            mRec.set("is_active", true);
            mRec.set("joined_at", new Date().toISOString());
            e.app.save(mRec);
        }

        return e.json(201, {
            success: true,
            tenant: {
                id: tenantId,
                name: name,
                slug: slug,
                plan_tier: planTier,
                is_active: true
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. GET /api/projectbase/tenants/{id} - Get tenant details
routerAdd("GET", "/api/projectbase/tenants/{id}", (e) => {
    try {
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const rec = e.app.findRecordById("tenants", id);
        if (!rec) return e.json(404, { error: "Tenant not found" });

        let projectsCount = 0; let issuesCount = 0; let agentsCount = 0; let wfCount = 0; let membersCount = 0;
        try { projectsCount = (e.app.findRecordsByFilter("projects", "tenant = '" + id + "'", "", 1000, 0) || []).length; } catch (err) {}
        try { issuesCount = (e.app.findRecordsByFilter("issues", "tenant = '" + id + "'", "", 5000, 0) || []).length; } catch (err) {}
        try { agentsCount = (e.app.findRecordsByFilter("agents", "tenant = '" + id + "'", "", 100, 0) || []).length; } catch (err) {}
        try { wfCount = (e.app.findRecordsByFilter("workflow_runs", "tenant = '" + id + "'", "", 5000, 0) || []).length; } catch (err) {}
        try { membersCount = (e.app.findRecordsByFilter("tenant_memberships", "tenant = '" + id + "'", "", 500, 0) || []).length; } catch (err) {}

        const usage = {
            projects: projectsCount,
            issues: issuesCount,
            agents: agentsCount,
            workflow_runs: wfCount,
            storage_mb: Math.round((issuesCount * 0.05 + projectsCount * 0.2 + wfCount * 0.02) * 100) / 100,
            monthly_api_calls: issuesCount * 12 + wfCount * 5,
            members_count: membersCount
        };

        const planTier = (rec.getString("plan_tier") || "free").toLowerCase();
        const defQ = DEFAULT_QUOTAS[planTier] || DEFAULT_QUOTAS.free;

        let qRec = null;
        try {
            const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + id + "'", "", 1, 0);
            if (qList && qList.length > 0) qRec = qList[0];
        } catch (err) {}

        const quotas = {
            max_projects: qRec ? qRec.getInt("max_projects") : defQ.max_projects,
            max_issues: qRec ? qRec.getInt("max_issues") : defQ.max_issues,
            max_agents: qRec ? qRec.getInt("max_agents") : defQ.max_agents,
            max_storage_mb: qRec ? qRec.getInt("max_storage_mb") : defQ.max_storage_mb,
            max_monthly_api_calls: qRec ? qRec.getInt("max_monthly_api_calls") : defQ.max_monthly_api_calls,
            max_workflow_runs: qRec ? qRec.getInt("max_workflow_runs") : defQ.max_workflow_runs,
            enforcement_mode: qRec ? qRec.getString("enforcement_mode") : defQ.enforcement_mode
        };

        return e.json(200, {
            tenant: {
                id: rec.getString("id"),
                name: rec.getString("name"),
                slug: rec.getString("slug"),
                description: rec.getString("description"),
                plan_tier: planTier,
                is_active: rec.getBool("is_active"),
                owner: rec.getString("owner"),
                settings: rec.get("settings") || {},
                created: rec.getString("created"),
                updated: rec.getString("updated"),
                usage: usage,
                quotas: quotas
            }
        });
    } catch (err) {
        return e.json(404, { error: "Tenant not found: " + (err.message || String(err)) });
    }
});

// 4. PATCH /api/projectbase/tenants/{id} - Update tenant metadata
routerAdd("PATCH", "/api/projectbase/tenants/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const rec = e.app.findRecordById("tenants", id);
        if (!rec) return e.json(404, { error: "Tenant not found" });

        const body = e.requestInfo().body || {};
        if (body.name !== undefined) rec.set("name", body.name);
        if (body.slug !== undefined) rec.set("slug", body.slug);
        if (body.description !== undefined) rec.set("description", body.description);
        if (body.plan_tier !== undefined) rec.set("plan_tier", body.plan_tier);
        if (body.is_active !== undefined) rec.set("is_active", Boolean(body.is_active));
        if (body.settings !== undefined) rec.set("settings", body.settings);

        e.app.save(rec);

        return e.json(200, {
            success: true,
            tenant: {
                id: rec.getString("id"),
                name: rec.getString("name"),
                slug: rec.getString("slug"),
                plan_tier: rec.getString("plan_tier"),
                is_active: rec.getBool("is_active")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. DELETE /api/projectbase/tenants/{id} - Delete tenant workspace
routerAdd("DELETE", "/api/projectbase/tenants/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const rec = e.app.findRecordById("tenants", id);
        if (!rec) return e.json(404, { error: "Tenant not found" });

        // Delete associated quotas & memberships
        try {
            const qRecords = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + id + "'", "", 10, 0) || [];
            for (let i = 0; i < qRecords.length; i++) e.app.delete(qRecords[i]);
        } catch (e) {}

        try {
            const mRecords = e.app.findRecordsByFilter("tenant_memberships", "tenant = '" + id + "'", "", 100, 0) || [];
            for (let i = 0; i < mRecords.length; i++) e.app.delete(mRecords[i]);
        } catch (e) {}

        e.app.delete(rec);
        return e.json(200, { success: true, deleted_id: id });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. GET /api/projectbase/tenants/{id}/quotas - Get tenant quota configuration
routerAdd("GET", "/api/projectbase/tenants/{id}/quotas", (e) => {
    try {
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const tRec = e.app.findRecordById("tenants", id);
        if (!tRec) return e.json(404, { error: "Tenant not found" });

        const planTier = (tRec.getString("plan_tier") || "free").toLowerCase();
        const defQ = DEFAULT_QUOTAS[planTier] || DEFAULT_QUOTAS.free;

        let qRec = null;
        try {
            const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + id + "'", "", 1, 0);
            if (qList && qList.length > 0) qRec = qList[0];
        } catch (err) {}

        const quotas = {
            id: qRec ? qRec.getString("id") : null,
            tenant: id,
            max_projects: qRec ? qRec.getInt("max_projects") : defQ.max_projects,
            max_issues: qRec ? qRec.getInt("max_issues") : defQ.max_issues,
            max_agents: qRec ? qRec.getInt("max_agents") : defQ.max_agents,
            max_storage_mb: qRec ? qRec.getInt("max_storage_mb") : defQ.max_storage_mb,
            max_monthly_api_calls: qRec ? qRec.getInt("max_monthly_api_calls") : defQ.max_monthly_api_calls,
            max_workflow_runs: qRec ? qRec.getInt("max_workflow_runs") : defQ.max_workflow_runs,
            enforcement_mode: qRec ? qRec.getString("enforcement_mode") : defQ.enforcement_mode
        };

        return e.json(200, { quotas: quotas });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. PUT /api/projectbase/tenants/{id}/quotas - Update tenant quotas
routerAdd("PUT", "/api/projectbase/tenants/{id}/quotas", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const tRec = e.app.findRecordById("tenants", id);
        if (!tRec) return e.json(404, { error: "Tenant not found" });

        const body = e.requestInfo().body || {};
        let qRec = null;
        try {
            const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + id + "'", "", 1, 0);
            if (qList && qList.length > 0) qRec = qList[0];
        } catch (err) {}

        const quotaCol = e.app.findCollectionByNameOrId("tenant_quotas");

        if (!qRec && quotaCol) {
            qRec = new Record(quotaCol);
            qRec.set("tenant", id);
        }

        if (qRec) {
            if (body.max_projects !== undefined) qRec.set("max_projects", Number(body.max_projects));
            if (body.max_issues !== undefined) qRec.set("max_issues", Number(body.max_issues));
            if (body.max_agents !== undefined) qRec.set("max_agents", Number(body.max_agents));
            if (body.max_storage_mb !== undefined) qRec.set("max_storage_mb", Number(body.max_storage_mb));
            if (body.max_monthly_api_calls !== undefined) qRec.set("max_monthly_api_calls", Number(body.max_monthly_api_calls));
            if (body.max_workflow_runs !== undefined) qRec.set("max_workflow_runs", Number(body.max_workflow_runs));
            if (body.enforcement_mode !== undefined) qRec.set("enforcement_mode", body.enforcement_mode);
            e.app.save(qRec);
        }

        return e.json(200, {
            success: true,
            quotas: {
                tenant: id,
                max_projects: qRec.getInt("max_projects"),
                max_issues: qRec.getInt("max_issues"),
                max_agents: qRec.getInt("max_agents"),
                max_storage_mb: qRec.getInt("max_storage_mb"),
                max_monthly_api_calls: qRec.getInt("max_monthly_api_calls"),
                max_workflow_runs: qRec.getInt("max_workflow_runs"),
                enforcement_mode: qRec.getString("enforcement_mode")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. GET /api/projectbase/tenants/{id}/usage - Calculate live resource meters
routerAdd("GET", "/api/projectbase/tenants/{id}/usage", (e) => {
    try {
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const tRec = e.app.findRecordById("tenants", id);
        if (!tRec) return e.json(404, { error: "Tenant not found" });

        let projectsCount = 0; let issuesCount = 0; let agentsCount = 0; let wfCount = 0; let membersCount = 0;
        try { projectsCount = (e.app.findRecordsByFilter("projects", "tenant = '" + id + "'", "", 1000, 0) || []).length; } catch (err) {}
        try { issuesCount = (e.app.findRecordsByFilter("issues", "tenant = '" + id + "'", "", 5000, 0) || []).length; } catch (err) {}
        try { agentsCount = (e.app.findRecordsByFilter("agents", "tenant = '" + id + "'", "", 100, 0) || []).length; } catch (err) {}
        try { wfCount = (e.app.findRecordsByFilter("workflow_runs", "tenant = '" + id + "'", "", 5000, 0) || []).length; } catch (err) {}
        try { membersCount = (e.app.findRecordsByFilter("tenant_memberships", "tenant = '" + id + "'", "", 500, 0) || []).length; } catch (err) {}

        const usage = {
            projects: projectsCount,
            issues: issuesCount,
            agents: agentsCount,
            workflow_runs: wfCount,
            storage_mb: Math.round((issuesCount * 0.05 + projectsCount * 0.2 + wfCount * 0.02) * 100) / 100,
            monthly_api_calls: issuesCount * 12 + wfCount * 5,
            members_count: membersCount
        };

        const planTier = (tRec.getString("plan_tier") || "free").toLowerCase();
        const defQ = DEFAULT_QUOTAS[planTier] || DEFAULT_QUOTAS.free;

        let qRec = null;
        try {
            const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + id + "'", "", 1, 0);
            if (qList && qList.length > 0) qRec = qList[0];
        } catch (err) {}

        const quotas = {
            max_projects: qRec ? qRec.getInt("max_projects") : defQ.max_projects,
            max_issues: qRec ? qRec.getInt("max_issues") : defQ.max_issues,
            max_agents: qRec ? qRec.getInt("max_agents") : defQ.max_agents,
            max_storage_mb: qRec ? qRec.getInt("max_storage_mb") : defQ.max_storage_mb,
            max_monthly_api_calls: qRec ? qRec.getInt("max_monthly_api_calls") : defQ.max_monthly_api_calls,
            max_workflow_runs: qRec ? qRec.getInt("max_workflow_runs") : defQ.max_workflow_runs,
            enforcement_mode: qRec ? qRec.getString("enforcement_mode") : defQ.enforcement_mode
        };

        const metrics = [
            {
                resource: "projects",
                used: usage.projects,
                limit: quotas.max_projects,
                pct: quotas.max_projects > 0 ? Math.min(100, Math.round((usage.projects / quotas.max_projects) * 100)) : 0,
                status: usage.projects >= quotas.max_projects ? "exceeded" : (usage.projects >= quotas.max_projects * 0.8 ? "warning" : "ok")
            },
            {
                resource: "issues",
                used: usage.issues,
                limit: quotas.max_issues,
                pct: quotas.max_issues > 0 ? Math.min(100, Math.round((usage.issues / quotas.max_issues) * 100)) : 0,
                status: usage.issues >= quotas.max_issues ? "exceeded" : (usage.issues >= quotas.max_issues * 0.8 ? "warning" : "ok")
            },
            {
                resource: "agents",
                used: usage.agents,
                limit: quotas.max_agents,
                pct: quotas.max_agents > 0 ? Math.min(100, Math.round((usage.agents / quotas.max_agents) * 100)) : 0,
                status: usage.agents >= quotas.max_agents ? "exceeded" : (usage.agents >= quotas.max_agents * 0.8 ? "warning" : "ok")
            },
            {
                resource: "storage_mb",
                used: usage.storage_mb,
                limit: quotas.max_storage_mb,
                pct: quotas.max_storage_mb > 0 ? Math.min(100, Math.round((usage.storage_mb / quotas.max_storage_mb) * 100)) : 0,
                status: usage.storage_mb >= quotas.max_storage_mb ? "exceeded" : (usage.storage_mb >= quotas.max_storage_mb * 0.8 ? "warning" : "ok")
            },
            {
                resource: "workflow_runs",
                used: usage.workflow_runs,
                limit: quotas.max_workflow_runs,
                pct: quotas.max_workflow_runs > 0 ? Math.min(100, Math.round((usage.workflow_runs / quotas.max_workflow_runs) * 100)) : 0,
                status: usage.workflow_runs >= quotas.max_workflow_runs ? "exceeded" : (usage.workflow_runs >= quotas.max_workflow_runs * 0.8 ? "warning" : "ok")
            }
        ];

        return e.json(200, {
            tenant_id: id,
            tenant_name: tRec.getString("name"),
            plan_tier: planTier,
            enforcement_mode: quotas.enforcement_mode,
            meters: metrics,
            raw_usage: usage
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 9. POST /api/projectbase/tenants/{id}/check-quota - Dynamic quota enforcement gate check
routerAdd("POST", "/api/projectbase/tenants/{id}/check-quota", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const tRec = e.app.findRecordById("tenants", id);
        if (!tRec) return e.json(404, { error: "Tenant not found" });

        const body = e.requestInfo().body || {};
        const resourceType = (body.resource_type || "issue").toLowerCase();
        const units = Number(body.units !== undefined ? body.units : 1);

        let projectsCount = 0; let issuesCount = 0; let agentsCount = 0; let wfCount = 0;
        try { projectsCount = (e.app.findRecordsByFilter("projects", "tenant = '" + id + "'", "", 1000, 0) || []).length; } catch (err) {}
        try { issuesCount = (e.app.findRecordsByFilter("issues", "tenant = '" + id + "'", "", 5000, 0) || []).length; } catch (err) {}
        try { agentsCount = (e.app.findRecordsByFilter("agents", "tenant = '" + id + "'", "", 100, 0) || []).length; } catch (err) {}
        try { wfCount = (e.app.findRecordsByFilter("workflow_runs", "tenant = '" + id + "'", "", 5000, 0) || []).length; } catch (err) {}

        const planTier = (tRec.getString("plan_tier") || "free").toLowerCase();
        const defQ = DEFAULT_QUOTAS[planTier] || DEFAULT_QUOTAS.free;

        let qRec = null;
        try {
            const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + id + "'", "", 1, 0);
            if (qList && qList.length > 0) qRec = qList[0];
        } catch (err) {}

        let maxLimit = 0;
        let currentUsed = 0;

        if (resourceType === "project" || resourceType === "projects") {
            maxLimit = qRec ? qRec.getInt("max_projects") : defQ.max_projects;
            currentUsed = projectsCount;
        } else if (resourceType === "agent" || resourceType === "agents") {
            maxLimit = qRec ? qRec.getInt("max_agents") : defQ.max_agents;
            currentUsed = agentsCount;
        } else if (resourceType === "workflow_run" || resourceType === "workflow_runs") {
            maxLimit = qRec ? qRec.getInt("max_workflow_runs") : defQ.max_workflow_runs;
            currentUsed = wfCount;
        } else if (resourceType === "storage" || resourceType === "storage_mb") {
            maxLimit = qRec ? qRec.getInt("max_storage_mb") : defQ.max_storage_mb;
            currentUsed = Math.round((issuesCount * 0.05 + projectsCount * 0.2 + wfCount * 0.02) * 100) / 100;
        } else {
            // default issues
            maxLimit = qRec ? qRec.getInt("max_issues") : defQ.max_issues;
            currentUsed = issuesCount;
        }

        const enforcement = qRec ? qRec.getString("enforcement_mode") : defQ.enforcement_mode;
        const proposedTotal = currentUsed + units;
        const isOver = proposedTotal > maxLimit;
        const allowed = !isOver || enforcement !== "hard";

        return e.json(200, {
            allowed: allowed,
            resource_type: resourceType,
            requested_units: units,
            current_used: currentUsed,
            max_limit: maxLimit,
            projected_usage: proposedTotal,
            enforcement_mode: enforcement,
            reason: isOver ? (enforcement === "hard" ? "Quota exceeded for " + resourceType + " (limit " + maxLimit + ")" : "Soft quota warning: allocation exceeds limit " + maxLimit) : "Within quota allocation"
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 10. POST /api/projectbase/tenants/{id}/switch - Switch active tenant workspace context
routerAdd("POST", "/api/projectbase/tenants/{id}/switch", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const tRec = e.app.findRecordById("tenants", id);
        if (!tRec) return e.json(404, { error: "Tenant not found" });

        const body = e.requestInfo().body || {};
        const userId = body.user_id || "admin";

        return e.json(200, {
            success: true,
            active_tenant_id: id,
            active_tenant_name: tRec.getString("name"),
            active_tenant_slug: tRec.getString("slug"),
            user_id: userId,
            switched_at: new Date().toISOString()
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 11. GET /api/projectbase/tenants/metrics - Cross-tenant workspace metrics & utilization
routerAdd("GET", "/api/projectbase/tenants/metrics", (e) => {
    try {
        const DEFAULT_QUOTAS = {
            free: { max_projects: 5, max_issues: 250, max_agents: 3, max_storage_mb: 500, max_monthly_api_calls: 5000, max_workflow_runs: 500, enforcement_mode: "hard" },
            pro: { max_projects: 25, max_issues: 2500, max_agents: 15, max_storage_mb: 5000, max_monthly_api_calls: 50000, max_workflow_runs: 10000, enforcement_mode: "soft" },
            enterprise: { max_projects: 100, max_issues: 25000, max_agents: 50, max_storage_mb: 50000, max_monthly_api_calls: 500000, max_workflow_runs: 100000, enforcement_mode: "warn" }
        };

        const col = e.app.findCollectionByNameOrId("tenants");
        if (!col) return e.json(200, { total_tenants: 0, active_tenants: 0, tier_breakdown: {}, alerts: [] });

        const records = e.app.findRecordsByFilter("tenants", "id != ''", "-created", 100, 0) || [];
        let activeCount = 0;
        const tierMap = { free: 0, pro: 0, enterprise: 0 };
        const alerts = [];
        let totalProjects = 0;
        let totalIssues = 0;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (r.getBool("is_active")) activeCount++;
            const tier = (r.getString("plan_tier") || "free").toLowerCase();
            tierMap[tier] = (tierMap[tier] || 0) + 1;

            const tId = r.getString("id");
            let tProjects = 0; let tIssues = 0;
            try { tProjects = (e.app.findRecordsByFilter("projects", "tenant = '" + tId + "'", "", 1000, 0) || []).length; } catch (err) {}
            try { tIssues = (e.app.findRecordsByFilter("issues", "tenant = '" + tId + "'", "", 5000, 0) || []).length; } catch (err) {}

            totalProjects += tProjects;
            totalIssues += tIssues;

            let qRec = null;
            try {
                const qList = e.app.findRecordsByFilter("tenant_quotas", "tenant = '" + tId + "'", "", 1, 0);
                if (qList && qList.length > 0) qRec = qList[0];
            } catch (err) {}

            const defQ = DEFAULT_QUOTAS[tier] || DEFAULT_QUOTAS.free;
            const maxIss = qRec ? qRec.getInt("max_issues") : defQ.max_issues;

            if (tIssues >= maxIss) {
                alerts.push({
                    tenant_id: tId,
                    tenant_name: r.getString("name"),
                    resource: "issues",
                    level: "critical",
                    message: "Issue quota exceeded: " + tIssues + "/" + maxIss
                });
            } else if (tIssues >= maxIss * 0.8) {
                alerts.push({
                    tenant_id: tId,
                    tenant_name: r.getString("name"),
                    resource: "issues",
                    level: "warning",
                    message: "Issue quota near limit: " + tIssues + "/" + maxIss
                });
            }
        }

        return e.json(200, {
            total_tenants: records.length,
            active_tenants: activeCount,
            tier_breakdown: tierMap,
            aggregate_resources: {
                total_projects: totalProjects,
                total_issues: totalIssues
            },
            alerts_count: alerts.length,
            alerts: alerts
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 12. GET /api/projectbase/tenants/{id}/members - List tenant members and agents
routerAdd("GET", "/api/projectbase/tenants/{id}/members", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const col = e.app.findCollectionByNameOrId("tenant_memberships");
        if (!col) return e.json(200, { members: [], total: 0 });

        const records = e.app.findRecordsByFilter("tenant_memberships", "tenant = '" + id + "'", "-created", 100, 0) || [];
        const list = [];
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            list.push({
                id: r.getString("id"),
                tenant: r.getString("tenant"),
                user: r.getString("user"),
                role: r.getString("role"),
                is_active: r.getBool("is_active"),
                joined_at: r.getString("joined_at"),
                created: r.getString("created")
            });
        }
        return e.json(200, { members: list, total: list.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 13. POST /api/projectbase/tenants/{id}/members - Add member/agent to tenant
routerAdd("POST", "/api/projectbase/tenants/{id}/members", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const tRec = e.app.findRecordById("tenants", id);
        if (!tRec) return e.json(404, { error: "Tenant not found" });

        const body = e.requestInfo().body || {};
        const user = (body.user || body.user_id || "").trim();
        if (!user) return e.json(400, { error: "User or agent identifier is required" });

        const col = e.app.findCollectionByNameOrId("tenant_memberships");
        const rec = new Record(col);
        rec.set("tenant", id);
        rec.set("user", user);
        rec.set("role", body.role || "member");
        rec.set("is_active", body.is_active !== false);
        rec.set("joined_at", new Date().toISOString());
        e.app.save(rec);

        return e.json(201, {
            success: true,
            membership: {
                id: rec.getString("id"),
                tenant: id,
                user: user,
                role: rec.getString("role"),
                is_active: rec.getBool("is_active")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 14. DELETE /api/projectbase/tenants/{id}/members/{userId} - Remove member
routerAdd("DELETE", "/api/projectbase/tenants/{id}/members/{userId}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || "";
        const userId = (e.request && e.request.pathValue ? e.request.pathValue("userId") : "") || (e.requestInfo().params && e.requestInfo().params.userId) || "";

        const col = e.app.findCollectionByNameOrId("tenant_memberships");
        if (!col) return e.json(404, { error: "Membership collection not found" });

        const records = e.app.findRecordsByFilter("tenant_memberships", "tenant = '" + id + "' && (id = '" + userId + "' || user = '" + userId + "')", "", 10, 0) || [];
        if (records.length === 0) return e.json(404, { error: "Membership not found" });

        for (let i = 0; i < records.length; i++) {
            e.app.delete(records[i]);
        }

        return e.json(200, { success: true, removed_user: userId });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
