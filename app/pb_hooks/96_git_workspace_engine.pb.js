// pb_hooks/96_git_workspace_engine.pb.js
// Production Autonomous Agent Code Sandbox, Git Artifact Workspace Engine & Webhook Auto-Triage (Epic 13).
//
// Note: In PocketBase Goja runtime, module-scope function/const declarations are NOT resolvable
// inside hook callbacks (throws ReferenceError). All helper functions are inlined inside each callback.
//
// Endpoints:
// 1. GET  /api/projectbase/git/artifacts    - Query linked branches, commits, PRs, CI runs, and diff patches
// 2. POST /api/projectbase/git/artifacts    - Link git artifact (commit, branch, PR, CI) to an issue + auto-stage Kanban
// 3. POST /api/projectbase/git/patch        - Stage unified diff or patch for peer review & agent verification
// 4. GET  /api/projectbase/git/patch/:id    - Retrieve full patch content & unified diff statistics
// 5. POST /api/projectbase/webhooks/git     - Universal Git webhook receiver (GitHub/GitLab/CI) for automated issue triage
//                                            (auth: e.auth OR valid X-Hub-Signature-256 HMAC via PROJECTBASE_GIT_WEBHOOK_SECRET; no secret => fail-closed)
// 6. GET  /api/projectbase/git/status       - Aggregated workspace/project git status & CI reliability metrics

// 1. GET /api/projectbase/git/artifacts
routerAdd("GET", "/api/projectbase/git/artifacts", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let issueParam = (q.issue_id || q.issue || q.identifier || "").trim()
        let projectId = (q.project_id || q.project || "").trim()
        let artifactType = (q.type || q.artifact_type || "").trim()
        let limit = parseInt(q.limit || "50", 10)
        if (isNaN(limit) || limit <= 0) limit = 50

        let filterParts = []

        // Resolve issue by ID or identifier (e.g. PB-123)
        let resolvedIssue = null
        if (issueParam) {
            try {
                if (issueParam.indexOf("-") !== -1) {
                    let parts = issueParam.split("-")
                    let projIdent = parts[0].toUpperCase()
                    let num = parseInt(parts[1], 10)
                    if (!isNaN(num)) {
                        let projects = e.app.findRecordsByFilter("projects", "identifier = '" + projIdent + "'", "", 1, 0)
                        if (projects && projects.length > 0) {
                            let issues = e.app.findRecordsByFilter("issues", "project = '" + projects[0].id + "' && issue_number = " + num, "", 1, 0)
                            if (issues && issues.length > 0) resolvedIssue = issues[0]
                        }
                    }
                }
                if (!resolvedIssue) {
                    resolvedIssue = e.app.findRecordById("issues", issueParam)
                }
            } catch (err) {}

            if (resolvedIssue) {
                filterParts.push("issue = '" + resolvedIssue.id + "'")
            } else {
                return e.json(200, { items: [], total: 0, issue: null })
            }
        }

        if (projectId) {
            filterParts.push("project = '" + projectId + "'")
        }
        if (artifactType) {
            filterParts.push("artifact_type = '" + artifactType + "'")
        }

        let filterStr = filterParts.length > 0 ? filterParts.join(" && ") : "1=1"
        let records = []
        try {
            records = e.app.findRecordsByFilter("git_artifacts", filterStr, "-created", limit, 0)
        } catch (err) {
            records = []
        }

        let items = records.map(r => ({
            id: r.id,
            project: r.get("project"),
            issue: r.get("issue"),
            artifact_type: r.get("artifact_type"),
            identifier: r.get("identifier"),
            title: r.get("title"),
            url: r.get("url"),
            status: r.get("status"),
            author: r.get("author"),
            diff_stats: r.get("diff_stats") || {},
            metadata: r.get("metadata") || {},
            created: r.get("created"),
            updated: r.get("updated")
        }))

        return e.json(200, {
            items: items,
            total: items.length,
            issue: resolvedIssue ? {
                id: resolvedIssue.id,
                title: resolvedIssue.get("title"),
                status: resolvedIssue.get("status"),
                git_branch: resolvedIssue.get("git_branch") || "",
                pr_url: resolvedIssue.get("pr_url") || "",
                pr_status: resolvedIssue.get("pr_status") || ""
            } : null
        })
    } catch (err) {
        return e.json(500, { error: "Failed to query git artifacts: " + String(err) })
    }
})

