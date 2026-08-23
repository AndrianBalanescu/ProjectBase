// pb_hooks/45_github_importer.pb.js
// GitHub Issues importer for ProjectBase (cycle 3).
// POST /api/projectbase/import/github
//   body: {
//     project_id: string,          // required — target ProjectBase project
//     repo: string,                // required — "owner/name" GitHub repository
//     token?: string,              // optional fine-grained / classic PAT (raises rate limit)
//     state?: "open"|"closed"|"all", // default "all"
//     max_issues?: number          // optional cap (default 1000)
//   }
// Behavior:
//   - Requires an authenticated user.
//   - Calls GitHub REST API v3 (api.github.com/repos/{repo}/issues?state=...) with
//     pagination and the caller's token (if supplied). Respects rate-limit headers
//     (X-RateLimit-Remaining / X-RateLimit-Reset) and stops early if exhausted.
//   - PRs are excluded (GitHub returns pull requests in the issues endpoint; they
//     are filtered out via the `pull_request` field).
//   - Duplicate-safe: issues are keyed by GitHub issue number via
//     source_metadata.source_key = "gh:{number}", so re-importing the same repo is
//     idempotent (already-imported numbers are skipped, title changes still dedupe
//     by source_key per the CSV importer contract).
//   - Maps GitHub state -> ProjectBase status: open->todo, closed->done, PR/other->cancelled.
//   - Returns { imported, skipped, total, errors: [...], rate_limit: {remaining, reset_at} }.
//
// NOTE: As with 40_importers.pb.js, helpers are inlined inside the routerAdd callback
// because PocketBase Goja runs each callback in an isolated execution context.

