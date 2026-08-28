// ProjectBase migration 26 — Distributed Cross-Cluster Replication, High-Availability Failover & Edge SQLite Sync.
//
// Adds collections for Cluster Orchestration & Edge Sync (Epic 15):
//   1. cluster_nodes: Registered cluster peer nodes, roles (primary, replica, edge, witness), health status, endpoints, heartbeats.
//   2. replication_logs: Granular delta replication logs with vector clocks, operation kinds, and payload checksums.
//   3. cluster_failovers: Historical and active failover election events, split-brain fencing records, and term counters.

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const relation = (name, collectionId, options = {}) => new RelationField({ name, collectionId, ...options })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const collectionIdOf = (name) => {
        try { return app.findCollectionByNameOrId(name).id } catch (err) { return null }
    }
    const projectsId = collectionIdOf("projects")

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

    // 1. cluster_nodes
    ensureCollection("cluster_nodes", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("node_id", { required: true }),
        text("node_name", { required: true }),
        text("role", { required: true }), // primary, replica, edge, witness
        text("endpoint_url", { required: true }),
        text("region", { required: false }),
        text("status", { required: true }), // online, offline, degraded, syncing, fenced
        number("lag_ms", { required: false }),
        number("last_heartbeat", { required: false }),
        number("term", { required: false }),
        number("applied_seq", { required: false }),
        json("capabilities"),
        json("metadata"),
        auto("created", true, false),
        auto("updated", true, true)
    ])

    // 2. replication_logs
    ensureCollection("replication_logs", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("seq_id", { required: true }),
        text("origin_node_id", { required: true }),
        text("target_collection", { required: true }),
        text("record_id", { required: true }),
        text("op_type", { required: true }), // create, update, delete, batch
        text("checksum", { required: false }),
        json("vector_clock"),
        json("delta_payload"),
        number("applied_timestamp", { required: false }),
        auto("created", true, false),
        auto("updated", true, true)
    ])

    // 3. cluster_failovers
    ensureCollection("cluster_failovers", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("election_id", { required: true }),
        text("prior_primary", { required: false }),
        text("promoted_primary", { required: true }),
        text("reason", { required: true }), // heartbeat_timeout, manual_switchover, split_brain_fenced
        text("status", { required: true }), // initiated, quorum_approved, active, rejected
        number("term", { required: true }),
        number("quorum_votes", { required: false }),
        json("participating_nodes"),
        json("fenced_nodes"),
        auto("created", true, false),
        auto("updated", true, true)
    ])
})
