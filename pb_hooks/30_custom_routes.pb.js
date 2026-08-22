// pb_hooks/30_custom_routes.pb.js
// Custom endpoints for AI agents, statistics, and doc redirects

routerAdd("GET", "/api/projectbase/health", (e) => {
    return e.json(200, {
        status: "healthy",
        service: "ProjectBase",
        engine: "PocketBase + Vue 3",
        time: new Date().toISOString()
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
        return e.json(500, { error: err.message })
    }
})

routerAdd("POST", "/api/projectbase/quick-task", (e) => {
    try {
        let body = e.requestInfo().body
        if (!body.title) {
            return e.json(400, { error: "Missing required 'title' field" })
        }

        let projectCol = e.app.findCollectionByNameOrId("projects")
        let issuesCol = e.app.findCollectionByNameOrId("issues")

        let targetProject = null
        if (body.project_id) {
            targetProject = e.app.findRecordById("projects", body.project_id)
        } else if (body.project_key) {
            let found = e.app.findRecordsByFilter("projects", `identifier = '${body.project_key.toUpperCase()}'`, "-created", 1, 0)
            if (found && found.length > 0) targetProject = found[0]
        }

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
        return e.json(500, { error: err.message })
    }
})
