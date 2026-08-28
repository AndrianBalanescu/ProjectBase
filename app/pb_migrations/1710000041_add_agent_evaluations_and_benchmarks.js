// ProjectBase migration 41 — Agent Evaluation Benchmark Harness, Leaderboard & Regression Matrix (Milestone 8 / Epic 29).
//
// Introduces continuous evaluation, standardized benchmark suites, per-scenario assertion metrics,
// live model leaderboards, and automated regression detection across models, personas, and versions:
//   - eval_suites:
//       - `name`                — Suite display name (e.g. "Coding Accuracy & Test Pass Benchmark")
//       - `slug`                — Unique identifier (e.g. "coding-accuracy-v1")
//       - `description`         — Detailed benchmark explanation
//       - `domain`              — coding | reasoning | tool_use | refactor | qa | security | orchestration
//       - `scenarios_json`      — Array of test scenarios with inputs, expected outputs, assertions, and timeouts
//       - `timeout_seconds`     — Maximum execution window per scenario
//       - `pass_threshold_pct`  — Minimum pass rate percentage required for certification (e.g. 90)
//       - `is_active`           — Whether suite is currently active
//       - `created_by`          — User or agent ID
//   - eval_runs:
//       - `suite_id`            — Reference to eval_suites
//       - `suite_slug`          — Slug snapshot for fast filtering
//       - `model`               — Evaluated LLM model (e.g. "gpt-5.5", "claude-fable-5", "deepseek-r1")
//       - `persona`             — Evaluated agent persona (e.g. "coder", "architect", "debugger", "swe")
//       - `status`              — pending | running | completed | failed | regressed
//       - `total_scenarios`     — Total scenarios evaluated
//       - `passed_scenarios`    — Number of passing scenarios
//       - `failed_scenarios`    — Number of failing scenarios
//       - `score_percentage`    — Aggregate accuracy / pass score (0-100)
//       - `avg_latency_ms`      — Mean step latency in milliseconds
//       - `total_cost_usd`      — Total token cost across run in USD
//       - `total_tokens`        — Total prompt + completion tokens
//       - `regressions_count`   — Number of scenarios regressing compared to baseline
//       - `summary`             — Markdown / text summary of run findings
//       - `metadata_json`       — Environment, git commit, temperature, parameters
//   - eval_metrics:
//       - `run_id`              — Reference to eval_runs
//       - `scenario_id`         — Identifier of test scenario
//       - `scenario_name`       — Title of test scenario
//       - `status`              — passed | failed | error | skipped
//       - `latency_ms`          — Milliseconds taken for scenario
//       - `tokens_used`         — Token consumption for scenario
//       - `cost_usd`            — Cost for scenario
//       - `error_message`       — Traceback or failure reason
//       - `output_diff`         — Code or text diff compared to ground truth
//       - `assertions_json`     — Granular assertion checks breakdown
//   - eval_benchmarks:
//       - `model`               — Target model
//       - `persona`             — Target persona
//       - `domain`              — Benchmark domain or global
//       - `composite_score`     — Weighted composite score (0-100)
//       - `win_rate`            — Head-to-head win rate against baseline (0-100)
//       - `avg_pass_rate`       — Historical average pass rate %
//       - `avg_cost_per_task`   — Average cost per task in USD
//       - `avg_latency_ms`      — Average latency in milliseconds
//       - `total_runs`          — Total historical evaluation runs
//       - `certification_status`— certified | under_review | regressed | deprecated
//       - `last_run_at`         — ISO timestamp of most recent run
//       - `baseline_metrics_json`— Baseline metrics map for regression diffing

migrate((app) => {
    const text = (name, options = {}) => new TextField({ name, ...options })
    const number = (name, options = {}) => new NumberField({ name, ...options })
    const bool = (name, options = {}) => new BoolField({ name, ...options })
    const json = (name) => new JSONField({ name })
    const select = (name, values) => new SelectField({ name, values })
    const auto = (name, onCreate, onUpdate) => new AutodateField({ name, onCreate, onUpdate })

    const hasField = (col, name) => {
        try {
            return col.fields.getByName(name) !== null
        } catch (e) {
            return false
        }
    }

    const ensureCollection = (name, listRule, viewRule, fields) => {
        let col = null
        try {
            col = app.findCollectionByNameOrId(name)
        } catch (e) {
            col = new Collection({
                name: name,
                type: "base",
                listRule: listRule,
                viewRule: viewRule,
                createRule: "@request.auth.id != ''",
                updateRule: "@request.auth.id != ''",
                deleteRule: "@request.auth.id != ''",
            })
            fields.forEach(f => col.fields.add(f))
            col.fields.add(auto("created", true, false))
            col.fields.add(auto("updated", true, true))
            app.save(col)
            return col
        }

        let updated = false
        fields.forEach(f => {
            if (!hasField(col, f.name)) {
                col.fields.add(f)
                updated = true
            }
        })
        if (updated) {
            app.save(col)
        }
        return col
    }

    // 1. eval_suites
    ensureCollection("eval_suites", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("slug", { required: true }),
        text("description"),
        select("domain", ["coding", "reasoning", "tool_use", "refactor", "qa", "security", "orchestration"]),
        json("scenarios_json"),
        number("timeout_seconds"),
        number("pass_threshold_pct"),
        bool("is_active"),
        text("created_by")
    ])

    // 2. eval_runs
    ensureCollection("eval_runs", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("suite_id", { required: true }),
        text("suite_slug"),
        text("model", { required: true }),
        text("persona"),
        select("status", ["pending", "running", "completed", "failed", "regressed"]),
        number("total_scenarios"),
        number("passed_scenarios"),
        number("failed_scenarios"),
        number("score_percentage"),
        number("avg_latency_ms"),
        number("total_cost_usd"),
        number("total_tokens"),
        number("regressions_count"),
        text("summary"),
        json("metadata_json")
    ])

    // 3. eval_metrics
    ensureCollection("eval_metrics", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("run_id", { required: true }),
        text("scenario_id", { required: true }),
        text("scenario_name"),
        select("status", ["passed", "failed", "error", "skipped"]),
        number("latency_ms"),
        number("tokens_used"),
        number("cost_usd"),
        text("error_message"),
        text("output_diff"),
        json("assertions_json")
    ])

    // 4. eval_benchmarks
    ensureCollection("eval_benchmarks", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("model", { required: true }),
        text("persona"),
        text("domain"),
        number("composite_score"),
        number("win_rate"),
        number("avg_pass_rate"),
        number("avg_cost_per_task"),
        number("avg_latency_ms"),
        number("total_runs"),
        select("certification_status", ["certified", "under_review", "regressed", "deprecated"]),
        text("last_run_at"),
        json("baseline_metrics_json")
    ])
}, (app) => {
    // Revert migrations if needed
})
