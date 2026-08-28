// ProjectBase migration 23 — Autonomous Swarm Choreography, Task DAGs & Validation Checkpoints.
//
// Adds data structures for Swarm Choreography (Epic 10):
//   1. issues: parent_issue (relation) and task_persona (text) fields for DAG hierarchy & persona routing.
//   2. task_checkpoints: Validation gates, peer-review verdicts, unit/QA test runs before issue completion.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const bool = (name) => new BoolField({ name })
    const number = (name) => new NumberField({ name })
    const json = (name) => new JSONField({ name })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }
    const issuesId = collectionIdOf("issues")

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }

    // 1. Enrich issues collection with parent_issue and task_persona
    try {
        const issuesCol = app.findCollectionByNameOrId("issues")
        if (issuesCol) {
            let modified = false
            if (!hasField(issuesCol, "parent_issue")) {
                issuesCol.fields.add(relation("parent_issue", issuesId))
                modified = true
            }
            if (!hasField(issuesCol, "task_persona")) {
                issuesCol.fields.add(text("task_persona"))
                modified = true
            }
            if (modified) {
                app.save(issuesCol)
            }
        }
    } catch (e) {
        console.log(">>> [Migration 23] Enrich issues note: " + e)
    }

    // 2. task_checkpoints collection
    let checkpointsCol = null
    try { checkpointsCol = app.findCollectionByNameOrId("task_checkpoints") } catch (err) {}
    if (!checkpointsCol) {
        checkpointsCol = new Collection({
            name: "task_checkpoints",
            type: "base",
            listRule: "@request.auth.id != ''",
            viewRule: "@request.auth.id != ''",
            createRule: null,
            updateRule: null,
            deleteRule: null,
        })
    }

    const checkpointFields = [
        relation("issue", issuesId, { required: true, cascadeDelete: true }),
        text("agent_name", { required: true }),
        text("persona"),
        text("checkpoint_type", { required: true }),
        text("status", { required: true }),
        text("notes"),
        json("artifacts"),
    ]

    let cpModified = false
    for (const field of checkpointFields) {
        if (!hasField(checkpointsCol, field.name)) {
            checkpointsCol.fields.add(field)
            cpModified = true
        }
    }
    if (!hasField(checkpointsCol, "created")) {
        checkpointsCol.fields.add(auto("created", true, false))
        cpModified = true
    }
    if (!hasField(checkpointsCol, "updated")) {
        checkpointsCol.fields.add(auto("updated", true, true))
        cpModified = true
    }
    app.save(checkpointsCol)

    // 3. Composite indexes for high performance DAG and checkpoint queries
    try {
        app.db().newQuery("CREATE INDEX IF NOT EXISTS `idx_task_checkpoints_issue` ON `task_checkpoints` (`issue`, `created`)").execute()
        app.db().newQuery("CREATE INDEX IF NOT EXISTS `idx_issues_parent_issue` ON `issues` (`parent_issue`)").execute()
    } catch (e) {
        console.log(">>> [Migration 23] Index creation note: " + e)
    }

    console.log(">>> [Migration 23] task_checkpoints and issues parent/persona fields ready")
}, (app) => {
    try {
        const col = app.findCollectionByNameOrId("task_checkpoints")
        if (col) { app.delete(col) }
    } catch (e) {}
})
