// pb_hooks/92_agent_collaboration.pb.js
// Real-Time Multi-Agent Collaboration, Task Leases, Collision Avoidance & Webhooks.
//
// Features (Epic 9):
// 1. Task Leases: Mutual exclusion for autonomous agent task execution with TTL expiration.
// 2. Webhooks: Subscriptions and outbound HTTP dispatch to external orchestrators.
// 3. Agent Telemetry: Real-time reasoning/tool log ingestion and collision detection.

// --- Helper for resolving issue ID or identifier (e.g. PB-42) ---
// Note: router handlers in PocketBase JSVM re-define local helpers to ensure scope isolation.

// 1. Acquire / Claim Task Lease
routerAdd("POST", "/api/projectbase/leases/acquire", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }

        let issueRef = (body.issue_id || body.issue || "").trim()
        let agentName = (body.agent_name || "agent").trim()
        let agentId = (body.agent_id || "").trim()
        let reason = (body.reason || "").trim()
        let ttlSeconds = parseInt(body.ttl_seconds || body.ttl || "900", 10) // default 15 mins
        if (isNaN(ttlSeconds) || ttlSeconds < 10) { ttlSeconds = 900 }
        if (ttlSeconds > 86400) { ttlSeconds = 86400 } // max 24h

        if (!issueRef) {
            return e.json(400, { error: "Missing required parameter 'issue_id'" })
        }

        // Find issue record
        let issue = null
        if (issueRef.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(issueRef)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + issueRef.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", issueRef) } catch (nf) {}
        }
        if (!issue) {
            return e.json(404, { error: "Issue not found" })
        }

        let now = new Date()
        let nowIso = now.toISOString()
        let expiresAt = new Date(now.getTime() + (ttlSeconds * 1000)).toISOString()

        // Check for existing lease on this issue
        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 1, 0)
        let leaseCol = e.app.findCollectionByNameOrId("task_leases")

        if (existing.length > 0) {
            let current = existing[0]
            let currentExp = current.getString("expires_at")
            let isExpired = currentExp && new Date(currentExp) <= now
            let currentHolder = current.getString("agent_name")

            if (!isExpired && currentHolder !== agentName && !body.force) {
                // Conflict: Active lease held by another agent
                return e.json(409, {
                    error: "Task lease collision: issue is actively leased by another agent",
                    conflict: true,
                    lease: {
                        id: current.id,
                        issue_id: issue.id,
                        identifier: issue.getString("identifier"),
                        agent_name: currentHolder,
                        reason: current.getString("reason"),
                        expires_at: currentExp,
                        seconds_remaining: Math.max(0, Math.floor((new Date(currentExp).getTime() - now.getTime()) / 1000))
                    }
                })
            }

            // Same agent, expired lease, or force override: update/renew
            current.set("agent_name", agentName)
            if (agentId) { current.set("agent_id", agentId) }
            if (reason) { current.set("reason", reason) }
            current.set("acquired_at", nowIso)
            current.set("expires_at", expiresAt)
            current.set("heartbeat", nowIso)
            if (body.metadata) { current.set("metadata", body.metadata) }
            e.app.save(current)

            return e.json(200, {
                success: true,
                status: "acquired",
                lease: {
                    id: current.id,
                    issue_id: issue.id,
                    identifier: issue.getString("identifier"),
                    agent_name: agentName,
                    expires_at: expiresAt,
                    ttl_seconds: ttlSeconds,
                    reason: reason
                }
            })
        }

        // Create new lease
        let record = new Record(leaseCol)
        record.set("issue", issue.id)
        record.set("agent_name", agentName)
        if (agentId) { record.set("agent_id", agentId) }
        record.set("reason", reason)
        record.set("acquired_at", nowIso)
        record.set("expires_at", expiresAt)
        record.set("heartbeat", nowIso)
        if (body.metadata) { record.set("metadata", body.metadata) }
        e.app.save(record)

        return e.json(201, {
            success: true,
            status: "acquired",
            lease: {
                id: record.id,
                issue_id: issue.id,
                identifier: issue.getString("identifier"),
                agent_name: agentName,
                expires_at: expiresAt,
                ttl_seconds: ttlSeconds,
                reason: reason
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to acquire task lease: " + err })
    }
})

