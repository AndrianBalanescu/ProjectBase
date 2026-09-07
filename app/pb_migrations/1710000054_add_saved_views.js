// ProjectBase migration 54 — Saved Views (per-user named filter states).
//
// Linear/Plane table stakes: a user can save the current board/list filter
// combination (search query, priority, cycle, label) under a name and re-apply
// it with one click. The saved state is stored as the same URL query params the
// UI already round-trips (`q`, `priority`, `cycle`, `label`), so applying a view
// is a plain route navigation — no new state machinery.
//
// Schema:
//   saved_views:
//     - owner    — the users record that owns the view (cascade delete)
//     - project  — optional project scope; empty = view is global (all projects)
//     - name     — human label, unique-ish per owner+project (validated in hook)
//     - query    — serialized URLSearchParams string, e.g. "q=drag&priority=high"
//     - view     — which surface it was saved from: board | list
//
// Rules (defense in depth; the hook enforces the same contract):
//   - list/view: only your own views. Sharing saved views across users is not a
//     table-stakes feature and would leak filter habits — keep it private.
//   - create: any authenticated user, owner forced to @request.auth.id.
//   - update/delete: owner only (admin may clean up).
//
// Purely additive + idempotent: safe on existing and fresh installs.
migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const select = (name, values) => new SelectField({ name, values, maxSelect: 1 })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }

    const usersId = (() => { try { return app.findCollectionByNameOrId("users").id } catch (err) { return null } })()
    const projectsId = (() => { try { return app.findCollectionByNameOrId("projects").id } catch (err) { return null } })()
    if (!usersId) {
        console.log(">>> [Migration] Skipped saved_views collection (missing users)")
        return
    }

    const listRule = "owner = @request.auth.id"
    const viewRule = "owner = @request.auth.id"
    // NOTE: PocketBase evaluates createRule BEFORE onRecordCreateRequest hooks,
    // so the rule must not inspect @request.body.owner (a client spoofing owner
    // would be rejected here before the hook can force owner = auth id).
    // The hook (36_saved_views.pb.js) is authoritative for owner forcing.
    const createRule = "@request.auth.id != ''"
    const updateRule = "owner = @request.auth.id"
    const deleteRule = "owner = @request.auth.id || @request.auth.role = 'admin'"

    let col = null
    try { col = app.findCollectionByNameOrId("saved_views") } catch (err) {}
    if (!col) {
        col = new Collection({
            name: "saved_views",
            type: "base",
            listRule,
            viewRule,
            createRule,
            updateRule,
            deleteRule,
        })
    } else {
        let rulesChanged = false
        if (col.listRule !== listRule) { col.listRule = listRule; rulesChanged = true }
        if (col.viewRule !== viewRule) { col.viewRule = viewRule; rulesChanged = true }
        if (col.createRule !== createRule) { col.createRule = createRule; rulesChanged = true }
        if (col.updateRule !== updateRule) { col.updateRule = updateRule; rulesChanged = true }
        if (col.deleteRule !== deleteRule) { col.deleteRule = deleteRule; rulesChanged = true }
        if (rulesChanged) app.save(col)
    }

    let added = false
    for (const field of [
        relation("owner", usersId, { required: true, cascadeDelete: true }),
        projectsId ? relation("project", projectsId, { cascadeDelete: true }) : text("project"),
        text("name", { required: true, max: 64 }),
        text("query", { required: true, max: 512 }),
        select("view", ["board", "list"]),
        auto("created", true, false),
        auto("updated", true, true),
    ]) {
        if (!hasField(col, field.name)) {
            col.fields.add(field)
            added = true
        }
    }
    if (added) app.save(col)
    console.log(">>> [Migration] saved_views collection ensured")
})