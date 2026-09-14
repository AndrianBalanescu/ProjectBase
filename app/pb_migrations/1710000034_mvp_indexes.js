// ProjectBase migration 34 — MVP performance indexes
// Adds targeted indexes for identifier, assignee, due_date lookups
// and the issue relation junction tables.
migrate((app) => {
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_issues_identifier ON issues (identifier);",
        "CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues (assignee);",
        "CREATE INDEX IF NOT EXISTS idx_issues_due_date ON issues (due_date);",
        "CREATE INDEX IF NOT EXISTS idx_issues_related ON issues (related);",
        "CREATE INDEX IF NOT EXISTS idx_relations_issue_a ON issue_relations (issue_a);",
        "CREATE INDEX IF NOT EXISTS idx_relations_issue_b ON issue_relations (issue_b);"
    ];

    for (let sql of indexes) {
        try {
            app.db().newQuery(sql).execute();
        } catch (err) {
            console.error(">>> [Migration] Index creation error:", err.message);
        }
    }
    console.log(">>> [Migration] Successfully created MVP performance indexes");
});