// 2. Renew Task Lease Heartbeat
routerAdd("POST", "/api/projectbase/leases/renew", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let issueRef = (body.issue_id || body.issue || "").trim()
        let agentName = (body.agent_name || "").trim()
        let ttlSeconds = parseInt(body.ttl_seconds || body.ttl || "900", 10)
        if (isNaN(ttlSeconds) || ttlSeconds < 10) { ttlSeconds = 900 }

        if (!issueRef) { return e.json(400, { error: "Missing 'issue_id'" }) }

        let issue = null
        if (issueRef.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(issueRef)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + issueRef.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", issueRef) } catch (nf) {}
        }
        if (!issue) { return e.json(404, { error: "Issue not found" }) }

        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 1, 0)
        if (existing.length === 0) {
            return e.json(404, { error: "No active lease found for this issue" })
        }

        let current = existing[0]
        let holder = current.getString("agent_name")
        if (agentName && holder !== agentName && !body.force) {
            return e.json(403, { error: "Cannot renew lease held by another agent (" + holder + ")" })
        }

        let now = new Date()
        let expiresAt = new Date(now.getTime() + (ttlSeconds * 1000)).toISOString()
        current.set("heartbeat", now.toISOString())
        current.set("expires_at", expiresAt)
        e.app.save(current)

        return e.json(200, {
            success: true,
            status: "renewed",
            lease: {
                id: current.id,
                issue_id: issue.id,
                agent_name: holder,
                expires_at: expiresAt,
                ttl_seconds: ttlSeconds
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to renew task lease: " + err })
    }
})

// 3. Release Task Lease
routerAdd("POST", "/api/projectbase/leases/release", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let issueRef = (body.issue_id || body.issue || "").trim()
        let agentName = (body.agent_name || "").trim()
        let force = !!body.force

        if (!issueRef) { return e.json(400, { error: "Missing 'issue_id'" }) }

        let issue = null
        if (issueRef.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(issueRef)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + issueRef.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", issueRef) } catch (nf) {}
        }
        if (!issue) { return e.json(404, { error: "Issue not found" }) }

        let existing = e.app.findRecordsByFilter("task_leases", "issue = '" + issue.id + "'", "-created", 10, 0)
        if (existing.length === 0) {
            return e.json(200, { success: true, status: "already_released", message: "No active lease was present" })
        }

        let deletedCount = 0
        for (let i = 0; i < existing.length; i++) {
            let rec = existing[i]
            let holder = rec.getString("agent_name")
            if (force || !agentName || holder === agentName) {
                e.app.delete(rec)
                deletedCount++
            }
        }

        return e.json(200, {
            success: true,
            status: "released",
            released_count: deletedCount
        })
    } catch (err) {
        return e.json(500, { error: "Failed to release task lease: " + err })
    }
})

// 4. List Active Leases
routerAdd("GET", "/api/projectbase/leases", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let now = new Date()
        let records = e.app.findRecordsByFilter("task_leases", "", "-created", 100, 0)
        let out = []

        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            let exp = r.getString("expires_at")
            let isExpired = exp && new Date(exp) <= now
            let issueId = r.getString("issue")
            let issueIdent = ""
            let issueTitle = ""
            try {
                let iss = e.app.findRecordById("issues", issueId)
                issueIdent = iss.getString("identifier")
                issueTitle = iss.getString("title")
            } catch (x) {}

            out.push({
                id: r.id,
                issue_id: issueId,
                identifier: issueIdent,
                title: issueTitle,
                agent_name: r.getString("agent_name"),
                agent_id: r.getString("agent_id"),
                reason: r.getString("reason"),
                acquired_at: r.getString("acquired_at"),
                expires_at: exp,
                is_expired: isExpired,
                seconds_remaining: isExpired ? 0 : Math.max(0, Math.floor((new Date(exp).getTime() - now.getTime()) / 1000))
            })
        }

        return e.json(200, { leases: out, total: out.length })
    } catch (err) {
        return e.json(500, { error: "Failed to list leases: " + err })
    }
})