routerAdd("POST", "/api/projectbase/import/github", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (bErr) { return e.json(400, { error: "Invalid JSON body" }) }
        let projectId = body.project_id
        let repo = String(body.repo || "").trim()
        let token = body.token != null ? String(body.token).trim() : ""
        let state = String(body.state || "all").trim().toLowerCase()
        let maxIssues = Number(body.max_issues) > 0 ? Math.min(Number(body.max_issues), 5000) : 1000

        if (!projectId) {
            return e.badRequestError("Missing required 'project_id'")
        }
        if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
            return e.badRequestError("Missing or invalid 'repo' (expected 'owner/name')")
        }
        if (!["open", "closed", "all"].includes(state)) {
            state = "all"
        }

        let project
        try {
            project = e.app.findRecordById("projects", projectId)
        } catch (err) {
            return e.notFoundError("Project not found")
        }

        const STATUS = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]
        const statusLookup = {}
        for (const s of STATUS) statusLookup[s] = s

        // ---------- helpers (inlined; Goja isolated context) ----------
        const safeProjectId = projectId.replace(/'/g, "\\'")

        // Build the existing dedup index for this project once.
        const seenKeys = {}
        const seenTitles = {}
        const existingRecords = e.app.findRecordsByFilter("issues", `project = '${safeProjectId}'`, "-created", 5000, 0)
        for (const rec of existingRecords) {
            const t = (rec.get("title") || "").trim().toLowerCase()
            if (t) seenTitles[t] = true
            let sm = rec.get("source_metadata")
            if (typeof sm === "string") {
                try { sm = JSON.parse(sm) } catch (err) { sm = null }
            } else if (sm && typeof sm === "object" && Array.isArray(sm)) {
                try { sm = JSON.parse(String(sm)) } catch (err) { sm = null }
            }
            if (sm && sm.source_key) seenKeys[String(sm.source_key)] = true
        }

        const issuesCol = e.app.findCollectionByNameOrId("issues")

        // Read a possibly-array header value, case-insensitive. GitHub returns
        // rate-limit headers as X-Ratelimit-* (lowercase 'l'), while some clients
        // use X-RateLimit-*; match on a normalized key.
        const headerVal = (headers, name) => {
            if (!headers) return ""
            const want = name.toLowerCase()
            for (const k in headers) {
                if (k.toLowerCase() === want) {
                    let v = headers[k]
                    if (Array.isArray(v)) v = v.length ? v[0] : ""
                    return v != null ? String(v) : ""
                }
            }
            return ""
        }

        let rateLimitRemaining = null
        let rateLimitReset = null

        // Fetch one page from GitHub. Returns { issues, nextUrl } or throws.
        const fetchPage = (url, isRetry) => {
            const headers = { "Accept": "application/vnd.github+json", "User-Agent": "ProjectBase-importer" }
            if (token) headers["Authorization"] = "Bearer " + token
            const res = $http.send({ url, method: "GET", headers, timeout: 30 })
            const rl = headerVal(res.headers, "X-RateLimit-Remaining")
            const reset = headerVal(res.headers, "X-RateLimit-Reset")
            if (rl !== "") rateLimitRemaining = Number(rl)
            if (reset !== "") rateLimitReset = Number(reset)

            if (res.statusCode === 403) {
                // Rate limit hit (or forbidden). Surface remaining/reset if present.
                throw new Error("GitHub API returned 403 (rate limit). Remaining=" + rl + " Reset=" + reset)
            }
            if (res.statusCode === 404) {
                throw new Error("GitHub repo not found or token lacks access: " + repo)
            }
            if (res.statusCode === 401) {
                throw new Error("GitHub token rejected (401). Check the token has repo access.")
            }
            if (res.statusCode !== 200) {
                throw new Error("GitHub API error " + res.statusCode + " for " + repo)
            }
            const issues = Array.isArray(res.json) ? res.json : []
            // Parse the next-page URL from the Link header (array-of-strings in PB 0.39).
            let nextUrl = ""
            const linkRaw = headerVal(res.headers, "Link")
            if (linkRaw && linkRaw.indexOf('rel="next"') !== -1) {
                const m = linkRaw.match(/<([^>]+)>;\s*rel="next"/)
                if (m) nextUrl = m[1]
            }
            return { issues, nextUrl }
        }

        const normStatus = (ghState) => {
            const s = String(ghState || "").trim().toLowerCase()
            if (s === "closed" || s === "done" || s === "complete" || s === "resolved") return "done"
            if (s === "cancelled" || s === "wontfix") return "cancelled"
            return "todo"
        }

        // ---------- Main fetch loop ----------
        let imported = 0
        let skipped = 0
        let seen = 0
        let errors = []
        let fetchedCount = 0

        const baseUrl = `https://api.github.com/repos/${encodeURIComponent(repo.split("/")[0])}/${encodeURIComponent(repo.split("/")[1])}/issues?state=${state}&per_page=100&page=1`
        let url = baseUrl
        let guard = 0
        while (url && guard < 60 && fetchedCount < maxIssues) {
            guard++
            let page
            try {
                page = fetchPage(url, false)
            } catch (err) {
                errors.push({ page: guard, error: String((err && err.message) || err) })
                break
            }
            const issues = page.issues
            for (let i = 0; i < issues.length; i++) {
                const it = issues[i]
                if (fetchedCount >= maxIssues) break
                fetchedCount++
                // Skip pull requests (GitHub returns them in the issues endpoint).
                if (it.pull_request && it.pull_request.url) { skipped++; continue }
                try {
                    const number = it.number
                    const title = String(it.title || "").trim()
                    if (!title) { skipped++; continue }
                    const key = "gh:" + number
                    const titleKey = title.toLowerCase()
                    if (seenTitles[titleKey]) { skipped++; continue }
                    if (seenKeys[key]) { skipped++; continue }

                    const rec = new Record(issuesCol)
                    rec.set("project", projectId)
                    rec.set("title", title)
                    // GitHub bodies can exceed the 5000-char description limit; truncate.
                    const body = it.body ? String(it.body) : ""
                    rec.set("description", body.length > 5000 ? body.slice(0, 5000) : body)
                    rec.set("status", normStatus(it.state))
                    rec.set("priority", "none")
                    // assignee: prefer first assignee login
                    if (Array.isArray(it.assignees) && it.assignees.length > 0) {
                        rec.set("assignee", String(it.assignees[0].login || ""))
                    }
                    if (Array.isArray(it.labels)) {
                        rec.set("labels", it.labels.map((l) => String(l.name || "")).filter(Boolean))
                    }
                    rec.set("order", Date.now() + imported * 1000 + i)
                    // Note: do NOT pre-set issue_number/identifier — the
                    // onRecordCreate hook in 20_issue_hooks.pb.js generates a
                    // sequential issue_number + identifier (e.g. PROJ-1). The
                    // original GitHub number is preserved in source_metadata.gh_number.

                    const sm = {
                        importer: "github",
                        source_key: key,
                        source_type: "github",
                        gh_number: number,
                        gh_url: it.html_url || "",
                        gh_user: it.user && it.user.login ? it.user.login : "",
                        gh_created_at: it.created_at || "",
                        gh_closed_at: it.closed_at || "",
                        imported_at: new Date().toISOString(),
                    }
                    rec.set("source_metadata", sm)

                    e.app.save(rec)
                    seenTitles[titleKey] = true
                    seenKeys[key] = true
                    imported++
                } catch (err) {
                    errors.push({ gh: it.number != null ? it.number : i, error: String((err && err.message) || err) })
                }
            }
            url = page.nextUrl
            if (page.nextUrl && guard >= 59) {
                errors.push({ page: "pagination", error: "reached max page guard (60); import truncated" })
            }
        }

        let resetAt = null
        if (rateLimitReset) {
            try { resetAt = new Date(rateLimitReset * 1000).toISOString() } catch (err) { resetAt = String(rateLimitReset) }
        }

        return e.json(200, {
            imported,
            skipped,
            total: fetchedCount,
            repo,
            errors,
            rate_limit: { remaining: rateLimitRemaining, reset_at: resetAt },
        })
    } catch (err) {
        console.log(">>> [ProjectBase] github import error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})
