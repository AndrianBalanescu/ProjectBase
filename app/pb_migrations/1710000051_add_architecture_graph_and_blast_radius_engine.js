// ProjectBase migration 51 — Autonomous Agent Dynamic Architecture Graph, AST Blast-Radius Impact Simulator & Breaking Change Sentinel Engine (Milestone 17 / Epic 38 / v1.37.0).
//
// Introduces dynamic dependency graph parsing, transitive blast-radius calculation,
// breaking change risk estimation, and targeted test execution planning.

migrate((app) => {
    function text(name, opts = {}) {
        return new Field({
            name,
            type: "text",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function bool(name, opts = {}) {
        return new Field({
            name,
            type: "bool",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function number(name, opts = {}) {
        return new Field({
            name,
            type: "number",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function select(name, values, opts = {}) {
        return new Field({
            name,
            type: "select",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false,
            values: values || [],
            maxSelect: 1
        })
    }

    function json(name, opts = {}) {
        return new Field({
            name,
            type: "json",
            required: !!opts.required,
            presentable: !!opts.presentable,
            primaryKey: !!opts.primaryKey,
            hidden: false
        })
    }

    function ensureCollection(name, listRule = "", viewRule = "", fields = []) {
        let col
        try {
            col = app.findCollectionByNameOrId(name)
        } catch (_) {
            col = new Collection({
                name,
                type: "base",
                listRule: listRule !== undefined ? listRule : "",
                viewRule: viewRule !== undefined ? viewRule : "",
                createRule: "",
                updateRule: "",
                deleteRule: ""
            })
            fields.forEach(f => col.fields.add(f))
            try {
                col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }))
                col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
            } catch (_) {}
            app.save(col)
            return col
        }

        let updated = false
        if (listRule !== undefined && col.listRule !== listRule) {
            col.listRule = listRule
            updated = true
        }
        if (viewRule !== undefined && col.viewRule !== viewRule) {
            col.viewRule = viewRule
            updated = true
        }
        fields.forEach(f => {
            if (!col.fields.getByName(f.name)) {
                col.fields.add(f)
                updated = true
            }
        })
        if (updated) {
            app.save(col)
        }
        return col
    }

    // 1. arch_graphs
    ensureCollection("arch_graphs", "", "", [
        text("project_id"),
        text("name", { required: true, presentable: true }),
        text("root_path"),
        text("language"),
        number("node_count"),
        number("edge_count"),
        number("risk_score"),
        select("status", ["active", "indexing", "stale", "archived"]),
        json("metadata")
    ])

    // 2. arch_nodes
    ensureCollection("arch_nodes", "", "", [
        text("graph_id", { required: true }),
        select("node_type", ["file", "module", "component", "endpoint", "database_model", "test_suite", "service", "other"]),
        text("name", { required: true, presentable: true }),
        text("path"),
        text("symbol_name"),
        bool("exported"),
        number("loc"),
        number("complexity_score"),
        number("dependencies_count"),
        number("dependents_count"),
        json("metadata")
    ])

    // 3. arch_edges
    ensureCollection("arch_edges", "", "", [
        text("graph_id", { required: true }),
        text("source_node_id", { required: true }),
        text("target_node_id", { required: true }),
        select("relation_type", ["imports", "calls", "renders", "reads_schema", "mutates_schema", "tests", "emits_event", "depends_on"]),
        number("weight"),
        json("metadata")
    ])

    // 4. blast_simulations
    ensureCollection("blast_simulations", "", "", [
        text("project_id"),
        text("graph_id"),
        text("title", { required: true, presentable: true }),
        select("trigger_source", ["agent_pr", "commit", "manual", "pre_push", "tdd_suite", "other"]),
        json("changed_paths"),
        number("affected_nodes_count"),
        number("blast_radius_score"),
        select("risk_level", ["low", "moderate", "high", "critical"]),
        number("breaking_changes_count"),
        json("affected_test_suites"),
        json("simulation_results"),
        json("metadata")
    ])
})
