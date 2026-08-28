// ProjectBase migration 21 — composite Kanban ordering indexes.
//
// Adds the indexes the Kanban board and the MCP list/move tools rely on:
//   - (project, status, "order", created): column scan + in-column ordering
//   - (project, "order"): project-wide ordering fallback
//   - cycle: sprint/cycle lookups
//
// Idempotent: uses CREATE INDEX IF NOT EXISTS.
// NOTE: issues has NO created_by column (audit cycle 4) — do not index it.

migrate((app) => {
    const statements = [
        {
            name: "idx_issues_project_status_order",
            sql: "CREATE INDEX `idx_issues_project_status_order` ON `issues` (`project`, `status`, `order`, `created`)"
        },
        {
            name: "idx_issues_project_order_created",
            sql: "CREATE INDEX `idx_issues_project_order_created` ON `issues` (`project`, `order`, `created`)"
        },
        {
            name: "idx_issues_cycle_status",
            sql: "CREATE INDEX `idx_issues_cycle_status` ON `issues` (`cycle`, `status`)"
        }
    ]

    for (let i = 0; i < statements.length; i++) {
        let stmt = statements[i]
        let sql = stmt.sql
        // CREATE INDEX IF NOT EXISTS is supported on modern SQLite; guard explicitly anyway.
        let guarded = sql.replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
        app.db().newQuery(guarded).execute()
        console.log(">>> [Migration 21] ensured index: " + stmt.name)
    }
}, (app) => {
    const names = [
        "idx_issues_project_status_order",
        "idx_issues_project_order_created",
        "idx_issues_cycle_status"
    ]
    for (let i = 0; i < names.length; i++) {
        try {
            app.db().newQuery("DROP INDEX IF EXISTS `" + names[i] + "`").execute()
        } catch (e) {}
    }
})
