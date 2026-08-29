// ProjectBase migration 49 — Autonomous Agent Test-Driven Development (TDD) Synthesizer, Mutation Testing Matrix, Flaky Test Quarantine & Test Coverage Sentinel Engine (Milestone 15 / Epic 36 / v1.35.0).
//
// Introduces automated test suite synthesis, case-level execution assertions, AST/semantic mutation testing,
// flaky test detection and quarantine isolation, and repository-wide test coverage & gap matrix analytics.

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
            maxSelect: opts.maxSelect || 1
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

    // 1. tdd_suites
    ensureCollection("tdd_suites", "", "", [
        text("name", { required: true, presentable: true }),
        text("description"),
        text("issue_id"),
        text("project_id"),
        select("status", ["draft", "active", "passing", "failing", "flaky"]),
        select("framework", ["pytest", "jest", "vitest", "go_test", "cargo_test", "custom"]),
        select("test_type", ["unit", "integration", "e2e", "mutation", "regression"]),
        text("suite_file_path"),
        number("test_count"),
        number("pass_count"),
        number("fail_count"),
        number("skip_count"),
        number("duration_ms"),
        number("coverage_pct"),
        json("spec_json"),
        text("created_by"),
        text("last_run_at")
    ])

    // 2. tdd_cases
    ensureCollection("tdd_cases", "", "", [
        text("suite_id", { required: true }),
        text("name", { required: true, presentable: true }),
        text("description"),
        text("target_symbol"),
        select("assertion_type", ["equality", "exception", "boundary", "invariant", "mock", "snapshot"]),
        select("status", ["pending", "passing", "failing", "quarantined", "skipped"]),
        text("test_code"),
        text("expected_output"),
        text("last_error"),
        number("duration_ms"),
        number("flake_score"),
        bool("is_quarantined"),
        number("execution_count"),
        number("pass_count"),
        number("fail_count")
    ])

    // 3. mutation_runs
    ensureCollection("mutation_runs", "", "", [
        text("suite_id"),
        text("project_id"),
        text("target_file", { required: true }),
        select("mutator_type", ["boundary_condition", "conditional_inversion", "math_operator", "statement_removal", "return_value", "type_swap"]),
        select("status", ["pending", "running", "completed", "failed"]),
        number("mutants_total"),
        number("mutants_killed"),
        number("mutants_survived"),
        number("mutation_score"),
        json("mutant_diffs_json"),
        text("executed_by"),
        number("duration_ms")
    ])

    // 4. flaky_quarantines
    ensureCollection("flaky_quarantines", "", "", [
        text("case_id"),
        text("suite_id"),
        text("test_name", { required: true }),
        text("file_path"),
        number("flake_rate_pct"),
        text("quarantine_reason"),
        select("isolation_level", ["skip", "warning_only", "parallel_retry", "strict_quarantine"]),
        number("reproduction_runs"),
        json("failure_signatures_json"),
        select("status", ["active", "reviewing", "resolved", "unquarantined"]),
        text("quarantined_by"),
        text("resolved_by"),
        text("resolved_at")
    ])
})
