// ProjectBase migration 11 — drop legacy `comments.body` schema drift.
//
// The schema-repair backfill in migration 003 carried a stale `comments`
// definition from the pre-release schema: a required `text("body")` field
// with an `author` relation. Migration 0000 already defines the canonical
// comments shape (`author` text, `author_type` select, `content` text,
// `attachments`), so on every install that ran 003 the collection ended up
// with BOTH the canonical `content` and the legacy required `body` column.
// No current writer (UI comment form, pb_hooks audit comments, pb-cli,
// documented agent API) sets `body`, so every comment creation failed with
// `body: cannot be blank` — a hard regression for the IssueDrawer comment
// box and the autonomous agent dispatcher.
//
// This migration converges every install to the canonical schema:
//   1. copy `body` into `content` for rows where `content` is empty (none
//      known in practice, but data-preserving), then
//   2. drop the `body` field.
// Idempotent: absent `body` is a no-op. Fresh installs are unaffected
// (003 was corrected to backfill the canonical shape instead).
migrate((app) => {
    let comments
    try {
        comments = app.findCollectionByNameOrId("comments")
    } catch (err) {
        console.log(">>> [Migration] Skipped comments.body cleanup (no comments collection)")
        return
    }

    let bodyField = null
    try { bodyField = comments.fields.getByName("body") } catch (e) {}
    if (!bodyField) {
        // Already canonical — nothing to do.
        return
    }

    // Data preservation: if any legacy rows carry body text but no content,
    // copy it over before the column disappears.
    let copied = 0
    try {
        const rows = app.findRecordsByFilter("comments", "body != ''", "", 0, 0)
        for (const row of rows) {
            const content = row.get("content")
            if (content === undefined || content === null || String(content).trim() === "") {
                row.set("content", row.get("body"))
                app.save(row)
                copied++
            }
        }
    } catch (err) {
        console.log(">>> [Migration] body->content copy scan skipped: " + String((err && err.message) || err))
    }

    comments.fields = comments.fields.filter((f) => f.name !== "body")
    app.save(comments)

    console.log(">>> [Migration] Dropped legacy comments.body (copied " + copied + " orphaned bodies into content)")
}, (app) => {
    // Downgrade is an explicit operator action: re-adding a typed legacy
    // column (and its required constraint) is intentionally not automated,
    // matching the policy in migration 003 ("removed fields are an explicit
    // operator action").
    console.log(">>> [Migration] Downgrade of comments.body drop is an explicit operator action")
})
