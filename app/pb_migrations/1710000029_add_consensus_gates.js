// ProjectBase migration 29 — Autonomous Multi-Model Consensus & Peer Review Gate Engine.
//
// Adds collections for Consensus Gates, Signed Ballots & Debate Arbitration (Epic 18):
//   1. consensus_gates: Peer-review consensus gates for issues, PRs, releases and architecture RFCs.
//   2. consensus_ballots: Verifiable, cryptographically signed model ballots with confidence and findings.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
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
            if (listRule !== undefined && col.listRule !== listRule) {
                col.listRule = listRule
                changed = true
            }
            if (viewRule !== undefined && col.viewRule !== viewRule) {
                col.viewRule = viewRule
                changed = true
            }
            if (changed) app.save(col)
        }
        return col
    }

    // 1. consensus_gates
    ensureCollection("consensus_gates", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("issue_id"),
        text("target_type"),
        text("target_title"),
        text("scope"),
        text("status"),
        number("quorum_size"),
        number("min_confidence"),
        json("required_personas"),
        number("consensus_score"),
        number("divergence_score"),
        text("verdict"),
        json("summary"),
        bool("auto_transition"),
        auto("created", true, false),
        auto("updated", true, true),
    ])

    // 2. consensus_ballots
    ensureCollection("consensus_ballots", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("gate_id"),
        text("model_name"),
        text("persona"),
        text("vote"),
        number("confidence"),
        text("reasoning"),
        json("findings"),
        text("signature"),
        text("ballot_timestamp"),
        bool("verified"),
        auto("created", true, false),
        auto("updated", true, true),
    ])
}, (app) => {
    try {
        const c1 = app.findCollectionByNameOrId("consensus_gates")
        if (c1) app.delete(c1)
    } catch (err) {}
    try {
        const c2 = app.findCollectionByNameOrId("consensus_ballots")
        if (c2) app.delete(c2)
    } catch (err) {}
})
