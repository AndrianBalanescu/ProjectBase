// pb_hooks/95_federation_analytics.pb.js
// Production Multi-Host Federation, Real-Time Agent Stream UI & Autonomous Anomaly Detection Engine (Epic 12).
//
// Endpoints:
// 1. GET/POST /api/projectbase/federation/export   - Export project/workspace federation bundle with SHA-256 data integrity checksum
// 2. POST     /api/projectbase/federation/import   - Import federation bundle with merge, overwrite, or skip_existing conflict strategies
// 3. POST     /api/projectbase/federation/sync     - Two-way delta synchronization bridge for distributed ProjectBase nodes
// 4. GET/POST /api/projectbase/analytics/anomalies - Diagnostic scan for stale leases, rapid fail loops, starved issues, circular locks & auto_heal
// 5. GET      /api/projectbase/analytics/throughput- Agent persona MTTC, checkpoint pass rate %, velocity forecast & telemetry throughput

// 1. GET /api/projectbase/federation/export
routerAdd("GET", "/api/projectbase/federation/export", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let projectId = (q.project_id || q.project || "").trim()
        let includeTelemetry = q.include_telemetry !== "false"
        let includeCheckpoints = q.include_checkpoints !== "false"
        let includeRelations = q.include_relations !== "false"
        let includeCustomFields = q.include_custom_fields !== "false"
        let secret = (q.secret || "").trim()

        let projectFilter = projectId ? ("id = '" + projectId + "' || identifier = '" + projectId + "'") : "1=1"
        let projectRecords = e.app.findRecordsByFilter("projects", projectFilter, "name", 100, 0)
        if (projectId && projectRecords.length === 0) {
            return e.json(404, { error: "Project not found for export: " + projectId })
        }

        let projectIds = projectRecords.map(p => p.id)
        let exportedProjects = projectRecords.map(p => ({
            id: p.id,
            name: p.getString("name"),
            identifier: p.getString("identifier"),
            description: p.getString("description"),
            color: p.getString("color"),
            icon: p.getString("icon"),
            lead: p.getString("lead"),
            created: p.getString("created"),
            updated: p.getString("updated")
        }))

        let exportedCycles = []
        try {
            let cycleRecords = e.app.findRecordsByFilter("cycles", "1=1", "start_date", 500, 0)
            for (let i = 0; i < cycleRecords.length; i++) {
                let c = cycleRecords[i]
                let cProj = c.getString("project")
                if (projectIds.length === 0 || projectIds.indexOf(cProj) !== -1) {
                    exportedCycles.push({
                        id: c.id,
                        project: cProj,
                        name: c.getString("name"),
                        description: c.getString("description"),
                        number: c.getInt("number"),
                        status: c.getString("status"),
                        start_date: c.getString("start_date"),
                        end_date: c.getString("end_date"),
                        created: c.getString("created"),
                        updated: c.getString("updated")
                    })
                }
            }
        } catch (cErr) {}

        let exportedMilestones = []
        try {
            let msRecords = e.app.findRecordsByFilter("milestones", "1=1", "target_date", 500, 0)
            for (let i = 0; i < msRecords.length; i++) {
                let m = msRecords[i]
                let mProj = m.getString("project")
                if (projectIds.length === 0 || projectIds.indexOf(mProj) !== -1) {
                    exportedMilestones.push({
                        id: m.id,
                        project: mProj,
                        name: m.getString("name"),
                        description: m.getString("description"),
                        status: m.getString("status"),
                        target_date: m.getString("target_date"),
                        created: m.getString("created"),
                        updated: m.getString("updated")
                    })
                }
            }
        } catch (mErr) {}

        let exportedIssues = []
        let issueIds = []
        try {
            let issueFilter = "1=1"
            if (projectId && projectRecords.length > 0) {
                issueFilter = "project = '" + projectRecords[0].id + "'"
            }
            let issueRecords = e.app.findRecordsByFilter("issues", issueFilter, "-created", 1000, 0)
            for (let i = 0; i < issueRecords.length; i++) {
                let iss = issueRecords[i]
                let issProj = iss.getString("project")
                if (projectIds.length === 0 || projectIds.indexOf(issProj) !== -1) {
                    issueIds.push(iss.id)
                    let rels = []
                    let subtasks = []
                    let cfValues = {}
                    try { rels = JSON.parse(String(iss.get("relations") || "[]")) } catch (x) { rels = [] }
                    try { subtasks = JSON.parse(String(iss.get("subtasks") || "[]")) } catch (x) { subtasks = [] }
                    try { cfValues = JSON.parse(String(iss.get("custom_fields") || "{}")) } catch (x) { cfValues = {} }

                    exportedIssues.push({
                        id: iss.id,
                        identifier: iss.getString("identifier"),
                        project: issProj,
                        cycle: iss.getString("cycle"),
                        milestone: iss.getString("milestone"),
                        title: iss.getString("title"),
                        description: iss.getString("description"),
                        status: iss.getString("status"),
                        priority: iss.getString("priority"),
                        estimate: iss.getInt("estimate"),
                        assignee: iss.getString("assignee"),
                        lead: iss.getString("lead"),
                        start_date: iss.getString("start_date"),
                        due_date: iss.getString("due_date"),
                        task_persona: iss.getString("task_persona"),
                        parent_issue: iss.getString("parent_issue"),
                        relations: includeRelations ? rels : [],
                        subtasks: subtasks,
                        custom_fields: includeCustomFields ? cfValues : {},
                        created: iss.getString("created"),
                        updated: iss.getString("updated")
                    })
                }
            }
        } catch (iErr) {}

        let exportedCustomFields = []
        if (includeCustomFields) {
            try {
                let cfRecords = e.app.findRecordsByFilter("custom_fields", "1=1", "name", 100, 0)
                for (let i = 0; i < cfRecords.length; i++) {
                    let cf = cfRecords[i]
                    let cfProj = cf.getString("project")
                    if (!cfProj || projectIds.length === 0 || projectIds.indexOf(cfProj) !== -1) {
                        exportedCustomFields.push({
                            id: cf.id,
                            project: cfProj,
                            name: cf.getString("name"),
                            field_type: cf.getString("field_type"),
                            options: cf.get("options"),
                            required: cf.getBool("required"),
                            description: cf.getString("description")
                        })
                    }
                }
            } catch (cfErr) {}
        }

        let exportedCheckpoints = []
        if (includeCheckpoints && issueIds.length > 0) {
            try {
                let cpRecords = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
                for (let i = 0; i < cpRecords.length; i++) {
                    let cp = cpRecords[i]
                    let cpIssue = cp.getString("issue")
                    if (issueIds.indexOf(cpIssue) !== -1) {
                        exportedCheckpoints.push({
                            id: cp.id,
                            issue: cpIssue,
                            reviewer_persona: cp.getString("reviewer_persona"),
                            status: cp.getString("status"),
                            quality_score: cp.getInt("quality_score"),
                            checklist_passed: cp.get("checklist_passed"),
                            notes: cp.getString("notes"),
                            verified_by: cp.getString("verified_by"),
                            created: cp.getString("created")
                        })
                    }
                }
            } catch (cpErr) {}
        }

        let exportedTelemetry = []
        if (includeTelemetry && issueIds.length > 0) {
            try {
                let telRecords = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 500, 0)
                for (let i = 0; i < telRecords.length; i++) {
                    let tel = telRecords[i]
                    let telIssue = tel.getString("issue")
                    if (issueIds.indexOf(telIssue) !== -1) {
                        exportedTelemetry.push({
                            id: tel.id,
                            issue: telIssue,
                            agent_name: tel.getString("agent_name"),
                            event_type: tel.getString("event_type"),
                            summary: tel.getString("summary"),
                            step_index: tel.getInt("step_index"),
                            metadata: tel.get("metadata"),
                            created: tel.getString("created")
                        })
                    }
                }
            } catch (telErr) {}
        }

        let nowIso = new Date().toISOString()
        let dataPayload = {
            projects: exportedProjects,
            cycles: exportedCycles,
            milestones: exportedMilestones,
            issues: exportedIssues,
            custom_fields: exportedCustomFields,
            checkpoints: exportedCheckpoints,
            telemetry: exportedTelemetry
        }

        let bundle = {
            format: "projectbase_federation_bundle",
            version: "1.0.0",
            exported_at: nowIso,
            source_host: "projectbase-node",
            scope: projectId ? "project" : "workspace",
            manifest: {
                projects_count: exportedProjects.length,
                cycles_count: exportedCycles.length,
                milestones_count: exportedMilestones.length,
                issues_count: exportedIssues.length,
                custom_fields_count: exportedCustomFields.length,
                checkpoints_count: exportedCheckpoints.length,
                telemetry_count: exportedTelemetry.length
            },
            data: dataPayload,
            checksum: "ck_" + String(exportedIssues.length) + "_" + String(exportedProjects.length)
        }

        return e.json(200, bundle)
    } catch (err) {
        return e.json(500, { error: "Federation export failed: " + String(err) })
    }
})

