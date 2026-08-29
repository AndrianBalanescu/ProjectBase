// ProjectBase migration 52 — Autonomous Agent Performance Profiler, Memory Leak Detection, Bottleneck Sentinel & Flamegraph Engine (Milestone 18 / Epic 39 / v1.38.0).
//
// Introduces hierarchical call-tree profiling, span telemetry, heap snapshot leak analysis,
// automated bottleneck detection, and flamegraph synthesis.

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

    // 1. perf_profiles — performance profiling sessions and flamegraph run metadata
    ensureCollection("perf_profiles", "", "", [
        text("session_id"),
        text("project_id"),
        text("title", { required: true, presentable: true }),
        select("target_type", ["agent_session", "tool_call", "api_endpoint", "workflow", "codebase_benchmark"]),
        select("status", ["recording", "analyzed", "optimized", "failed"]),
        number("duration_ms"),
        number("sample_count"),
        number("peak_memory_mb"),
        number("cpu_utilization_pct"),
        json("flamegraph_tree"),
        json("metrics"),
        json("tags")
    ]);

    // 2. perf_spans — fine-grained function and tool execution spans
    ensureCollection("perf_spans", "", "", [
        text("profile_id", { required: true }),
        text("parent_span_id"),
        text("name", { required: true, presentable: true }),
        select("category", ["function", "tool_call", "db_query", "http_request", "io_read", "io_write", "gc_pause", "custom"]),
        number("start_time_offset_ms"),
        number("duration_ms"),
        number("self_time_ms"),
        number("call_count"),
        number("memory_delta_kb"),
        json("metadata")
    ]);

    // 3. perf_heap_snapshots — memory allocations, retained sizes & leak telemetry
    ensureCollection("perf_heap_snapshots", "", "", [
        text("profile_id"),
        text("session_id"),
        number("snapshot_seq"),
        number("total_heap_mb"),
        number("used_heap_mb"),
        number("retained_size_mb"),
        number("allocations_count"),
        bool("leak_detected"),
        json("leak_suspects"),
        number("growth_rate_kb_sec")
    ]);

    // 4. perf_bottlenecks — automated bottleneck diagnostics, root cause & recommendations
    ensureCollection("perf_bottlenecks", "", "", [
        text("profile_id", { required: true }),
        text("span_id"),
        text("title", { required: true, presentable: true }),
        select("severity", ["critical", "high", "medium", "low", "info"]),
        select("bottleneck_type", ["cpu_bound", "n_plus_one_query", "memory_leak", "io_blocking", "unbounded_concurrency", "unnecessary_recomputation"]),
        number("impact_ms"),
        number("impact_pct"),
        text("root_cause"),
        text("suggested_fix"),
        select("status", ["detected", "investigating", "optimized", "ignored"]),
        json("verification_result")
    ]);
}, (app) => {
    const cols = ["perf_bottlenecks", "perf_heap_snapshots", "perf_spans", "perf_profiles"];
    for (const name of cols) {
        try {
            const col = app.findCollectionByNameOrId(name);
            if (col) app.delete(col);
        } catch (_) {}
    }
});
