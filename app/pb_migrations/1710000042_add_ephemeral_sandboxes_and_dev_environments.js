// ProjectBase migration 42 — Autonomous Ephemeral Dev Sandboxes & Worktree Container Orchestrator (Milestone 9 / Epic 30).
//
// Introduces isolated ephemeral sandbox execution environments, template blueprints, command execution logging,
// state snapshotting, and automated TTL cleanup for autonomous AI agent workflows:
//   - dev_sandboxes:
//       - `name`                — Display name (e.g. "auth-refactor-sandbox-33")
//       - `slug`                — Unique identifier slug
//       - `project_id`          — Scoped project ID
//       - `issue_id`            — Optional bound issue ID
//       - `session_id`          — Bound agent session ID
//       - `environment_type`    — worktree | docker | process | ephemeral_vm | remote_mesh
//       - `runtime_type`        — node | python | rust | go | pocketbase | custom
//       - `status`              — provisioning | ready | running | paused | terminated | failed
//       - `health_status`       — healthy | degraded | unhealthy | unknown
//       - `template_id`         — Associated sandbox_templates ID
//       - `worktree_path`       — Isolated filesystem / worktree path
//       - `container_id`        — Container or process ID
//       - `allocated_port`      — Assigned port for preview / service
//       - `preview_url`         — Live preview HTTP endpoint
//       - `cpu_limit`           — CPU limit string (e.g. "2.0")
//       - `memory_limit_mb`     — Memory allocation in MB
//       - `ttl_seconds`         — Ephemeral time-to-live in seconds
//       - `auto_teardown`       — Auto-terminate upon TTL expiration
//       - `env_vars_json`       — Environment variables JSON map
//       - `last_ping_at`        — Last active heartbeat timestamp
//       - `terminated_at`       — Teardown timestamp
//       - `created_by`          — Creator user or agent
//   - sandbox_templates:
//       - `name`                — Blueprint name (e.g. "Vue 3 + PocketBase Fullstack")
//       - `slug`                — Template slug
//       - `description`         — Template details
//       - `runtime_type`        — node | python | rust | go | pocketbase | custom
//       - `environment_type`    — worktree | docker | process | ephemeral_vm
//       - `base_image`          — Base Docker image or runtime descriptor
//       - `build_command`       — Setup / build command
//       - `start_command`       — Service start command
//       - `default_port`        — Default listening port
//       - `memory_limit_mb`     — Default memory allocation in MB
//       - `env_defaults_json`   — Default env vars
//       - `is_default`          — Whether this is a system default blueprint
//       - `created_by`          — Creator user or agent
//   - sandbox_executions:
//       - `sandbox_id`          — Reference to dev_sandboxes
//       - `command`             — Executed shell command
//       - `exit_code`           — Process exit code
//       - `status`              — running | completed | failed | timed_out
//       - `stdout`              — Captured standard output
//       - `stderr`              — Captured standard error
//       - `duration_ms`         — Execution duration in ms
//       - `executed_by`         — Executing agent / user
//   - sandbox_snapshots:
//       - `sandbox_id`          — Reference to dev_sandboxes
//       - `snapshot_name`       — Snapshot label / tag
//       - `git_commit_sha`      — Captured git commit SHA
//       - `state_hash`          — State fingerprint hash
//       - `file_count`          — Number of files captured
//       - `size_kb`             — Snapshot disk size in KB
//       - `notes`               — Snapshot description or reason
//       - `created_by`          — Creator agent / user

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

    // 1. dev_sandboxes
    ensureCollection("dev_sandboxes", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("slug", { required: true }),
        text("project_id"),
        text("issue_id"),
        text("session_id"),
        select("environment_type", ["worktree", "docker", "process", "ephemeral_vm", "remote_mesh"]),
        select("runtime_type", ["node", "python", "rust", "go", "pocketbase", "custom"]),
        select("status", ["provisioning", "ready", "running", "paused", "terminated", "failed"]),
        select("health_status", ["healthy", "degraded", "unhealthy", "unknown"]),
        text("template_id"),
        text("worktree_path"),
        text("container_id"),
        number("allocated_port"),
        text("preview_url"),
        text("cpu_limit"),
        number("memory_limit_mb"),
        number("ttl_seconds"),
        bool("auto_teardown"),
        json("env_vars_json"),
        text("last_ping_at"),
        text("terminated_at"),
        text("created_by")
    ])

    // 2. sandbox_templates
    ensureCollection("sandbox_templates", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("name", { required: true }),
        text("slug", { required: true }),
        text("description"),
        select("runtime_type", ["node", "python", "rust", "go", "pocketbase", "custom"]),
        select("environment_type", ["worktree", "docker", "process", "ephemeral_vm"]),
        text("base_image"),
        text("build_command"),
        text("start_command"),
        number("default_port"),
        number("memory_limit_mb"),
        json("env_defaults_json"),
        bool("is_default"),
        text("created_by")
    ])

    // 3. sandbox_executions
    ensureCollection("sandbox_executions", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("sandbox_id", { required: true }),
        text("command", { required: true }),
        number("exit_code"),
        select("status", ["running", "completed", "failed", "timed_out"]),
        text("stdout"),
        text("stderr"),
        number("duration_ms"),
        text("executed_by")
    ])

    // 4. sandbox_snapshots
    ensureCollection("sandbox_snapshots", "@request.auth.id != ''", "@request.auth.id != ''", [
        text("sandbox_id", { required: true }),
        text("snapshot_name", { required: true }),
        text("git_commit_sha"),
        text("state_hash"),
        number("file_count"),
        number("size_kb"),
        text("notes"),
        text("created_by")
    ])
}, (app) => {
    const drop = (name) => {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) app.delete(col)
        } catch (e) {}
    }
    drop("sandbox_snapshots")
    drop("sandbox_executions")
    drop("sandbox_templates")
    drop("dev_sandboxes")
})