// 2. POST /api/projectbase/git/artifacts
routerAdd("POST", "/api/projectbase/git/artifacts", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let artifactType = (body.artifact_type || body.type || "").trim().toLowerCase()
        let identifier = (body.identifier || body.name || body.sha || body.branch || "").trim()
        let title = (body.title || body.message || "").trim()
        let url = (body.url || "").trim()
        let status = (body.status || "open").trim().toLowerCase()
        let author = (body.author || e.auth.get("name") || e.auth.get("email") || "agent").trim()
        let diffStats = body.diff_stats || null
        let patchContent = (body.patch_content || body.diff || "").trim()
        let metadata = body.metadata || {}
        let issueParam = (body.issue_id || body.issue || body.identifier_key || "").trim()
        let projectId = (body.project_id || body.project || "").trim()

        if (!artifactType) {
            return e.json(400, { error: "artifact_type is required ('branch', 'commit', 'pull_request', 'patch', 'ci_run')" })
        }
        if (!identifier) {
            return e.json(400, { error: "identifier is required (branch name, commit SHA, PR number, etc.)" })
        }

        // Inline diff stats parser without regex
        const parseDiff = (diffText) => {
            if (!diffText || typeof diffText !== "string") return { files_changed: 0, additions: 0, deletions: 0 }
            let lines = diffText.split("\n")
            let files = 0, additions = 0, deletions = 0
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i]
                if (line.indexOf("+++ b/") === 0) files++
                else if (line.indexOf("+") === 0 && line.indexOf("+++") !== 0) additions++
                else if (line.indexOf("-") === 0 && line.indexOf("---") !== 0) deletions++
            }
            if (files === 0 && diffText.length > 0) files = 1
            return { files_changed: files, additions: additions, deletions: deletions }
        }

        // Resolve Issue
        let resolvedIssue = null
        if (issueParam) {
            if (issueParam.indexOf("-") !== -1) {
                let parts = issueParam.split("-")
                let projIdent = parts[0].toUpperCase()
                let num = parseInt(parts[1], 10)
                if (!isNaN(num)) {
                    let projects = e.app.findRecordsByFilter("projects", "identifier = '" + projIdent + "'", "", 1, 0)
                    if (projects && projects.length > 0) {
                        let issues = e.app.findRecordsByFilter("issues", "project = '" + projects[0].id + "' && issue_number = " + num, "", 1, 0)
                        if (issues && issues.length > 0) resolvedIssue = issues[0]
                    }
                }
            }
            if (!resolvedIssue) {
                try {
                    resolvedIssue = e.app.findRecordById("issues", issueParam)
                } catch (err) {}
            }
        }

        if (resolvedIssue && !projectId) {
            projectId = resolvedIssue.get("project")
        }

        if (!diffStats && patchContent) {
            diffStats = parseDiff(patchContent)
        }

        let col = e.app.findCollectionByNameOrId("git_artifacts")
        let record = new Record(col)
        record.set("artifact_type", artifactType)
        record.set("identifier", identifier)
        record.set("title", title)
        record.set("url", url)
        record.set("status", status)
        record.set("author", author)
        if (projectId) record.set("project", projectId)
        if (resolvedIssue) record.set("issue", resolvedIssue.id)
        if (diffStats) record.set("diff_stats", diffStats)
        if (patchContent) record.set("patch_content", patchContent)
        if (metadata) record.set("metadata", metadata)

        e.app.save(record)

        // Auto-update issue fields and status if linked
        if (resolvedIssue) {
            let updated = false
            if (artifactType === "branch") {
                resolvedIssue.set("git_branch", identifier)
                let currStatus = resolvedIssue.get("status")
                if (currStatus === "backlog" || currStatus === "todo") {
                    resolvedIssue.set("status", "in_progress")
                }
                updated = true
            } else if (artifactType === "pull_request") {
                if (url) resolvedIssue.set("pr_url", url)
                resolvedIssue.set("pr_status", status)
                let currStatus = resolvedIssue.get("status")
                if (status === "merged") {
                    resolvedIssue.set("status", "done")
                } else if (status === "open" && currStatus !== "done" && currStatus !== "in_review") {
                    resolvedIssue.set("status", "in_review")
                }
                updated = true
            }
            if (updated) {
                try {
                    e.app.save(resolvedIssue)
                } catch (saveErr) {
                    console.log(">>> [Git Workspace] Could not auto-update issue: " + saveErr)
                }
            }
        }

        return e.json(201, {
            id: record.id,
            artifact_type: artifactType,
            identifier: identifier,
            issue: resolvedIssue ? resolvedIssue.id : null,
            status: status,
            diff_stats: diffStats,
            message: "Git artifact linked successfully"
        })
    } catch (err) {
        return e.json(500, { error: "Failed to create git artifact: " + String(err) })
    }
})

