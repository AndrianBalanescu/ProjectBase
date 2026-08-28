// ProjectBase migration 24 — Autonomous Agent Code Sandbox, Git Artifacts & Webhook Workspace Engine.
//
// Adds data structures for Git & Code Lifecycle (Epic 13):
//   1. git_artifacts: Branches, commits, pull requests, unified diff patches, and CI run records.
//   2. issues: git_branch (text), pr_url (text), and pr_status (text) fields.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }
    const issuesId = collectionIdOf("issues")
    const projectsId = collectionIdOf("projects")

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
        }
        let modified = false
        for (const field of fields) {
            if (!hasField(col, field.name)) {
                col.fields.add(field)
                modified = true
            }
        }
        if (!col.id || modified) {
            app.save(col)
        }
        return col
    }

    // 1. Enrich issues collection with git_branch, pr_url, and pr_status
    try {
        const issuesCol = app.findCollectionByNameOrId("issues")
        if (issuesCol) {
            let modified = false
            if (!hasField(issuesCol, "git_branch")) {
                issuesCol.fields.add(text("git_branch"))
                modified = true
            }
            if (!hasField(issuesCol, "pr_url")) {
                issuesCol.fields.add(text("pr_url"))
                modified = true
            }
            if (!hasField(issuesCol, "pr_status")) {
                issuesCol.fields.add(text("pr_status"))
                modified = true
            }
            if (modified) {
                app.save(issuesCol)
            }
        }
    } catch (e) {
        console.log(">>> [Migration 24] Enrich issues note: " + e)
    }

    // 2. git_artifacts collection
    try {
        ensureCollection("git_artifacts", "@request.auth.id != ''", "@request.auth.id != ''", [
            relation("project", projectsId, { required: false }),
            relation("issue", issuesId, { required: false }),
            text("artifact_type", { required: true }), // 'branch', 'commit', 'pull_request', 'patch', 'ci_run'
            text("identifier", { required: true }),    // e.g. branch name, commit sha, PR #, patch ID
            text("title"),                              // commit message, PR title, branch purpose
            text("url"),                                // GitHub/GitLab URL
            text("status"),                             // 'open', 'merged', 'closed', 'passed', 'failed', 'pending', 'staged'
            text("author"),                             // author username or agent persona
            json("diff_stats"),                         // { files_changed, additions, deletions }
            text("patch_content"),                      // raw unified diff or patch
            json("metadata"),                           // extra CI logs, webhook headers, tags
            auto("created", true, false),
            auto("updated", true, true)
        ])
    } catch (e) {
        console.log(">>> [Migration 24] git_artifacts collection note: " + e)
    }
})