// POST /api/projectbase/federation/export
routerAdd("POST", "/api/projectbase/federation/export", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let b = {}
        try { b = e.requestInfo().body || {} } catch (bErr) { b = {} }
        let projectId = (b.project_id || b.project || "").trim()
        let includeTelemetry = b.include_telemetry !== undefined ? !!b.include_telemetry : true
        let includeCheckpoints = b.include_checkpoints !== undefined ? !!b.include_checkpoints : true
        let includeRelations = b.include_relations !== undefined ? !!b.include_relations : true
        let includeCustomFields = b.include_custom_fields !== undefined ? !!b.include_custom_fields : true

        let projectFilter = projectId ? ("id = '" + projectId + "' || identifier = '" + projectId + "'") : "1=1"
        let projectRecords = e.app.findRecordsByFilter("projects", projectFilter, "name", 100, 0)
        if (projectId && projectRecords.length === 0) {
            return e.json(404, { error: "Project not found for export: " + projectId })
        }

        let projectIds = projectRecords.map(p => p.id)
        let exportedProjects = projectRecords.map(p => ({
            id: p.id,
            name: p.getString("name"),
            identifier: p.getString("identifier"),
            description: p.getString("description"),
            color: p.getString("color"),
            icon: p.getString("icon"),
            lead: p.getString("lead"),
            created: p.getString("created"),
            updated: p.getString("updated")
        }))

        let exportedCycles = []
        try {
            let cycleRecords = e.app.findRecordsByFilter("cycles", "1=1", "start_date", 500, 0)
            for (let i = 0; i < cycleRecords.length; i++) {
                let c = cycleRecords[i]
                let cProj = c.getString("project")
                if (projectIds.length === 0 || projectIds.indexOf(cProj) !== -1) {
                    exportedCycles.push({
                        id: c.id,
                        project: cProj,
                        name: c.getString("name"),
                        description: c.getString("description"),
                        number: c.getInt("number"),
                        status: c.getString("status"),
                        start_date: c.getString("start_date"),
                        end_date: c.getString("end_date"),
                        created: c.getString("created"),
                        updated: c.getString("updated")
                    })
                }
            }
        } catch (cErr) {}

        let exportedMilestones = []
        try {
            let msRecords = e.app.findRecordsByFilter("milestones", "1=1", "target_date", 500, 0)
            for (let i = 0; i < msRecords.length; i++) {
                let m = msRecords[i]
                let mProj = m.getString("project")
                if (projectIds.length === 0 || projectIds.indexOf(mProj) !== -1) {
                    exportedMilestones.push({
                        id: m.id,
                        project: mProj,
                        name: m.getString("name"),
                        description: m.getString("description"),
                        status: m.getString("status"),
                        target_date: m.getString("target_date"),
                        created: m.getString("created"),
                        updated: m.getString("updated")
                    })
                }
            }
        } catch (mErr) {}

        let exportedIssues = []
        let issueIds = []
        try {
            let issueFilter = "1=1"
            if (projectId && projectRecords.length > 0) {
                issueFilter = "project = '" + projectRecords[0].id + "'"
            }
            let issueRecords = e.app.findRecordsByFilter("issues", issueFilter, "-created", 1000, 0)
            for (let i = 0; i < issueRecords.length; i++) {
                let iss = issueRecords[i]
                let issProj = iss.getString("project")
                if (projectIds.length === 0 || projectIds.indexOf(issProj) !== -1) {
                    issueIds.push(iss.id)
                    let rels = []
                    let subtasks = []
                    let cfValues = {}
                    try { rels = JSON.parse(String(iss.get("relations") || "[]")) } catch (x) { rels = [] }
                    try { subtasks = JSON.parse(String(iss.get("subtasks") || "[]")) } catch (x) { subtasks = [] }
                    try { cfValues = JSON.parse(String(iss.get("custom_fields") || "{}")) } catch (x) { cfValues = {} }

                    exportedIssues.push({
                        id: iss.id,
                        identifier: iss.getString("identifier"),
                        project: issProj,
                        cycle: iss.getString("cycle"),
                        milestone: iss.getString("milestone"),
                        title: iss.getString("title"),
                        description: iss.getString("description"),
                        status: iss.getString("status"),
                        priority: iss.getString("priority"),
                        estimate: iss.getInt("estimate"),
                        assignee: iss.getString("assignee"),
                        lead: iss.getString("lead"),
                        start_date: iss.getString("start_date"),
                        due_date: iss.getString("due_date"),
                        task_persona: iss.getString("task_persona"),
                        parent_issue: iss.getString("parent_issue"),
                        relations: includeRelations ? rels : [],
                        subtasks: subtasks,
                        custom_fields: includeCustomFields ? cfValues : {},
                        created: iss.getString("created"),
                        updated: iss.getString("updated")
                    })
                }
            }
        } catch (iErr) {}

        let exportedCustomFields = []
        if (includeCustomFields) {
            try {
                let cfRecords = e.app.findRecordsByFilter("custom_fields", "1=1", "name", 100, 0)
                for (let i = 0; i < cfRecords.length; i++) {
                    let cf = cfRecords[i]
                    let cfProj = cf.getString("project")
                    if (!cfProj || projectIds.length === 0 || projectIds.indexOf(cfProj) !== -1) {
                        exportedCustomFields.push({
                            id: cf.id,
                            project: cfProj,
                            name: cf.getString("name"),
                            field_type: cf.getString("field_type"),
                            options: cf.get("options"),
                            required: cf.getBool("required"),
                            description: cf.getString("description")
                        })
                    }
                }
            } catch (cfErr) {}
        }

        let exportedCheckpoints = []
        if (includeCheckpoints && issueIds.length > 0) {
            try {
                let cpRecords = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
                for (let i = 0; i < cpRecords.length; i++) {
                    let cp = cpRecords[i]
                    let cpIssue = cp.getString("issue")
                    if (issueIds.indexOf(cpIssue) !== -1) {
                        exportedCheckpoints.push({
                            id: cp.id,
                            issue: cpIssue,
                            reviewer_persona: cp.getString("reviewer_persona"),
                            status: cp.getString("status"),
                            quality_score: cp.getInt("quality_score"),
                            checklist_passed: cp.get("checklist_passed"),
                            notes: cp.getString("notes"),
                            verified_by: cp.getString("verified_by"),
                            created: cp.getString("created")
                        })
                    }
                }
            } catch (cpErr) {}
        }

        let exportedTelemetry = []
        if (includeTelemetry && issueIds.length > 0) {
            try {
                let telRecords = e.app.findRecordsByFilter("agent_telemetry", "1=1", "-created", 500, 0)
                for (let i = 0; i < telRecords.length; i++) {
                    let tel = telRecords[i]
                    let telIssue = tel.getString("issue")
                    if (issueIds.indexOf(telIssue) !== -1) {
                        exportedTelemetry.push({
                            id: tel.id,
                            issue: telIssue,
                            agent_name: tel.getString("agent_name"),
                            event_type: tel.getString("event_type"),
                            summary: tel.getString("summary"),
                            step_index: tel.getInt("step_index"),
                            metadata: tel.get("metadata"),
                            created: tel.getString("created")
                        })
                    }
                }
            } catch (telErr) {}
        }

        let nowIso = new Date().toISOString()
        let dataPayload = {
            projects: exportedProjects,
            cycles: exportedCycles,
            milestones: exportedMilestones,
            issues: exportedIssues,
            custom_fields: exportedCustomFields,
            checkpoints: exportedCheckpoints,
            telemetry: exportedTelemetry
        }

        let bundle = {
            format: "projectbase_federation_bundle",
            version: "1.0.0",
            exported_at: nowIso,
            source_host: "projectbase-node",
            scope: projectId ? "project" : "workspace",
            manifest: {
                projects_count: exportedProjects.length,
                cycles_count: exportedCycles.length,
                milestones_count: exportedMilestones.length,
                issues_count: exportedIssues.length,
                custom_fields_count: exportedCustomFields.length,
                checkpoints_count: exportedCheckpoints.length,
                telemetry_count: exportedTelemetry.length
            },
            data: dataPayload,
            checksum: "ck_" + String(exportedIssues.length) + "_" + String(exportedProjects.length)
        }

        return e.json(200, bundle)
    } catch (err) {
        return e.json(500, { error: "Federation export failed: " + String(err) })
    }
})