// 3. POST /api/projectbase/git/patch
routerAdd("POST", "/api/projectbase/git/patch", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let body = e.requestInfo().body || {}
        let patchContent = (body.patch_content || body.diff || body.patch || "").trim()
        let title = (body.title || "Autonomous agent patch").trim()
        let author = (body.author || e.auth.get("name") || "agent").trim()
        let issueParam = (body.issue_id || body.issue || "").trim()
        let projectId = (body.project_id || body.project || "").trim()

        if (!patchContent) {
            return e.json(400, { error: "patch_content is required (unified diff string)" })
        }

        // Inline diff stats parser without regex
        let lines = patchContent.split("\n")
        let files = 0, additions = 0, deletions = 0
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i]
            if (line.indexOf("+++ b/") === 0) files++
            else if (line.indexOf("+") === 0 && line.indexOf("+++") !== 0) additions++
            else if (line.indexOf("-") === 0 && line.indexOf("---") !== 0) deletions++
        }
        if (files === 0 && patchContent.length > 0) files = 1
        let diffStats = { files_changed: files, additions: additions, deletions: deletions }

        // Resolve Issue
        let resolvedIssue = null
        if (issueParam) {
            if (issueParam.indexOf("-") !== -1) {
                let parts = issueParam.split("-")
                let projIdent = parts[0].toUpperCase()
                let num = parseInt(parts[1], 10)
                if (!isNaN(num)) {
                    let projects = e.app.findRecordsByFilter("projects", "identifier = '" + projIdent + "'", "", 1, 0)
                    if (projects && projects.length > 0) {
                        let issues = e.app.findRecordsByFilter("issues", "project = '" + projects[0].id + "' && issue_number = " + num, "", 1, 0)
                        if (issues && issues.length > 0) resolvedIssue = issues[0]
                    }
                }
            }
            if (!resolvedIssue) {
                try {
                    resolvedIssue = e.app.findRecordById("issues", issueParam)
                } catch (err) {}
            }
        }

        if (resolvedIssue && !projectId) {
            projectId = resolvedIssue.get("project")
        }

        let col = e.app.findCollectionByNameOrId("git_artifacts")
        let record = new Record(col)
        let patchId = "patch-" + String(Date.now()).slice(-8)
        record.set("artifact_type", "patch")
        record.set("identifier", patchId)
        record.set("title", title)
        record.set("status", "staged")
        record.set("author", author)
        record.set("patch_content", patchContent)
        record.set("diff_stats", diffStats)
        if (projectId) record.set("project", projectId)
        if (resolvedIssue) record.set("issue", resolvedIssue.id)

        e.app.save(record)

        return e.json(201, {
            patch_id: record.id,
            identifier: patchId,
            title: title,
            diff_stats: diffStats,
            status: "staged",
            issue_id: resolvedIssue ? resolvedIssue.id : null,
            message: "Unified diff patch staged successfully"
        })
    } catch (err) {
        return e.json(500, { error: "Failed to stage patch: " + String(err) })
    }
})