// 5. Ingest Agent Telemetry
routerAdd("POST", "/api/projectbase/telemetry", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let agentName = (body.agent_name || "agent").trim()
        let eventType = (body.event_type || "status").trim()
        let summary = (body.summary || "").trim()
        let issueRef = (body.issue_id || body.issue || "").trim()
        let step = parseInt(body.step || "0", 10)

        let col = e.app.findCollectionByNameOrId("agent_telemetry")
        let rec = new Record(col)
        rec.set("agent_name", agentName)
        rec.set("event_type", eventType)
        rec.set("summary", summary)
        rec.set("step", isNaN(step) ? 0 : step)
        rec.set("timestamp", new Date().toISOString())

        if (issueRef) {
            let issue = null
            if (issueRef.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(issueRef)) {
                let matches = e.app.findRecordsByFilter("issues", "identifier = '" + issueRef.toUpperCase() + "'", "", 1, 0)
                if (matches.length > 0) { issue = matches[0] }
            }
            if (!issue) {
                try { issue = e.app.findRecordById("issues", issueRef) } catch (x) {}
            }
            if (issue) { rec.set("issue", issue.id) }
        }

        if (body.payload) { rec.set("payload", body.payload) }

        e.app.save(rec)

        return e.json(201, {
            success: true,
            telemetry: {
                id: rec.id,
                agent_name: agentName,
                event_type: eventType,
                summary: summary,
                timestamp: rec.getString("timestamp")
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to record telemetry: " + err })
    }
})

// 6. Query Agent Telemetry
routerAdd("GET", "/api/projectbase/telemetry", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let query = e.requestInfo().query || {}
        let filterParts = []

        if (query.agent_name) {
            filterParts.push("agent_name = '" + query.agent_name.replace(/'/g, "\\'") + "'")
        }
        if (query.event_type) {
            filterParts.push("event_type = '" + query.event_type.replace(/'/g, "\\'") + "'")
        }
        if (query.issue_id) {
            filterParts.push("issue = '" + query.issue_id.replace(/'/g, "\\'") + "'")
        }

        let filter = filterParts.join(" && ")
        let limit = parseInt(query.limit || "50", 10)
        if (isNaN(limit) || limit < 1) { limit = 50 }
        if (limit > 200) { limit = 200 }

        let records = e.app.findRecordsByFilter("agent_telemetry", filter, "-created", limit, 0)
        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                issue_id: r.getString("issue"),
                agent_name: r.getString("agent_name"),
                event_type: r.getString("event_type"),
                step: r.getInt("step"),
                summary: r.getString("summary"),
                payload: r.get("payload"),
                timestamp: r.getString("timestamp"),
                created: r.getString("created")
            })
        }

        return e.json(200, { telemetry: out, total: out.length })
    } catch (err) {
        return e.json(500, { error: "Failed to query telemetry: " + err })
    }
})

// 7. Register Webhook
routerAdd("POST", "/api/projectbase/webhooks", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let name = (body.name || "External Orchestrator").trim()
        let url = (body.url || "").trim()
        let events = body.events || ["issue.created", "issue.updated", "issue.moved", "agent.dispatched", "*"]
        let secret = (body.secret || "").trim()
        let projectId = (body.project_id || body.project || "").trim()
        let enabled = body.enabled !== false

        if (!url || !url.startsWith("http")) {
            return e.json(400, { error: "Valid HTTP/HTTPS 'url' is required" })
        }

        let col = e.app.findCollectionByNameOrId("webhooks")
        let rec = new Record(col)
        rec.set("name", name)
        rec.set("url", url)
        rec.set("events", typeof events === "string" ? JSON.parse(events) : events)
        if (secret) { rec.set("secret", secret) }
        if (projectId) { rec.set("project", projectId) }
        rec.set("enabled", enabled)
        rec.set("failure_count", 0)

        e.app.save(rec)

        return e.json(201, {
            success: true,
            webhook: {
                id: rec.id,
                name: name,
                url: url,
                events: rec.get("events"),
                enabled: enabled,
                project: projectId || null
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to register webhook: " + err })
    }
})

// 8. List Webhooks
routerAdd("GET", "/api/projectbase/webhooks", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let records = e.app.findRecordsByFilter("webhooks", "", "-created", 100, 0)
        let out = []
        for (let i = 0; i < records.length; i++) {
            let r = records[i]
            out.push({
                id: r.id,
                name: r.getString("name"),
                url: r.getString("url"),
                events: r.get("events"),
                enabled: r.getBool("enabled"),
                project: r.getString("project") || null,
                last_triggered_at: r.getString("last_triggered_at") || null,
                last_status: r.getInt("last_status"),
                failure_count: r.getInt("failure_count"),
                created: r.getString("created")
            })
        }
        return e.json(200, { webhooks: out, total: out.length })
    } catch (err) {
        return e.json(500, { error: "Failed to list webhooks: " + err })
    }
})

// 9. Delete Webhook
routerAdd("DELETE", "/api/projectbase/webhooks/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let id = e.request.pathValue("id")
        let rec
        try {
            rec = e.app.findRecordById("webhooks", id)
        } catch (nf) {
            return e.json(404, { error: "Webhook not found" })
        }
        e.app.delete(rec)
        return e.json(200, { success: true, message: "Webhook deleted" })
    } catch (err) {
        return e.json(500, { error: "Failed to delete webhook: " + err })
    }
})

