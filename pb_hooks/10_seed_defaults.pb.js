// pb_hooks/10_seed_defaults.pb.js
// Seeds starter project, cycles, labels, and issues if database is empty

onBootstrap((e) => {
    e.next()

    try {
        let projectsCol = e.app.findCollectionByNameOrId("projects")
        let existingProjects = e.app.findRecordsByFilter("projects", "1=1", "-created", 1, 0)
        
        if (existingProjects && existingProjects.length > 0) {
            return // Database already has projects
        }

        console.log(">>> [ProjectBase] Seeding initial projects and demo data...")

        // 1. Create Core Project
        let p1 = new Record(projectsCol)
        p1.set("name", "ProjectBase Core")
        p1.set("identifier", "PB")
        p1.set("description", "High-performance, lightweight Plane & Linear alternative powered by PocketBase and Vue 3.")
        p1.set("icon", "⚡")
        p1.set("color", "#6366f1")
        p1.set("repo_url", "https://github.com/AndrianBalanescu/projectbase")
        p1.set("lead", "Flomaster Agent")
        p1.set("is_favorite", true)
        e.app.save(p1)

        // 2. Create Homelab Project
        let p2 = new Record(projectsCol)
        p2.set("name", "Homelab Infrastructure")
        p2.set("identifier", "HOME")
        p2.set("description", "Ubuntu homelab operations, AI orchestration, and service monitoring.")
        p2.set("icon", "🏠")
        p2.set("color", "#10b981")
        p2.set("lead", "Andrian")
        p2.set("is_favorite", true)
        e.app.save(p2)

        // 3. Create Cycle 1 for PB
        let cyclesCol = e.app.findCollectionByNameOrId("cycles")
        let c1 = new Record(cyclesCol)
        c1.set("project", p1.id)
        c1.set("name", "Cycle 1 - Architecture & Launch")
        c1.set("description", "Initial release with zero-build Vue 3, real-time SSE, and Kanban board.")
        c1.set("start_date", new Date().toISOString())
        let endDate = new Date()
        endDate.setDate(endDate.getDate() + 14)
        c1.set("end_date", endDate.toISOString())
        c1.set("status", "active")
        e.app.save(c1)

        // 4. Create Milestone for PB
        let milestonesCol = e.app.findCollectionByNameOrId("milestones")
        let m1 = new Record(milestonesCol)
        m1.set("project", p1.id)
        m1.set("name", "v1.0 Production Release")
        m1.set("description", "Feature complete Plane alternative ready for multi-repo agent automation.")
        m1.set("target_date", endDate.toISOString())
        m1.set("status", "in_progress")
        e.app.save(m1)

        // 5. Create Labels
        let labelsCol = e.app.findCollectionByNameOrId("labels")
        let defaultLabels = [
            { name: "feature", color: "#3b82f6" },
            { name: "bug", color: "#ef4444" },
            { name: "core", color: "#8b5cf6" },
            { name: "realtime", color: "#10b981" },
            { name: "agent", color: "#f59e0b" }
        ]
        for (let l of defaultLabels) {
            let lr = new Record(labelsCol)
            lr.set("project", p1.id)
            lr.set("name", l.name)
            lr.set("color", l.color)
            e.app.save(lr)
        }

        // 6. Create Initial Issues for PB
        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let demoIssues = [
            {
                title: "Design zero-build Vue 3 + Tailwind dark UI",
                description: "Build clean, Raycast/Linear inspired dark theme with reusable components and Lucide icons.",
                status: "done",
                priority: "high",
                estimate: 3,
                issue_number: 1,
                identifier: "PB-1",
                labels: ["core", "feature"],
                subtasks: [
                    { id: "1", title: "Setup Tailwind dark color scheme", done: true },
                    { id: "2", title: "Include Lucide icons bundle", done: true }
                ]
            },
            {
                title: "Implement fluid drag & drop Kanban board with SortableJS",
                description: "Support drag-and-drop between Backlog, Todo, In Progress, In Review, Done columns with real-time sync.",
                status: "in_progress",
                priority: "urgent",
                estimate: 5,
                issue_number: 2,
                identifier: "PB-2",
                labels: ["realtime", "feature"],
                subtasks: [
                    { id: "1", title: "Bind SortableJS to column DOM elements", done: true },
                    { id: "2", title: "Sync card reordering to PocketBase", done: false }
                ]
            },
            {
                title: "Real-time SSE event subscriptions for zero-latency multi-client sync",
                description: "Subscribe to PocketBase collection events so browser tabs and AI agents update concurrently without polling.",
                status: "in_progress",
                priority: "high",
                estimate: 3,
                issue_number: 3,
                identifier: "PB-3",
                labels: ["realtime", "core"]
            },
            {
                title: "AI Agent REST API helper and MCP integration",
                description: "Provide endpoints and MCP tools so agents like Flomaster and Hermes can read and mutate tasks autonomously.",
                status: "todo",
                priority: "medium",
                estimate: 3,
                issue_number: 4,
                identifier: "PB-4",
                labels: ["agent", "feature"]
            },
            {
                title: "Sprint Cycles & Burndown chart view",
                description: "Track timeboxed sprints with start/end dates and completion progress rings.",
                status: "todo",
                priority: "medium",
                estimate: 5,
                issue_number: 5,
                identifier: "PB-5",
                labels: ["feature"]
            },
            {
                title: "Command Palette Omnibar (Cmd/Ctrl + K)",
                description: "Keyboard-first navigation, global search, and instant task creation modal.",
                status: "backlog",
                priority: "low",
                estimate: 2,
                issue_number: 6,
                identifier: "PB-6",
                labels: ["feature"]
            }
        ]

        for (let item of demoIssues) {
            let issueRec = new Record(issuesCol)
            issueRec.set("project", p1.id)
            issueRec.set("identifier", item.identifier)
            issueRec.set("issue_number", item.issue_number)
            issueRec.set("title", item.title)
            issueRec.set("description", item.description)
            issueRec.set("status", item.status)
            issueRec.set("priority", item.priority)
            issueRec.set("estimate", item.estimate)
            issueRec.set("labels", item.labels || [])
            issueRec.set("subtasks", item.subtasks || [])
            issueRec.set("cycle", c1.id)
            issueRec.set("milestone", m1.id)
            issueRec.set("order", Date.now() + item.issue_number * 100)
            e.app.save(issueRec)
        }

        // 7. Create Issues for HOME project
        let homeIssues = [
            {
                title: "Decommission Plane containers to reclaim 2.73 GB RAM",
                description: "Stop and disable makeplane containers on Homelab to relieve memory pressure and full swap.",
                status: "todo",
                priority: "urgent",
                estimate: 1,
                issue_number: 1,
                identifier: "HOME-1",
                labels: ["infra", "core"]
            },
            {
                title: "Deploy ProjectBase as lightweight systemd service on port 8120",
                description: "Ensure zero-downtime auto-start on Homelab reboot.",
                status: "in_progress",
                priority: "high",
                estimate: 2,
                issue_number: 2,
                identifier: "HOME-2",
                labels: ["infra"]
            }
        ]

        for (let item of homeIssues) {
            let issueRec = new Record(issuesCol)
            issueRec.set("project", p2.id)
            issueRec.set("identifier", item.identifier)
            issueRec.set("issue_number", item.issue_number)
            issueRec.set("title", item.title)
            issueRec.set("description", item.description)
            issueRec.set("status", item.status)
            issueRec.set("priority", item.priority)
            issueRec.set("estimate", item.estimate)
            issueRec.set("labels", item.labels || [])
            issueRec.set("order", Date.now() + item.issue_number * 100)
            e.app.save(issueRec)
        }

        console.log(">>> [ProjectBase] Seed data created successfully!")
    } catch (err) {
        console.error(">>> [ProjectBase Seed Error]:", err)
    }
})