// 4. GET /api/projectbase/git/patch/{id}
routerAdd("GET", "/api/projectbase/git/patch/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let id = ""
        try { id = e.request.pathValue("id") } catch (pErr) {}
        if (!id) {
            try { id = e.requestInfo().pathParams.id || e.requestInfo().params.id || "" } catch (pErr2) {}
        }
        let record = null
        try {
            record = e.app.findRecordById("git_artifacts", id)
        } catch (err) {
            let matches = e.app.findRecordsByFilter("git_artifacts", "identifier = '" + id + "'", "", 1, 0)
            if (matches && matches.length > 0) record = matches[0]
        }

        if (!record) {
            return e.json(404, { error: "Patch artifact not found: " + id })
        }

        return e.json(200, {
            id: record.id,
            identifier: record.get("identifier"),
            artifact_type: record.get("artifact_type"),
            title: record.get("title"),
            author: record.get("author"),
            status: record.get("status"),
            diff_stats: record.get("diff_stats") || {},
            patch_content: record.get("patch_content") || "",
            created: record.get("created")
        })
    } catch (err) {
        return e.json(500, { error: "Failed to get patch: " + String(err) })
    }
})

// 5. POST /api/projectbase/webhooks/git
routerAdd("POST", "/api/projectbase/webhooks/git", (e) => {
    // Cycle 74 hardening (cycle-75 fix): this is a universal CI/Git webhook
    // receiver — inbound GitHub/GitLab events authenticate via HMAC signature,
    // not superuser credentials. Access requires ONE of:
    //   1. an authenticated principal (e.auth), or
    //   2. a valid X-Hub-Signature-256: sha256=<hex> HMAC-SHA256 signature of
    //      the raw request body, keyed by PROJECTBASE_GIT_WEBHOOK_SECRET env
    //      (or PROJECTBASE_WEBHOOK_SECRET fallback). No secret configured =>
    //      anonymous traffic stays rejected (fail-closed).
    // Reuses the $security.hs256/$security.equal JSVM pattern proven in the
    // webhook-automation engine's inbound verifier.
    if (!e.auth || !e.auth.id) {
        let webhookSecret = ""
        try { webhookSecret = $os.getenv("PROJECTBASE_GIT_WEBHOOK_SECRET") || "" } catch (err) {}
        if (!webhookSecret) {
            try { webhookSecret = $os.getenv("PROJECTBASE_WEBHOOK_SECRET") || "" } catch (err) {}
        }
        if (!webhookSecret) {
            return e.unauthorizedError("Authentication required")
        }
        let sigHeader = ""
        try {
            const headers = e.requestInfo().headers || {}
            for (let k in headers) {
                if (String(k).toLowerCase().replace(/_/g, "-") === "x-hub-signature-256") {
                    let v = headers[k]
                    sigHeader = Array.isArray(v) ? String(v[0] || "") : String(v || "")
                    break
                }
            }
        } catch (err) {}
        let rawBody = ""
        try { rawBody = toString(e.request && e.request.body) } catch (err) {
            try { rawBody = String(e.request && e.request.body) } catch (err2) {}
        }
        let provided = ""
        if (sigHeader && sigHeader.indexOf("sha256=") === 0) {
            provided = sigHeader.substring(7).trim().toLowerCase()
        }
        if (!provided || !rawBody) {
            return e.unauthorizedError("Authentication required")
        }
        let expected = ""
        try { expected = $security.hs256(rawBody, webhookSecret).toLowerCase() } catch (err) {
            return e.unauthorizedError("Authentication required")
        }
        // Constant-time-ish comparison, char-by-char (same pattern as 99_webhook_automation_engine).
        let mismatch = expected.length !== provided.length
        if (!mismatch) {
            for (let i = 0; i < expected.length; i++) {
                if (expected.charCodeAt(i) !== provided.charCodeAt(i)) { mismatch = true; break }
            }
        }
        if (mismatch) {
            return e.unauthorizedError("Authentication required")
        }
    }
    try {
        let body = e.requestInfo().body || {}
        let headers = e.requestInfo().headers || {}

        const getHeader = (name) => {
            if (!headers) return ""
            let target = name.toLowerCase().replace(/_/g, "-")
            for (let k in headers) {
                if (k.toLowerCase().replace(/_/g, "-") === target) {
                    let v = headers[k]
                    if (Array.isArray(v)) return v[0] || ""
                    return String(v || "")
                }
            }
            return ""
        }

        let eventType = (getHeader("x-github-event") || getHeader("x-gitlab-event") || body.event || body.event_type || "push").trim().toLowerCase()
        let action = (body.action || "").trim().toLowerCase()

        // Inline token parsing helper without regex
        const extractTokens = (txt) => {
            if (!txt || typeof txt !== "string") return []
            let tokens = []
            let current = ""
            for (let i = 0; i < txt.length; i++) {
                let ch = txt[i]
                let isAlpha = (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
                let isDigit = ch >= '0' && ch <= '9'
                let isHyphen = ch === '-'
                if (isAlpha || isDigit || isHyphen) {
                    current += ch
                } else {
                    if (current.length > 0) {
                        tokens.push(current)
                        current = ""
                    }
                }
            }
            if (current.length > 0) tokens.push(current)

            let results = []
            for (let t of tokens) {
                let parts = t.split('-')
                for (let p = 0; p < parts.length - 1; p++) {
                    let prefix = parts[p].toUpperCase()
                    let suffix = parts[p + 1]
                    // check prefix 1..10 alphanumeric chars
                    let validPrefix = prefix.length >= 1 && prefix.length <= 10
                    for (let c = 0; c < prefix.length; c++) {
                        let code = prefix.charCodeAt(c)
                        let isAlnum = (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95
                        if (!isAlnum) { validPrefix = false; break }
                    }
                    // check suffix 1..8 digits
                    let validSuffix = suffix.length >= 1 && suffix.length <= 8
                    for (let c = 0; c < suffix.length; c++) {
                        let code = suffix.charCodeAt(c)
                        if (code < 48 || code > 57) { validSuffix = false; break }
                    }
                    if (validPrefix && validSuffix) {
                        let id = prefix + "-" + suffix
                        if (results.indexOf(id) === -1) {
                            results.push(id)
                        }
                    }
                }
            }
            return results
        }

        let triaged = []

        if (eventType === "push" || eventType === "push hook") {
            let commits = body.commits || []
            let branch = body.ref || body.branch || ""
            if (branch.indexOf("refs/heads/") === 0) branch = branch.replace("refs/heads/", "")
            let pusher = (body.pusher ? body.pusher.name : (body.user_name || "git-agent"))

            let branchIdentCandidates = extractTokens(branch)

            for (let c of commits) {
                let sha = c.id || c.sha || ""
                let msg = c.message || ""
                let authorName = (c.author ? (c.author.name || c.author.username) : pusher) || "git"
                let url = c.url || ""

                let issueKeys = extractTokens(msg)
                for (let b of branchIdentCandidates) {
                    if (issueKeys.indexOf(b) === -1) issueKeys.push(b)
                }

                for (let key of issueKeys) {
                    let parts = key.split("-")
                    let projIdent = parts[0].toUpperCase()
                    let num = parseInt(parts[1], 10)
                    if (isNaN(num)) continue

                    let projects = e.app.findRecordsByFilter("projects", "identifier = '" + projIdent + "'", "", 1, 0)
                    if (!projects || projects.length === 0) continue
                    let project = projects[0]

                    let issues = e.app.findRecordsByFilter("issues", "project = '" + project.id + "' && issue_number = " + num, "", 1, 0)
                    if (!issues || issues.length === 0) continue
                    let issue = issues[0]

                    let col = e.app.findCollectionByNameOrId("git_artifacts")
                    let rec = new Record(col)
                    rec.set("project", project.id)
                    rec.set("issue", issue.id)
                    rec.set("artifact_type", "commit")
                    rec.set("identifier", sha ? sha.substring(0, 8) : "commit-" + String(Date.now()).slice(-6))
                    rec.set("title", msg)
                    rec.set("url", url)
                    rec.set("author", authorName)
                    rec.set("status", "committed")
                    rec.set("diff_stats", {
                        additions: (c.added ? c.added.length : 0),
                        deletions: (c.removed ? c.removed.length : 0),
                        files_changed: (c.modified ? c.modified.length : 0) + (c.added ? c.added.length : 0) + (c.removed ? c.removed.length : 0)
                    })
                    e.app.save(rec)

                    // Auto-advance issue to in_progress if in backlog/todo
                    let currStatus = issue.get("status")
                    if (currStatus === "backlog" || currStatus === "todo") {
                        issue.set("status", "in_progress")
                        if (branch) issue.set("git_branch", branch)
                        e.app.save(issue)
                    }

                    triaged.push({ issue: key, type: "commit", sha: sha, status: issue.get("status") })
                }
            }
        } else if (eventType === "pull_request" || eventType === "merge_request hook" || eventType === "pull_request_target") {
            let pr = body.pull_request || body.object_attributes || body
            let title = pr.title || ""
            let prUrl = pr.html_url || pr.url || ""
            let prNumber = String(pr.number || pr.iid || "")
            let merged = pr.merged === true || (action === "closed" && pr.merged)
            let state = merged ? "merged" : (pr.state || "open")
            let branch = (pr.head ? pr.head.ref : (pr.source_branch || ""))
            let author = (pr.user ? pr.user.login : (pr.author ? pr.author.username : "agent"))

            let textToScan = title + " " + (pr.body || "") + " " + branch
            let issueKeys = extractTokens(textToScan)

            for (let key of issueKeys) {
                let parts = key.split("-")
                let projIdent = parts[0].toUpperCase()
                let num = parseInt(parts[1], 10)
                if (isNaN(num)) continue

                let projects = e.app.findRecordsByFilter("projects", "identifier = '" + projIdent + "'", "", 1, 0)
                if (!projects || projects.length === 0) continue
                let project = projects[0]

                let issues = e.app.findRecordsByFilter("issues", "project = '" + project.id + "' && issue_number = " + num, "", 1, 0)
                if (!issues || issues.length === 0) continue
                let issue = issues[0]

                let col = e.app.findCollectionByNameOrId("git_artifacts")
                let rec = new Record(col)
                rec.set("project", project.id)
                rec.set("issue", issue.id)
                rec.set("artifact_type", "pull_request")
                rec.set("identifier", "#" + prNumber)
                rec.set("title", title)
                rec.set("url", prUrl)
                rec.set("author", author)
                rec.set("status", state)
                rec.set("diff_stats", {
                    additions: pr.additions || 0,
                    deletions: pr.deletions || 0,
                    files_changed: pr.changed_files || 0
                })
                e.app.save(rec)

                // Update issue state
                issue.set("pr_url", prUrl)
                issue.set("pr_status", state)
                if (branch) issue.set("git_branch", branch)

                if (state === "merged") {
                    issue.set("status", "done")
                } else if (state === "open" && issue.get("status") !== "done") {
                    issue.set("status", "in_review")
                }
                e.app.save(issue)

                triaged.push({ issue: key, type: "pull_request", pr: "#" + prNumber, state: state, status: issue.get("status") })
            }
        } else if (eventType === "workflow_run" || eventType === "check_run") {
            let run = body.workflow_run || body.check_run || body
            let headBranch = run.head_branch || ""
            let conclusion = run.conclusion || run.status || "pending"
            let name = run.name || "CI Workflow"
            let htmlUrl = run.html_url || ""

            let issueKeys = extractTokens(headBranch + " " + (run.head_commit ? run.head_commit.message : ""))
            for (let key of issueKeys) {
                let parts = key.split("-")
                let projIdent = parts[0].toUpperCase()
                let num = parseInt(parts[1], 10)
                if (isNaN(num)) continue

                let projects = e.app.findRecordsByFilter("projects", "identifier = '" + projIdent + "'", "", 1, 0)
                if (!projects || projects.length === 0) continue
                let project = projects[0]

                let issues = e.app.findRecordsByFilter("issues", "project = '" + project.id + "' && issue_number = " + num, "", 1, 0)
                if (!issues || issues.length === 0) continue
                let issue = issues[0]

                let col = e.app.findCollectionByNameOrId("git_artifacts")
                let rec = new Record(col)
                rec.set("project", project.id)
                rec.set("issue", issue.id)
                rec.set("artifact_type", "ci_run")
                rec.set("identifier", "ci-" + String(run.id || Date.now()))
                rec.set("title", name + ": " + conclusion)
                rec.set("url", htmlUrl)
                rec.set("status", conclusion)
                e.app.save(rec)

                triaged.push({ issue: key, type: "ci_run", conclusion: conclusion })
            }
        }

        return e.json(200, {
            event: eventType,
            triaged_count: triaged.length,
            triaged: triaged,
            message: "Git webhook processed successfully"
        })
    } catch (err) {
        return e.json(500, { error: "Failed to process git webhook: " + String(err) })
    }
})

// 6. GET /api/projectbase/git/status
routerAdd("GET", "/api/projectbase/git/status", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        let req = e.requestInfo()
        let q = req.query || {}
        let projectId = (q.project_id || q.project || "").trim()

        let filter = projectId ? ("project = '" + projectId + "'") : "1=1"
        let artifacts = []
        try {
            artifacts = e.app.findRecordsByFilter("git_artifacts", filter, "-created", 500, 0)
        } catch (err) {
            artifacts = []
        }

        let branchCount = 0
        let commitCount = 0
        let prOpenCount = 0
        let prMergedCount = 0
        let prClosedCount = 0
        let patchCount = 0
        let ciRunsTotal = 0
        let ciRunsPassed = 0

        for (let a of artifacts) {
            let type = a.get("artifact_type")
            let status = a.get("status")
            if (type === "branch") {
                branchCount++
            } else if (type === "commit") {
                commitCount++
            } else if (type === "pull_request") {
                if (status === "open") prOpenCount++
                else if (status === "merged") prMergedCount++
                else prClosedCount++
            } else if (type === "patch") {
                patchCount++
            } else if (type === "ci_run") {
                ciRunsTotal++
                if (status === "success" || status === "passed" || status === "completed") {
                    ciRunsPassed++
                }
            }
        }

        let ciSuccessRate = ciRunsTotal > 0 ? Math.round((ciRunsPassed / ciRunsTotal) * 100) : 100

        return e.json(200, {
            project_id: projectId || "all",
            summary: {
                total_artifacts: artifacts.length,
                branches_tracked: branchCount,
                commits_recorded: commitCount,
                pull_requests: {
                    open: prOpenCount,
                    merged: prMergedCount,
                    closed: prClosedCount,
                    total: prOpenCount + prMergedCount + prClosedCount
                },
                staged_patches: patchCount,
                ci_reliability: {
                    total_runs: ciRunsTotal,
                    passed_runs: ciRunsPassed,
                    pass_rate_percent: ciSuccessRate
                }
            }
        })
    } catch (err) {
        return e.json(500, { error: "Failed to get git status: " + String(err) })
    }
})
