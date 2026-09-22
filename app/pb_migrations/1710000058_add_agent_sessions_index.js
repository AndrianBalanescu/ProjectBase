// ProjectBase migration 58 — add agent_sessions composite index
//
// Improves query performance for:
// 1. Session listing by session_id + status + created (common in session detail views)
// 2. Live activity queries that filter by status and sort by created
// 3. Deduplication lookups on session_id

migrate((app) => {
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_agent_sessions_sid_status ON agent_sessions (session_id, status, created);"
    ];

    for (let sql of indexes) {
        try {
            app.db().newQuery(sql).execute();
        } catch (err) {
            console.error(">>> [Migration] Index creation error:", err.message);
        }
    }
    console.log(">>> [Migration] Created agent_sessions composite index");
});
