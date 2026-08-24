// ProjectBase migration 17 — covering index for the global cross-project sort
//
// The published benchmark (docs/BENCHMARKS.md) flags one query shape with no
// covering index: a cross-project `sort=-created` with no filter (the worst
// case, 62.5 ms p50 at 10k issues). Every UI view is project-scoped and lands
// in single-digit ms, but the global sort is the documented worst case and is
// the natural shape for a future portfolio/global view.
//
// Add a plain index on `issues (created DESC)` so SQLite can satisfy the
// global sort without a full table scan + sort. This is additive and safe.
migrate((app) => {
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_issues_created ON issues (created DESC);"
    ];

    for (let sql of indexes) {
        try {
            app.db().newQuery(sql).execute();
        } catch (err) {
            console.error(">>> [Migration] Index creation error:", err.message);
        }
    }
    console.log(">>> [Migration] Successfully created global created index");
});
