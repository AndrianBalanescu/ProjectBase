// ProjectBase migration 36 — Deep Observability & Ground Truth Verification Hub (Milestone 3).
//
// Adds observability, git diffs, test verdicts, and Sceptic audit telemetry:
//   - agent_sessions:
//       - `git_diff_raw`        — full raw unified git diff text
//       - `git_diff_files`      — structured array of file diffs [{file, additions, deletions, patch}]
//       - `sceptic_audit`       — sceptic audit object {auditor, verdict, risk_score, findings, vetoed, signature}
//       - `verification_badge`  — unverified | verified | vetoed | failing_tests
//       - `verification_score`  — 0-100 ground-truth confidence score
//   - session_audits:
//       - dedicated collection for multi-auditor / Flow Inspect historical audit reports

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values, maxSelect: 1 })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
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

    let projectsId = ""
    try { projectsId = app.findCollectionByNameOrId("projects").id } catch (err) {}
    let sessionsId = ""
    try { sessionsId = app.findCollectionByNameOrId("agent_sessions").id } catch (err) {}

    // 1. Extend agent_sessions collection
    let sessionCol = null
    try { sessionCol = app.findCollectionByNameOrId("agent_sessions") } catch (err) {}
    if (sessionCol) {
        let sessionFields = [
            text("git_diff_raw"),
            json("git_diff_files"),
            json("sceptic_audit"),
            select("verification_badge", ["unverified", "verified", "vetoed", "failing_tests"]),
            number("verification_score"),
        ]
        let changed = false
        sessionFields.forEach(f => {
            if (!hasField(sessionCol, f.name)) {
                sessionCol.fields.add(f)
                changed = true
            }
        })
        if (changed) {
            app.save(sessionCol)
        }
    }

    // 2. session_audits: Independent Sceptic Auditor reports & P0/P1 finding records
    ensureCollection(
        "session_audits",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        [
            text("session_id", { required: true }),
            relation("session", sessionsId, { cascadeDelete: false }),
            relation("project", projectsId, { cascadeDelete: false }),
            text("auditor"),
            select("verdict", ["PASS", "FAIL", "CONDITIONAL_PASS"]),
            number("risk_score"),
            json("findings"),
            bool("vetoed"),
            text("signature"),
            text("summary"),
            json("metadata"),
            auto("created", true, false),
            auto("updated", true, true),
        ]
    )
})
