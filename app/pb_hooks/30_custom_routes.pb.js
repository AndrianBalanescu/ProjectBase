// pb_hooks/30_custom_routes.pb.js
// Custom endpoints for AI agents, statistics, and doc redirects

routerAdd("GET", "/api/projectbase/health", (e) => {
    return e.json(200, {
        status: "healthy",
        service: "ProjectBase",
        version: "1.39.0",
        engine: "PocketBase + Vue 3",
        license: "MIT",
        open_source: true,
        time: new Date().toISOString()
    })
})

routerAdd("POST", "/api/projectbase/health", (e) => {
    return e.json(200, {
        status: "healthy",
        service: "ProjectBase",
        received: true,
        time: new Date().toISOString()
    })
})

routerAdd("GET", "/api/projectbase/version", (e) => {
    return e.json(200, {
        version: "1.39.0",
        service: "ProjectBase",
        license: "MIT",
        open_source: true
    })
})

routerAdd("GET", "/docs", (e) => {
    return e.redirect(301, "/docs/")
})

routerAdd("GET", "/api/docs", (e) => {
    return e.redirect(301, "/docs/")
})

routerAdd("GET", "/api/openapi.json", (e) => {
    return e.redirect(301, "/openapi.json")
})

routerAdd("GET", "/api/projectbase/stats", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let projects = e.app.findRecordsByFilter("projects", "1=1", "-created", 100, 0)
        let issues = e.app.findRecordsByFilter("issues", "1=1", "-created", 1000, 0)
        let cycles = e.app.findRecordsByFilter("cycles", "1=1", "-created", 100, 0)

        let statusCounts = {
            backlog: 0,
            todo: 0,
            in_progress: 0,
            in_review: 0,
            done: 0,
            cancelled: 0
        }
        let priorityCounts = {
            urgent: 0,
            high: 0,
            medium: 0,
            low: 0,
            none: 0
        }

        let totalEstimate = 0
        let completedEstimate = 0

        for (let issue of issues) {
            let s = issue.get("status") || "backlog"
            let p = issue.get("priority") || "none"
            let est = Number(issue.get("estimate")) || 0

            if (statusCounts[s] !== undefined) statusCounts[s]++
            if (priorityCounts[p] !== undefined) priorityCounts[p]++

            totalEstimate += est
            if (s === "done") {
                completedEstimate += est
            }
        }

        let completionRate = issues.length > 0 ? Math.round((statusCounts.done / issues.length) * 100) : 0

        return e.json(200, {
            total_projects: projects.length,
            total_issues: issues.length,
            total_cycles: cycles.length,
            completion_rate_percent: completionRate,
            total_estimate: totalEstimate,
            completed_estimate: completedEstimate,
            status_breakdown: statusCounts,
            priority_breakdown: priorityCounts
        })
    } catch (err) {
        console.log(">>> [ProjectBase] route error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})

routerAdd("POST", "/api/projectbase/quick-task", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body
        try {
            body = e.requestInfo().body || {}
        } catch (bErr) {
            return e.json(400, { error: "Invalid JSON body" })
        }
        if (typeof body.title !== "string" || body.title.trim().length === 0) {
            return e.json(400, { error: "Missing required 'title' field" })
        }
        if (body.title.length > 512) {
            return e.json(400, { error: "'title' must be at most 512 characters" })
        }
        if (body.description && (typeof body.description !== "string" || body.description.length > 65536)) {
            return e.json(400, { error: "'description' must be a string of at most 65536 characters" })
        }

        let projectCol = e.app.findCollectionByNameOrId("projects")
        let issuesCol = e.app.findCollectionByNameOrId("issues")

        let targetProject = null
        let projectRefProvided = false
        if (body.project_id) {
            projectRefProvided = true
            if (typeof body.project_id !== "string" || !/^[a-zA-Z0-9]{10,20}$/.test(body.project_id)) {
                return e.json(400, { error: "Invalid 'project_id' format" })
            }
            try {
                targetProject = e.app.findRecordById("projects", body.project_id)
            } catch (pErr) {
                targetProject = null
            }
        } else if (body.project_key) {
            projectRefProvided = true
            if (typeof body.project_key !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(body.project_key)) {
                return e.json(400, { error: "Invalid 'project_key' format" })
            }
            let found = e.app.findRecordsByFilter("projects", `identifier = '${body.project_key.toUpperCase()}'`, "-created", 1, 0)
            if (found && found.length > 0) targetProject = found[0]
        }
        if (projectRefProvided && !targetProject) {
            return e.json(404, { error: "Project not found" })
        }

        // Fallback to the oldest project ONLY when the caller provided no
        // project reference at all. A provided-but-unresolvable reference is
        // rejected above so tasks are never silently filed in the wrong project.
        if (!targetProject) {
            let all = e.app.findRecordsByFilter("projects", "1=1", "created", 1, 0)
            if (all && all.length > 0) targetProject = all[0]
        }

        if (!targetProject) {
            return e.json(400, { error: "No projects found in database" })
        }

        let issue = new Record(issuesCol)
        issue.set("project", targetProject.id)
        issue.set("title", body.title)
        issue.set("description", body.description || "")
        issue.set("status", body.status || "todo")
        issue.set("priority", body.priority || "medium")
        issue.set("estimate", Number(body.estimate) || 0)
        issue.set("assignee", body.assignee || "Flomaster Agent")
        issue.set("labels", body.labels || [])
        e.app.save(issue)

        return e.json(201, {
            success: true,
            issue: {
                id: issue.id,
                identifier: issue.get("identifier"),
                title: issue.get("title"),
                status: issue.get("status"),
                priority: issue.get("priority"),
                project: targetProject.get("name")
            }
        })
    } catch (err) {
        console.log(">>> [ProjectBase] route error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})

routerAdd("GET", "/api/projectbase/search", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let q = e.requestInfo().query && e.requestInfo().query.q
        q = String(q || "").trim()
        if (!q) {
            return e.json(200, { query: "", count: 0, results: [] })
        }
        if (q.length > 128) {
            return e.badRequestError("Search query too long (max 128 chars)")
        }

        // Escape single quotes for the filter string.
        const safe = q.replace(/'/g, "\\'")
        const limit = Math.min(Number(e.requestInfo().query && e.requestInfo().query.limit) || 20, 50)

        // Cross-project search across title, identifier, status, and priority.
        const filter = `(title ~ '${safe}' || identifier ~ '${safe}' || status ~ '${safe}' || priority ~ '${safe}')`
        let issues = e.app.findRecordsByFilter("issues", filter, "-created", limit, 0)

        const results = []
        const projectCache = {}
        for (const rec of issues) {
            const projectId = rec.get("project")
            let projectName = ""
            let projectIdentifier = ""
            let projectColor = ""
            if (projectId) {
                if (projectCache[projectId]) {
                    projectName = projectCache[projectId].name
                    projectIdentifier = projectCache[projectId].identifier
                    projectColor = projectCache[projectId].color
                } else {
                    try {
                        const proj = e.app.findRecordById("projects", projectId)
                        projectName = proj.get("name") || ""
                        projectIdentifier = proj.get("identifier") || ""
                        projectColor = proj.get("color") || ""
                        projectCache[projectId] = { name: projectName, identifier: projectIdentifier, color: projectColor }
                    } catch (pErr) {
                        projectCache[projectId] = { name: "", identifier: "", color: "" }
                    }
                }
            }
            results.push({
                id: rec.id,
                identifier: rec.get("identifier") || "",
                title: rec.get("title") || "",
                status: rec.get("status") || "backlog",
                priority: rec.get("priority") || "none",
                project_id: projectId || "",
                project_name: projectName,
                project_identifier: projectIdentifier,
                project_color: projectColor
            })
        }

        return e.json(200, { query: q, count: results.length, results })
    } catch (err) {
        console.log(">>> [ProjectBase] search route error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})

// ---------------------------------------------------------------------------
// Notification channel settings (in-app, self-hosted). Reads/writes the
// `notification_settings` singleton collection that 60_notifications.pb.js
// dispatches to. GET returns the current values (DB row, falling back to env so
// the UI reflects what is actually in use). PUT lets an admin update them at
// runtime without restarting the process. Both are admin/superuser-gated.
// ---------------------------------------------------------------------------

// NOTE (critical): In the Goja runtime PocketBase uses, module-scope function
// declarations are NOT resolvable from inside a route callback — every call
// throws `ReferenceError: <fn> is not defined`. ALL logic is therefore inlined
// directly inside each callback below.

routerAdd("GET", "/api/projectbase/notification-settings", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let privileged = false
        try {
            const isSuperuser = e.auth.collection && e.auth.collection().name === "_superusers"
            if (isSuperuser) { privileged = true } else {
                const role = e.auth.get("role")
                privileged = (role === "admin" || role === "manager")
            }
        } catch (privErr) { privileged = false }
        if (!privileged) {
            return e.forbiddenError("Admin or manager role required")
        }

        let rows = []
        try { rows = e.app.findRecordsByFilter("notification_settings", "1=1", "", 1, 0) } catch (rErr) { rows = [] }
        let row = rows.length > 0 ? rows[0] : null
        if (!row) {
            try {
                const collection = e.app.findCollectionByNameOrId("notification_settings")
                row = new Record(collection)
                e.app.save(row)
            } catch (cErr) {
                row = null
            }
        }
        if (!row) {
            return e.json(200, {
                discord_webhook_url: $os.getenv("DISCORD_WEBHOOK_URL") || "",
                telegram_token: $os.getenv("TELEGRAM_BOT_TOKEN") || "",
                telegram_chat_id: $os.getenv("TELEGRAM_CHAT_ID") || "",
                generic_webhook_url: $os.getenv("PROJECTBASE_WEBHOOK_URL") || "",
            })
        }
        return e.json(200, {
            discord_webhook_url: row.get("discord_webhook_url") || "",
            telegram_token: row.get("telegram_token") || "",
            telegram_chat_id: row.get("telegram_chat_id") || "",
            generic_webhook_url: row.get("generic_webhook_url") || "",
        })
    } catch (err) {
        console.log(">>> [ProjectBase] notification-settings GET error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})

routerAdd("PUT", "/api/projectbase/notification-settings", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let privileged = false
        try {
            const isSuperuser = e.auth.collection && e.auth.collection().name === "_superusers"
            if (isSuperuser) { privileged = true } else {
                const role = e.auth.get("role")
                privileged = (role === "admin" || role === "manager")
            }
        } catch (privErr) { privileged = false }
        if (!privileged) {
            return e.forbiddenError("Admin or manager role required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }

        let rows = []
        try { rows = e.app.findRecordsByFilter("notification_settings", "1=1", "", 1, 0) } catch (rErr) { rows = [] }
        let row = rows.length > 0 ? rows[0] : null
        if (!row) {
            try {
                const collection = e.app.findCollectionByNameOrId("notification_settings")
                row = new Record(collection)
            } catch (cErr) {
                row = null
            }
        }
        if (!row) {
            return e.json(500, { error: "notification_settings collection unavailable" })
        }
        const clamp = (v, max) => (typeof v === "string" ? v.slice(0, max) : "")
        row.set("discord_webhook_url", clamp(body.discord_webhook_url, 2048))
        row.set("telegram_token", clamp(body.telegram_token, 512))
        row.set("telegram_chat_id", clamp(body.telegram_chat_id, 128))
        row.set("generic_webhook_url", clamp(body.generic_webhook_url, 2048))
        e.app.save(row)
        return e.json(200, {
            discord_webhook_url: row.get("discord_webhook_url") || "",
            telegram_token: row.get("telegram_token") || "",
            telegram_chat_id: row.get("telegram_chat_id") || "",
            generic_webhook_url: row.get("generic_webhook_url") || "",
        })
    } catch (err) {
        console.log(">>> [ProjectBase] notification-settings PUT error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
