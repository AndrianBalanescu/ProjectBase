// ProjectBase migration 35 — Execution-Native Agent Sessions & Process Lifecycle (Milestone 1 & 2).
//
// Adds the `agent_sessions` collection for Session-as-a-Card orchestration:
//   - `session_id`         — unique session identifier (UUID / flomaster session token)
//   - `project`            — relation to projects (deterministic workspace binding)
//   - `issue`              — relation to issues (optional auto-docked parent intent)
//   - `agent_name`         — display name (flomaster, hermes, flow-builder, cursor, etc.)
//   - `runtime`            — agent execution environment (flomaster | hermes | cursor | flow)
//   - `model`              — LLM model powering the session (e.g. gpt-5.5, claude-fable-5, premium)
//   - `status`             — spawning | running | verifying | completed | failed | cancelled | idle
//   - `pid`                — OS Process ID of the executing agent runner
//   - `workdir`            — absolute working directory path
//   - `git_branch`         — active git branch
//   - `git_commit_before`  — initial commit SHA
//   - `git_commit_after`   — final commit SHA upon completion
//   - `git_diff_summary`   — json summary of files changed, additions, deletions
//   - `files_touched`      — json array of file paths modified or inspected
//   - `command`            — execution command or prompt trigger
//   - `test_verdict`       — json { passed, failed, total, duration_s, status, suite }
//   - `log_tail`           — last N lines of stdout/stderr logs
//   - `tokens_in`          — input token tally
//   - `tokens_out`         — output token tally
//   - `cost_cents`         — execution cost in USD cents
//   - `metadata`           — flexible key-value tags and telemetry
//   - `auto_docked`        — bool indicating automatic parent issue binding
//   - `exit_code`          — process exit code (0 = success)
//   - `started_at`         — start timestamp
//   - `ended_at`           — termination/completion timestamp

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
    let issuesId = ""
    try { issuesId = app.findCollectionByNameOrId("issues").id } catch (err) {}

    // 1. agent_sessions: Real-time session execution lifecycle and telemetry
    ensureCollection(
        "agent_sessions",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        [
            text("session_id", { required: true }),
            relation("project", projectsId, { cascadeDelete: false }),
            relation("issue", issuesId, { cascadeDelete: false }),
            text("agent_name"),
            text("runtime"),
            text("model"),
            select("status", ["spawning", "running", "verifying", "completed", "failed", "cancelled", "idle"]),
            number("pid"),
            text("workdir"),
            text("git_branch"),
            text("git_commit_before"),
            text("git_commit_after"),
            json("git_diff_summary"),
            json("files_touched"),
            text("command"),
            json("test_verdict"),
            text("log_tail"),
            number("tokens_in"),
            number("tokens_out"),
            number("cost_cents"),
            json("metadata"),
            bool("auto_docked"),
            number("exit_code"),
            text("started_at"),
            text("ended_at"),
            auto("created", true, false),
            auto("updated", true, true),
        ]
    )
})