// 10. Test / Ping Webhook
routerAdd("POST", "/api/projectbase/webhooks/{id}/test", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let id = e.request.pathValue("id")
        let rec
        try {
            rec = e.app.findRecordById("webhooks", id)
        } catch (nf) {
            return e.json(404, { error: "Webhook not found" })
        }

        let targetUrl = rec.getString("url")
        let pingPayload = JSON.stringify({
            event: "projectbase.ping",
            timestamp: new Date().toISOString(),
            webhook_id: id,
            name: rec.getString("name"),
            message: "ProjectBase webhook test ping"
        })

        let status = 200
        let responseSnippet = ""
        try {
            let res = $http.send({
                url: targetUrl,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "ProjectBase-Webhook/1.0"
                },
                body: pingPayload,
                timeout: 5
            })
            status = res.statusCode
            responseSnippet = (res.raw || "").substring(0, 200)
            rec.set("last_status", status)
            rec.set("last_triggered_at", new Date().toISOString())
            if (status >= 200 && status < 300) {
                rec.set("failure_count", 0)
            } else {
                rec.set("failure_count", rec.getInt("failure_count") + 1)
            }
            e.app.save(rec)
        } catch (postErr) {
            status = 0
            responseSnippet = String(postErr)
            rec.set("last_status", 0)
            rec.set("last_triggered_at", new Date().toISOString())
            rec.set("failure_count", rec.getInt("failure_count") + 1)
            e.app.save(rec)
        }

        return e.json(200, {
            success: status >= 200 && status < 300,
            status_code: status,
            target_url: targetUrl,
            response: responseSnippet
        })
    } catch (err) {
        return e.json(500, { error: "Failed to test webhook: " + err })
    }
})

// Outbound Webhook Event Dispatcher on Issue & Comment changes
onRecordCreate((e) => {
    try {
        let col = e.record.collection().name
        let eventName = col === "issues" ? "issue.created" : (col === "comments" ? "comment.created" : col + ".created")
        let projectId = e.record.getString("project") || ""

        let filter = "enabled = true"
        let webhooks = e.app.findRecordsByFilter("webhooks", filter, "", 50, 0)
        let payload = JSON.stringify({
            event: eventName,
            record_id: e.record.id,
            collection: col,
            data: e.record,
            timestamp: new Date().toISOString()
        })

        for (let i = 0; i < webhooks.length; i++) {
            let wh = webhooks[i]
            let whProj = wh.getString("project")
            if (whProj && projectId && whProj !== projectId) { continue }
            let url = wh.getString("url")
            try {
                $http.send({
                    url: url,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": "ProjectBase-EventDispatcher/1.0"
                    },
                    body: payload,
                    timeout: 4
                })
            } catch (postErr) {}
        }
    } catch (err) {}
    e.next()
}, "issues", "comments")
