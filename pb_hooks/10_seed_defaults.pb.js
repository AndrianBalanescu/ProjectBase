// pb_hooks/10_seed_defaults.pb.js
// Idempotently seeds all core Homelab projects, sprint cycles, and active tasks

onBootstrap((e) => {
    e.next()

    try {
        let projectsCol = e.app.findCollectionByNameOrId("projects")
        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let cyclesCol = e.app.findCollectionByNameOrId("cycles")
        let labelsCol = e.app.findCollectionByNameOrId("labels")
        let milestonesCol = e.app.findCollectionByNameOrId("milestones")

        function getOrCreateProject(data) {
            let found = null
            try {
                let records = e.app.findRecordsByFilter("projects", `identifier = '${data.identifier}'`, "-created", 1, 0)
                if (records && records.length > 0) found = records[0]
            } catch (err) {}

            if (!found) {
                let p = new Record(projectsCol)
                p.set("name", data.name)
                p.set("identifier", data.identifier)
                p.set("description", data.description)
                p.set("icon", data.icon)
                p.set("color", data.color)
                p.set("repo_url", data.repo_url || "")
                p.set("lead", data.lead || "Agent")
                p.set("is_favorite", data.is_favorite !== false)
                e.app.save(p)
                console.log(">>> [ProjectBase Seed] Created project:", data.name, `[${data.identifier}]`)
                found = p
            }
            return found
        }

        function createIssuesForProject(projectRecord, issuesList) {
            for (let item of issuesList) {
                let existing = null
                try {
                    let recs = e.app.findRecordsByFilter("issues", `project = '${projectRecord.id}' && title = '${item.title.replace(/'/g, "\\'")}'`, "-created", 1, 0)
                    if (recs && recs.length > 0) existing = recs[0]
                } catch (err) {}

                if (!existing) {
                    let issueRec = new Record(issuesCol)
                    issueRec.set("project", projectRecord.id)
                    issueRec.set("title", item.title)
                    issueRec.set("description", item.description || "")
                    issueRec.set("status", item.status || "todo")
                    issueRec.set("priority", item.priority || "medium")
                    issueRec.set("estimate", Number(item.estimate) || 0)
                    issueRec.set("assignee", item.assignee || "Flomaster Agent")
                    issueRec.set("labels", item.labels || [])
                    issueRec.set("subtasks", item.subtasks || [])
                    if (item.cycle) issueRec.set("cycle", item.cycle)
                    issueRec.set("order", Date.now() + Math.random() * 1000)
                    e.app.save(issueRec)
                }
            }
        }

        
        function getOrCreateMilestone(projectId, name, desc, targetDate, status) {
            let found = null
            try {
                let recs = e.app.findRecordsByFilter("milestones", `project = '${projectId}' && name = '${name.replace(/'/g, "\\'")}'`, "-created", 1, 0)
                if (recs && recs.length > 0) found = recs[0]
            } catch (err) {}

            if (!found) {
                let m = new Record(milestonesCol)
                m.set("project", projectId)
                m.set("name", name)
                m.set("description", desc || "")
                m.set("target_date", targetDate || new Date().toISOString())
                m.set("status", status || "planned")
                e.app.save(m)
                found = m
            }
            return found
        }

        function getOrCreateCycle(projectId, name, desc) {
            let found = null
            try {
                let recs = e.app.findRecordsByFilter("cycles", `project = '${projectId}' && name = '${name.replace(/'/g, "\\'")}'`, "-created", 1, 0)
                if (recs && recs.length > 0) found = recs[0]
            } catch (err) {}

            if (!found) {
                let c = new Record(cyclesCol)
                c.set("project", projectId)
                c.set("name", name)
                c.set("description", desc)
                c.set("start_date", new Date().toISOString())
                let end = new Date()
                end.setDate(end.getDate() + 14)
                c.set("end_date", end.toISOString())
                c.set("status", "active")
                e.app.save(c)
                found = c
            }
            return found
        }

        // 1. ProjectBase Core (PB)
        let pPB = getOrCreateProject({
            name: "ProjectBase Core",
            identifier: "PB",
            description: "High-performance Plane & Linear alternative powered by PocketBase + Zero-Build Vue 3.",
            icon: "⚡",
            color: "#6366f1",
            repo_url: "https://github.com/AndrianBalanescu/projectbase",
            lead: "Flomaster Agent",
            settings: {
                north_star: {
                    vision: "Build the fastest, zero-friction open-source Linear alternative backed by PocketBase & SQLite.",
                    objective: "Achieve 100% feature parity with Linear/Plane for agentic teams with sub-20ms latency and zero build steps.",
                    target_quarter: "Q3-Q4 2026"
                }
            }
        })
        let mPB1 = getOrCreateMilestone(pPB.id, "M1: Zero-Build Foundation & Realtime Sync", "Vue 3 CDN, Tailwind, PocketBase SQLite backend, SSE events, and FastMCP integration.", "2026-08-22", "achieved")
        let mPB2 = getOrCreateMilestone(pPB.id, "M2: Autonomous Flow Runner & Agentic Engine", "Unified Flow research & builder loop, task claiming, PRD generator, and Windmill dispatch.", "2026-09-01", "in_progress")
        let mPB3 = getOrCreateMilestone(pPB.id, "M3: Full Linear Parity & Performance Benchmarks", "Custom views, sub-issue hierarchy, keyboard-first navigation, and public demo deployment.", "2026-09-15", "planned")
        let cPB = getOrCreateCycle(pPB.id, "Sprint 1 - Architecture & Launch", "Initial release with zero-build Vue 3, real-time SSE, FastMCP, and OpenAPI Scalar docs.")
        createIssuesForProject(pPB, [
            {
                title: "Design zero-build Vue 3 + Tailwind dark UI",
                description: "Build clean, Raycast/Linear inspired dark theme with reusable components and Lucide icons.",
                status: "done",
                priority: "high",
                estimate: 3,
                cycle: cPB.id,
                labels: ["core", "frontend"]
            },
            {
                title: "Implement fluid drag & drop Kanban board with SortableJS",
                description: "Support drag-and-drop between columns with real-time SSE sync and celebratory confetti on completion.",
                status: "done",
                priority: "urgent",
                estimate: 5,
                cycle: cPB.id,
                labels: ["realtime", "frontend"]
            },
            {
                title: "OpenAPI 3.1 & Interactive Scalar Reference at /docs",
                description: "Serve complete OpenAPI specification and modern Scalar UI for interactive API exploration and testing.",
                status: "done",
                priority: "high",
                estimate: 3,
                cycle: cPB.id,
                labels: ["docs", "api"]
            },
            {
                title: "Agentic discovery via /llms.txt and /llms-full.txt",
                description: "Implement LLM discovery standard endpoints to guide autonomous agent actions and schema understanding.",
                status: "done",
                priority: "high",
                estimate: 2,
                cycle: cPB.id,
                labels: ["agent", "docs"]
            },
            {
                title: "In-App Interactive Docs & Agent Guide view",
                description: "Provide embedded API tester, autonomous agent workflow handbook, and copyable snippets (FastMCP, Python, cURL, JS).",
                status: "in_progress",
                priority: "high",
                estimate: 3,
                cycle: cPB.id,
                labels: ["frontend", "docs"]
            }
        ])

        // 2. LoadETA (LOAD)
        let pLOAD = getOrCreateProject({
            name: "LoadETA",
            identifier: "LOAD",
            description: "Real-time freight dispatching, rate calculation, and driver ETA optimization platform.",
            icon: "🚚",
            color: "#3b82f6",
            repo_url: "https://github.com/AndrianBalanescu/loadeta",
            lead: "Andrian"
        })
        let cLOAD = getOrCreateCycle(pLOAD.id, "Sprint 3 - ETA Precision & Dispatch", "Refining distance matrices, live traffic inputs, and multi-stop load routing.")
        createIssuesForProject(pLOAD, [
            {
                title: "Optimize haversine route calculation with matrix caching",
                description: "Cache frequent freight lanes to reduce latency from 320ms down to <15ms per dispatch lookup.",
                status: "in_progress",
                priority: "urgent",
                estimate: 5,
                cycle: cLOAD.id,
                labels: ["backend", "performance"],
                subtasks: [
                    { id: "1", title: "Implement Redis lane cache key format", done: true },
                    { id: "2", title: "Benchmark lookup time across 10k loads", done: false }
                ]
            },
            {
                title: "Driver live GPS telematics webhook ingestor",
                description: "Ingest live ELD / GPS pings every 30s and update live ETA tracking cards.",
                status: "todo",
                priority: "high",
                estimate: 3,
                cycle: cLOAD.id,
                labels: ["api", "telematics"]
            },
            {
                title: "Automated rate quote PDF generator",
                description: "Generate branded PDF rate confirmations with dynamic fuel surcharge breakdown.",
                status: "backlog",
                priority: "medium",
                estimate: 2,
                labels: ["feature"]
            }
        ])

        // 3. iBrowse (IBR)
        let pIBR = getOrCreateProject({
            name: "iBrowse Server",
            identifier: "IBR",
            description: "Homelab headless browser automation, E2E QA audits, console error checks, and web scraping (:3000).",
            icon: "🌐",
            color: "#06b6d4",
            repo_url: "https://github.com/AndrianBalanescu/ibrowse",
            lead: "Flomaster Agent"
        })
        let cIBR = getOrCreateCycle(pIBR.id, "Sprint 2 - Agentic Browser QA", "Enhancing automated audits, DOM snapshotting, and console error detection.")
        createIssuesForProject(pIBR, [
            {
                title: "Add automated visual regression screenshot comparison",
                description: "Store baseline snapshots and compute pixel diff percentage for critical dashboard pages.",
                status: "todo",
                priority: "high",
                estimate: 5,
                cycle: cIBR.id,
                labels: ["qa", "automation"]
            },
            {
                title: "Console error and network 4xx/5xx audit hook",
                description: "Automatically flag uncaught JavaScript exceptions during agent browser runs.",
                status: "done",
                priority: "high",
                estimate: 3,
                cycle: cIBR.id,
                labels: ["core", "qa"]
            },
            {
                title: "FastMCP server for direct agent browser control",
                description: "Provide MCP tools for page navigation, element clicking, form filling, and DOM evaluation.",
                status: "in_progress",
                priority: "urgent",
                estimate: 3,
                cycle: cIBR.id,
                labels: ["agent", "mcp"]
            }
        ])

        // 4. OmniRoute (OMNI)
        let pOMNI = getOrCreateProject({
            name: "OmniRoute AI Gateway",
            identifier: "OMNI",
            description: "Homelab AI model router and multi-provider proxy on :20128 with live fallbacks and token analytics.",
            icon: "🧠",
            color: "#ec4899",
            repo_url: "https://github.com/AndrianBalanescu/omniroute",
            lead: "Agent"
        })
        createIssuesForProject(pOMNI, [
            {
                title: "Dynamic latency-based model failover routing",
                description: "Automatically fall back to backup LLM routes when p95 response latency exceeds 4.5s.",
                status: "in_progress",
                priority: "urgent",
                estimate: 5,
                labels: ["core", "ai"]
            },
            {
                title: "Per-session token usage and VRAM telemetry exporter",
                description: "Export real-time token consumption metrics to Prometheus and Grafana dashboards.",
                status: "done",
                priority: "medium",
                estimate: 2,
                labels: ["observability"]
            }
        ])

        // 5. Memrize (MEM)
        let pMEM = getOrCreateProject({
            name: "Memrize Memory Layer",
            identifier: "MEM",
            description: "Unified cross-session memory, entity graphs, and context indexing for Cursor, Hermes, and Antigravity.",
            icon: "🔮",
            color: "#a855f7",
            repo_url: "https://github.com/AndrianBalanescu/memrize",
            lead: "Andrian"
        })
        createIssuesForProject(pMEM, [
            {
                title: "Hybrid dense vector + BM25 sparse recall ranker",
                description: "Merge FastEmbed embeddings with sqlite-vec and FTS5 ranking for high-precision recall.",
                status: "in_progress",
                priority: "high",
                estimate: 5,
                labels: ["search", "memory"]
            },
            {
                title: "Cross-agent session state synchronization",
                description: "Ensure changes in Hermes Kanban reflect instantly in Cursor and Flomaster working context.",
                status: "todo",
                priority: "medium",
                estimate: 3,
                labels: ["sync"]
            }
        ])

        // 6. Homelab Infrastructure (HOME)
        let pHOME = getOrCreateProject({
            name: "Homelab Infrastructure",
            identifier: "HOME",
            description: "Ubuntu homelab operations, Tailscale mesh, GPU orchestrator (:20900), and monitoring.",
            icon: "🏠",
            color: "#10b981",
            repo_url: "",
            lead: "Andrian"
        })
        createIssuesForProject(pHOME, [
            {
                title: "Decommission Plane containers to reclaim 2.73 GB RAM",
                description: "Stop and disable makeplane containers on Homelab to relieve memory pressure and full swap.",
                status: "done",
                priority: "urgent",
                estimate: 1,
                labels: ["infra", "core"]
            },
            {
                title: "Deploy ProjectBase as lightweight systemd service on port 8120",
                description: "Ensure zero-downtime auto-start on Homelab reboot consuming only ~15 MB RAM.",
                status: "done",
                priority: "high",
                estimate: 2,
                labels: ["infra"]
            }
        ])

        console.log(">>> [ProjectBase Seed] All Homelab projects & tasks verified.")
    } catch (err) {
        console.error(">>> [ProjectBase Seed Error]:", err)
    }
})