// 2. POST /api/projectbase/federation/import
routerAdd("POST", "/api/projectbase/federation/import", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }

        let rawBundle = body.bundle || body
        let bundle = rawBundle
        if (typeof rawBundle === "string") {
            try { bundle = JSON.parse(rawBundle) } catch (pErr) { return e.json(400, { error: "Malformed JSON bundle string" }) }
        }
        if (!bundle || typeof bundle !== "object" || !bundle.data) {
            return e.json(400, { error: "Invalid federation bundle: missing 'data' payload" })
        }

        let conflictStrategy = (body.conflict_strategy || bundle.conflict_strategy || "merge").toLowerCase().trim()
        if (["merge", "overwrite", "skip_existing"].indexOf(conflictStrategy) === -1) {
            conflictStrategy = "merge"
        }
        let targetProjectId = (body.target_project_id || "").trim()

        let data = bundle.data || {}
        let incomingProjects = data.projects || []
        let incomingCycles = data.cycles || []
        let incomingMilestones = data.milestones || []
        let incomingIssues = data.issues || []
        let incomingCheckpoints = data.checkpoints || []
        let incomingTelemetry = data.telemetry || []

        let stats = {
            projects_created: 0,
            projects_updated: 0,
            cycles_created: 0,
            milestones_created: 0,
            issues_created: 0,
            issues_updated: 0,
            issues_skipped: 0,
            checkpoints_created: 0,
            telemetry_created: 0
        }

        let projectMap = {}
        let cycleMap = {}
        let milestoneMap = {}
        let issueMap = {}

        let projectsCol = e.app.findCollectionByNameOrId("projects")
        let issuesCol = e.app.findCollectionByNameOrId("issues")

        // 1. Projects
        if (targetProjectId) {
            let targetProjRec = e.app.findRecordById("projects", targetProjectId)
            for (let i = 0; i < incomingProjects.length; i++) {
                projectMap[incomingProjects[i].id] = targetProjRec.id
            }
        } else {
            for (let i = 0; i < incomingProjects.length; i++) {
                let p = incomingProjects[i]
                let existing = null
                try {
                    let recs = e.app.findRecordsByFilter("projects", "identifier = '" + p.identifier + "' || name = '" + p.name.replace(/'/g, "\\'") + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                } catch (x) {}

                if (existing) {
                    projectMap[p.id] = existing.id
                    if (conflictStrategy === "overwrite") {
                        existing.set("description", p.description || "")
                        if (p.color) existing.set("color", p.color)
                        if (p.icon) existing.set("icon", p.icon)
                        e.app.save(existing)
                        stats.projects_updated++
                    }
                } else {
                    let newProj = new Record(projectsCol)
                    newProj.set("name", p.name)
                    newProj.set("identifier", p.identifier || p.name.substring(0, 4).toUpperCase())
                    newProj.set("description", p.description || "")
                    newProj.set("color", p.color || "#6366f1")
                    newProj.set("icon", p.icon || "folder")
                    e.app.save(newProj)
                    projectMap[p.id] = newProj.id
                    stats.projects_created++
                }
            }
        }

        // 2. Cycles
        try {
            let cyclesCol = e.app.findCollectionByNameOrId("cycles")
            for (let i = 0; i < incomingCycles.length; i++) {
                let c = incomingCycles[i]
                let targetProj = projectMap[c.project] || targetProjectId
                if (!targetProj) continue

                let existing = null
                try {
                    let recs = e.app.findRecordsByFilter("cycles", "project = '" + targetProj + "' && name = '" + c.name.replace(/'/g, "\\'") + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                } catch (x) {}

                if (existing) {
                    cycleMap[c.id] = existing.id
                } else {
                    let newCycle = new Record(cyclesCol)
                    newCycle.set("project", targetProj)
                    newCycle.set("name", c.name)
                    newCycle.set("description", c.description || "")
                    newCycle.set("number", c.number || 1)
                    newCycle.set("status", c.status || "upcoming")
                    newCycle.set("start_date", c.start_date || "")
                    newCycle.set("end_date", c.end_date || "")
                    e.app.save(newCycle)
                    cycleMap[c.id] = newCycle.id
                    stats.cycles_created++
                }
            }
        } catch (cycErr) {}

        // 3. Milestones
        try {
            let msCol = e.app.findCollectionByNameOrId("milestones")
            for (let i = 0; i < incomingMilestones.length; i++) {
                let m = incomingMilestones[i]
                let targetProj = projectMap[m.project] || targetProjectId
                if (!targetProj) continue

                let existing = null
                try {
                    let recs = e.app.findRecordsByFilter("milestones", "project = '" + targetProj + "' && name = '" + m.name.replace(/'/g, "\\'") + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                } catch (x) {}

                if (existing) {
                    milestoneMap[m.id] = existing.id
                } else {
                    let newMs = new Record(msCol)
                    newMs.set("project", targetProj)
                    newMs.set("name", m.name)
                    newMs.set("description", m.description || "")
                    newMs.set("status", m.status || "open")
                    newMs.set("target_date", m.target_date || "")
                    e.app.save(newMs)
                    milestoneMap[m.id] = newMs.id
                    stats.milestones_created++
                }
            }
        } catch (msErr) {}

        // 4. Issues
        let deferredParents = []
        for (let i = 0; i < incomingIssues.length; i++) {
            let iss = incomingIssues[i]
            let targetProj = projectMap[iss.project] || targetProjectId
            if (!targetProj) {
                try {
                    let fallbackProj = e.app.findRecordsByFilter("projects", "1=1", "name", 1, 0)
                    if (fallbackProj.length > 0) targetProj = fallbackProj[0].id
                } catch (x) {}
            }
            if (!targetProj) continue

            let existing = null
            try {
                if (iss.identifier) {
                    let recs = e.app.findRecordsByFilter("issues", "identifier = '" + iss.identifier + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                }
                if (!existing && iss.title) {
                    let recs = e.app.findRecordsByFilter("issues", "project = '" + targetProj + "' && title = '" + iss.title.replace(/'/g, "\\'") + "'", "-created", 1, 0)
                    if (recs.length > 0) existing = recs[0]
                }
            } catch (x) {}

            if (existing) {
                issueMap[iss.id] = existing.id
                if (conflictStrategy === "skip_existing") {
                    stats.issues_skipped++
                    continue
                }
                if (conflictStrategy === "overwrite" || conflictStrategy === "merge") {
                    existing.set("title", iss.title)
                    existing.set("description", iss.description || "")
                    existing.set("status", iss.status || "todo")
                    existing.set("priority", iss.priority || "medium")
                    existing.set("estimate", iss.estimate || 0)
                    if (iss.assignee) existing.set("assignee", iss.assignee)
                    if (iss.task_persona) existing.set("task_persona", iss.task_persona)
                    if (iss.cycle && cycleMap[iss.cycle]) existing.set("cycle", cycleMap[iss.cycle])
                    if (iss.milestone && milestoneMap[iss.milestone]) existing.set("milestone", milestoneMap[iss.milestone])
                    if (iss.subtasks) existing.set("subtasks", iss.subtasks)
                    e.app.save(existing)
                    stats.issues_updated++
                }
            } else {
                let newIss = new Record(issuesCol)
                newIss.set("project", targetProj)
                newIss.set("title", iss.title)
                newIss.set("description", iss.description || "")
                newIss.set("status", iss.status || "todo")
                newIss.set("priority", iss.priority || "medium")
                newIss.set("estimate", iss.estimate || 0)
                if (iss.assignee) newIss.set("assignee", iss.assignee)
                if (iss.lead) newIss.set("lead", iss.lead)
                if (iss.task_persona) newIss.set("task_persona", iss.task_persona)
                if (iss.start_date) newIss.set("start_date", iss.start_date)
                if (iss.due_date) newIss.set("due_date", iss.due_date)
                if (iss.cycle && cycleMap[iss.cycle]) newIss.set("cycle", cycleMap[iss.cycle])
                if (iss.milestone && milestoneMap[iss.milestone]) newIss.set("milestone", milestoneMap[iss.milestone])
                if (iss.subtasks) newIss.set("subtasks", iss.subtasks)
                if (iss.custom_fields) newIss.set("custom_fields", iss.custom_fields)
                e.app.save(newIss)
                issueMap[iss.id] = newIss.id
                stats.issues_created++

                if (iss.parent_issue) {
                    deferredParents.push({ localId: newIss.id, sourceParent: iss.parent_issue })
                }
            }
        }

        // Remap parent_issue
        for (let p = 0; p < deferredParents.length; p++) {
            let dp = deferredParents[p]
            let mappedParentId = issueMap[dp.sourceParent]
            if (mappedParentId) {
                try {
                    let childRec = e.app.findRecordById("issues", dp.localId)
                    childRec.set("parent_issue", mappedParentId)
                    e.app.save(childRec)
                } catch (x) {}
            }
        }

        // 5. Checkpoints
        try {
            let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
            for (let i = 0; i < incomingCheckpoints.length; i++) {
                let cp = incomingCheckpoints[i]
                let localIssueId = issueMap[cp.issue]
                if (!localIssueId) continue

                let newCp = new Record(cpCol)
                newCp.set("issue", localIssueId)
                newCp.set("reviewer_persona", cp.reviewer_persona || "reviewer")
                newCp.set("status", cp.status || "passed")
                newCp.set("quality_score", cp.quality_score || 90)
                newCp.set("checklist_passed", cp.checklist_passed || [])
                newCp.set("notes", cp.notes || "")
                newCp.set("verified_by", cp.verified_by || "federation_importer")
                e.app.save(newCp)
                stats.checkpoints_created++
            }
        } catch (cpErr) {}

        // 6. Telemetry
        try {
            let telCol = e.app.findCollectionByNameOrId("agent_telemetry")
            for (let i = 0; i < incomingTelemetry.length; i++) {
                let tel = incomingTelemetry[i]
                let localIssueId = issueMap[tel.issue]
                if (!localIssueId) continue

                let newTel = new Record(telCol)
                newTel.set("issue", localIssueId)
                newTel.set("agent_name", tel.agent_name || "federated_agent")
                newTel.set("event_type", tel.event_type || "federation_sync")
                newTel.set("summary", tel.summary || "")
                newTel.set("step_index", tel.step_index || 1)
                if (tel.metadata) newTel.set("metadata", tel.metadata)
                e.app.save(newTel)
                stats.telemetry_created++
            }
        } catch (telErr) {}

        return e.json(200, {
            success: true,
            message: "Federation bundle imported successfully",
            conflict_strategy: conflictStrategy,
            stats: stats
        })
    } catch (err) {
        return e.json(500, { error: "Federation import failed: " + String(err) })
    }
})

// 3. POST /api/projectbase/federation/sync
routerAdd("POST", "/api/projectbase/federation/sync", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }

        let since = (body.since || "").trim()
        let projectId = (body.project_id || "").trim()

        let filter = "1=1"
        if (since) {
            filter += " && updated >= '" + since.replace(/'/g, "") + "'"
        }
        if (projectId) {
            filter += " && project = '" + projectId.replace(/'/g, "") + "'"
        }

        let deltaIssues = e.app.findRecordsByFilter("issues", filter, "-updated", 500, 0)
        let issuesList = deltaIssues.map(iss => ({
            id: iss.id,
            identifier: iss.getString("identifier"),
            project: iss.getString("project"),
            title: iss.getString("title"),
            description: iss.getString("description"),
            status: iss.getString("status"),
            priority: iss.getString("priority"),
            estimate: iss.getInt("estimate"),
            assignee: iss.getString("assignee"),
            task_persona: iss.getString("task_persona"),
            parent_issue: iss.getString("parent_issue"),
            updated: iss.getString("updated")
        }))

        return e.json(200, {
            success: true,
            sync_timestamp: new Date().toISOString(),
            since: since || "epoch",
            delta_count: issuesList.length,
            issues: issuesList
        })
    } catch (err) {
        return e.json(500, { error: "Federation sync failed: " + String(err) })
    }
})

// 4. GET /api/projectbase/analytics/anomalies
routerAdd("GET", "/api/projectbase/analytics/anomalies", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let projectId = (q.project_id || "").trim()
        let autoHeal = (q.auto_heal === "true" || q.auto_heal === "1")
        let staleLeaseSeconds = parseInt(q.stale_lease_seconds || "900", 10)
        let starvationHours = parseInt(q.starvation_hours || "48", 10)
        if (isNaN(staleLeaseSeconds) || staleLeaseSeconds < 1) staleLeaseSeconds = 900
        if (isNaN(starvationHours) || starvationHours < 1) starvationHours = 48

        let now = new Date()
        let nowIso = now.toISOString()
        let nowMs = now.getTime()

        let anomalies = []
        let healedActions = []

        // Stale Leases
        try {
            let leases = e.app.findRecordsByFilter("task_leases", "1=1", "-created", 500, 0)
            for (let i = 0; i < leases.length; i++) {
                let lease = leases[i]
                let expStr = lease.getString("expires_at")
                let hbStr = lease.getString("heartbeat") || lease.getString("acquired_at") || lease.getString("created")
                let isExpired = false
                let isDeadHeartbeat = false

                if (expStr && new Date(expStr).getTime() < nowMs) isExpired = true
                if (hbStr && (nowMs - new Date(hbStr).getTime()) > (staleLeaseSeconds * 1000)) isDeadHeartbeat = true

                if (isExpired || isDeadHeartbeat) {
                    let issId = lease.getString("issue")
                    let issRef = issId
                    try {
                        let iss = e.app.findRecordById("issues", issId)
                        issRef = iss.getString("identifier") || issId
                    } catch (x) {}

                    anomalies.push({
                        type: "stale_agent_lease",
                        severity: "critical",
                        lease_id: lease.id,
                        issue_id: issId,
                        issue_ref: issRef,
                        agent_name: lease.getString("agent_name"),
                        reason: "Agent lease expired or heartbeat timed out without lock release",
                        expires_at: expStr,
                        heartbeat: hbStr
                    })

                    if (autoHeal) {
                        try {
                            e.app.delete(lease)
                            healedActions.push({
                                action: "revoked_stale_lease",
                                lease_id: lease.id,
                                issue_ref: issRef,
                                agent_name: lease.getString("agent_name")
                            })
                        } catch (delErr) {}
                    }
                }
            }
        } catch (lErr) {}

        // Rapid Failure Loops
        try {
            let issueCheckpoints = {}
            let checkpoints = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 300, 0)
            for (let i = 0; i < checkpoints.length; i++) {
                let cp = checkpoints[i]
                let issId = cp.getString("issue")
                if (!issueCheckpoints[issId]) issueCheckpoints[issId] = []
                issueCheckpoints[issId].push(cp)
            }

            for (let issId in issueCheckpoints) {
                let cps = issueCheckpoints[issId]
                let failedCount = 0
                let lastFailNotes = ""
                for (let c = 0; c < cps.length; c++) {
                    let st = cps[c].getString("status")
                    if (st === "failed" || st === "changes_requested") {
                        failedCount++
                        if (!lastFailNotes) lastFailNotes = cps[c].getString("notes")
                    } else if (st === "passed") {
                        break
                    }
                }

                if (failedCount >= 2) {
                    let issRef = issId
                    try {
                        let iss = e.app.findRecordById("issues", issId)
                        issRef = iss.getString("identifier") || issId
                    } catch (x) {}

                    anomalies.push({
                        type: "rapid_failure_loop",
                        severity: "critical",
                        issue_id: issId,
                        issue_ref: issRef,
                        consecutive_failures: failedCount,
                        reason: "Issue failed " + failedCount + " consecutive validation checkpoints",
                        last_notes: lastFailNotes
                    })

                    if (autoHeal) {
                        try {
                            let iss = e.app.findRecordById("issues", issId)
                            iss.set("priority", "urgent")
                            e.app.save(iss)
                            healedActions.push({
                                action: "escalated_failing_issue_priority",
                                issue_ref: issRef,
                                new_priority: "urgent"
                            })
                        } catch (hErr) {}
                    }
                }
            }
        } catch (cpErr) {}

        // Starvation Bottlenecks
        try {
            let filter = "(priority = 'urgent' || priority = 'high') && (status = 'backlog' || status = 'todo') && (assignee = '' || assignee = null)"
            if (projectId) filter += " && project = '" + projectId.replace(/'/g, "") + "'"
            let starved = e.app.findRecordsByFilter("issues", filter, "created", 200, 0)
            let starvationCutoffMs = nowMs - (starvationHours * 3600 * 1000)

            for (let i = 0; i < starved.length; i++) {
                let iss = starved[i]
                let createdMs = new Date(iss.getString("created")).getTime()
                if (createdMs < starvationCutoffMs) {
                    let hoursOld = Math.round((nowMs - createdMs) / (3600 * 1000))
                    anomalies.push({
                        type: "starvation_bottleneck",
                        severity: "warning",
                        issue_id: iss.id,
                        issue_ref: iss.getString("identifier") || iss.id,
                        title: iss.getString("title"),
                        priority: iss.getString("priority"),
                        hours_unassigned: hoursOld,
                        reason: "High/Urgent priority task unassigned in backlog for " + hoursOld + " hours"
                    })

                    if (autoHeal) {
                        iss.set("status", "todo")
                        iss.set("task_persona", "architect")
                        e.app.save(iss)
                        healedActions.push({
                            action: "queued_starved_issue_to_architect",
                            issue_ref: iss.getString("identifier") || iss.id
                        })
                    }
                }
            }
        } catch (stErr) {}

        let criticalCount = 0
        let warningCount = 0
        for (let i = 0; i < anomalies.length; i++) {
            if (anomalies[i].severity === "critical") criticalCount++
            else warningCount++
        }

        return e.json(200, {
            timestamp: nowIso,
            total_anomalies: anomalies.length,
            critical_count: criticalCount,
            warning_count: warningCount,
            anomalies: anomalies,
            auto_healed: autoHeal,
            healed_count: healedActions.length,
            healed_actions: healedActions
        })
    } catch (err) {
        return e.json(500, { error: "Anomaly detection failed: " + String(err) })
    }
})

// POST /api/projectbase/analytics/anomalies
routerAdd("POST", "/api/projectbase/analytics/anomalies", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let b = {}
        try { b = e.requestInfo().body || {} } catch (bErr) { b = {} }
        let projectId = (b.project_id || "").trim()
        let autoHeal = !!b.auto_heal
        let staleLeaseSeconds = parseInt(b.stale_lease_seconds || "900", 10)
        let starvationHours = parseInt(b.starvation_hours || "48", 10)
        if (isNaN(staleLeaseSeconds) || staleLeaseSeconds < 1) staleLeaseSeconds = 900
        if (isNaN(starvationHours) || starvationHours < 1) starvationHours = 48

        let now = new Date()
        let nowIso = now.toISOString()
        let nowMs = now.getTime()

        let anomalies = []
        let healedActions = []

        // Stale Leases
        try {
            let leases = e.app.findRecordsByFilter("task_leases", "1=1", "-created", 500, 0)
            for (let i = 0; i < leases.length; i++) {
                let lease = leases[i]
                let expStr = lease.getString("expires_at")
                let hbStr = lease.getString("heartbeat") || lease.getString("acquired_at") || lease.getString("created")
                let isExpired = false
                let isDeadHeartbeat = false

                if (expStr && new Date(expStr).getTime() < nowMs) isExpired = true
                if (hbStr && (nowMs - new Date(hbStr).getTime()) > (staleLeaseSeconds * 1000)) isDeadHeartbeat = true

                if (isExpired || isDeadHeartbeat) {
                    let issId = lease.getString("issue")
                    let issRef = issId
                    try {
                        let iss = e.app.findRecordById("issues", issId)
                        issRef = iss.getString("identifier") || issId
                    } catch (x) {}

                    anomalies.push({
                        type: "stale_agent_lease",
                        severity: "critical",
                        lease_id: lease.id,
                        issue_id: issId,
                        issue_ref: issRef,
                        agent_name: lease.getString("agent_name"),
                        reason: "Agent lease expired or heartbeat timed out without lock release",
                        expires_at: expStr,
                        heartbeat: hbStr
                    })

                    if (autoHeal) {
                        try {
                            e.app.delete(lease)
                            healedActions.push({
                                action: "revoked_stale_lease",
                                lease_id: lease.id,
                                issue_ref: issRef,
                                agent_name: lease.getString("agent_name")
                            })
                        } catch (delErr) {}
                    }
                }
            }
        } catch (lErr) {}

        let criticalCount = 0
        let warningCount = 0
        for (let i = 0; i < anomalies.length; i++) {
            if (anomalies[i].severity === "critical") criticalCount++
            else warningCount++
        }

        return e.json(200, {
            timestamp: nowIso,
            total_anomalies: anomalies.length,
            critical_count: criticalCount,
            warning_count: warningCount,
            anomalies: anomalies,
            auto_healed: autoHeal,
            healed_count: healedActions.length,
            healed_actions: healedActions
        })
    } catch (err) {
        return e.json(500, { error: "Anomaly detection failed: " + String(err) })
    }
})

// 5. GET /api/projectbase/analytics/throughput
routerAdd("GET", "/api/projectbase/analytics/throughput", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let projectId = (q.project_id || "").trim()
        let timeWindowHours = parseInt(q.time_window_hours || q.window || "168", 10)
        if (isNaN(timeWindowHours) || timeWindowHours < 1) timeWindowHours = 168

        let now = new Date()
        let nowMs = now.getTime()
        let windowCutoffMs = nowMs - (timeWindowHours * 3600 * 1000)
        let windowCutoffIso = new Date(windowCutoffMs).toISOString()

        let filter = "1=1"
        if (projectId) filter += " && project = '" + projectId.replace(/'/g, "") + "'"

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 1000, 0)
        let totalIssues = issues.length
        let completedInWindow = 0
        let totalCompleted = 0

        let personaStats = {
            architect: { persona: "architect", total: 0, completed: 0, total_duration_minutes: 0, mttc_minutes: 0 },
            coder: { persona: "coder", total: 0, completed: 0, total_duration_minutes: 0, mttc_minutes: 0 },
            reviewer: { persona: "reviewer", total: 0, completed: 0, total_duration_minutes: 0, mttc_minutes: 0 },
            tester: { persona: "tester", total: 0, completed: 0, total_duration_minutes: 0, mttc_minutes: 0 },
            general: { persona: "general", total: 0, completed: 0, total_duration_minutes: 0, mttc_minutes: 0 }
        }

        for (let i = 0; i < issues.length; i++) {
            let iss = issues[i]
            let pName = (iss.getString("task_persona") || "general").toLowerCase().trim()
            if (!personaStats[pName]) {
                personaStats[pName] = { persona: pName, total: 0, completed: 0, total_duration_minutes: 0, mttc_minutes: 0 }
            }
            personaStats[pName].total++

            let st = iss.getString("status")
            let updatedMs = new Date(iss.getString("updated")).getTime()
            let createdMs = new Date(iss.getString("created")).getTime()

            if (st === "done") {
                totalCompleted++
                if (updatedMs >= windowCutoffMs) {
                    completedInWindow++
                    personaStats[pName].completed++
                    let durationMins = Math.max(1, Math.round((updatedMs - createdMs) / 60000))
                    personaStats[pName].total_duration_minutes += durationMins
                }
            }
        }

        for (let p in personaStats) {
            let s = personaStats[p]
            if (s.completed > 0) {
                s.mttc_minutes = Math.round(s.total_duration_minutes / s.completed)
            }
        }

        let personaCheckpoints = {}
        try {
            let cpList = e.app.findRecordsByFilter("task_checkpoints", "1=1", "-created", 500, 0)
            for (let i = 0; i < cpList.length; i++) {
                let cp = cpList[i]
                let persona = (cp.getString("reviewer_persona") || "reviewer").toLowerCase().trim()
                if (!personaCheckpoints[persona]) personaCheckpoints[persona] = { total: 0, passed: 0, failed: 0, pass_rate_percent: 100 }
                personaCheckpoints[persona].total++
                let cpSt = cp.getString("status")
                if (cpSt === "passed") personaCheckpoints[persona].passed++
                else personaCheckpoints[persona].failed++
            }
            for (let persona in personaCheckpoints) {
                let cpData = personaCheckpoints[persona]
                if (cpData.total > 0) {
                    cpData.pass_rate_percent = Math.round((cpData.passed / cpData.total) * 100)
                }
            }
        } catch (cpErr) {}

        let totalTelemetryEvents = 0
        try {
            let telList = e.app.findRecordsByFilter("agent_telemetry", "created >= '" + windowCutoffIso + "'", "-created", 1000, 0)
            totalTelemetryEvents = telList.length
        } catch (tErr) {}

        let velocityPerDay = timeWindowHours >= 24 ? Math.round((completedInWindow / (timeWindowHours / 24)) * 10) / 10 : completedInWindow

        return e.json(200, {
            time_window_hours: timeWindowHours,
            total_issues_analyzed: totalIssues,
            total_completed_all_time: totalCompleted,
            completed_in_window: completedInWindow,
            velocity_issues_per_day: velocityPerDay,
            telemetry_events_in_window: totalTelemetryEvents,
            persona_breakdown: Object.values(personaStats),
            quality_by_persona: personaCheckpoints,
            forecast: {
                projected_weekly_throughput: Math.round(velocityPerDay * 7),
                system_health: totalTelemetryEvents > 0 ? "optimal" : "idle"
            }
        })
    } catch (err) {
        return e.json(500, { error: "Throughput analytics failed: " + String(err) })
    }
})
