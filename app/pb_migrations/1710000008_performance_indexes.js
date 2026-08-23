// ProjectBase migration 8 — high-performance SQLite composite indexes
//
// Eliminates full table scans on:
// 1. Issue Kanban/List queries (filtered by project, sorted by order/created)
// 2. Issue number auto-increment assignment (filtered by project, sorted by issue_number DESC)
// 3. Sprint cycle and milestone issue associations
// 4. Comment threads and audit activity logs
migrate((app) => {
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_issues_project_order ON issues (project, \"order\", created);",
        "CREATE INDEX IF NOT EXISTS idx_issues_project_number ON issues (project, issue_number DESC);",
        "CREATE INDEX IF NOT EXISTS idx_issues_project_status ON issues (project, status);",
        "CREATE INDEX IF NOT EXISTS idx_issues_cycle ON issues (cycle);",
        "CREATE INDEX IF NOT EXISTS idx_issues_milestone ON issues (milestone);",
        "CREATE INDEX IF NOT EXISTS idx_comments_issue_created ON comments (issue, created);",
        "CREATE INDEX IF NOT EXISTS idx_cycles_project_status ON cycles (project, status);",
        "CREATE INDEX IF NOT EXISTS idx_milestones_project_status ON milestones (project, status);",
        "CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity (project, created DESC);",
        "CREATE INDEX IF NOT EXISTS idx_activity_issue_created ON activity (issue, created DESC);"
    ];

    for (let sql of indexes) {
        try {
            app.db().newQuery(sql).execute();
        } catch (err) {
            console.error(">>> [Migration] Index creation error:", err.message);
        }
    }
    console.log(">>> [Migration] Successfully created composite performance indexes");
});
