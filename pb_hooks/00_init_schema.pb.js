// pb_hooks/00_init_schema.pb.js
// Auto-initializes collections schema & upgrades fields for ProjectBase

onBootstrap((e) => {
    e.next()

    function getOrCreateCollection(name, type, customFields, rules = {}) {
        let col = null
        try {
            col = e.app.findCollectionByNameOrId(name)
        } catch (err) {}

        const standardFields = [
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
        ]

        const allFields = [...customFields, ...standardFields]

        if (!col) {
            col = new Collection({
                name: name,
                type: type || "base",
                listRule: rules.listRule !== undefined ? rules.listRule : "",
                viewRule: rules.viewRule !== undefined ? rules.viewRule : "",
                createRule: rules.createRule !== undefined ? rules.createRule : "",
                updateRule: rules.updateRule !== undefined ? rules.updateRule : "",
                deleteRule: rules.deleteRule !== undefined ? rules.deleteRule : "",
                fields: allFields
            })
            e.app.save(col)
            console.log(">>> [ProjectBase] Created collection: " + name)
        } else {
            // Check for attachments field on issues/comments
            if (name === "issues" || name === "comments") {
                let hasAttachments = false
                try {
                    hasAttachments = col.fields.getByName("attachments") !== null
                } catch (ex) {}

                if (!hasAttachments) {
                    try {
                        let f = new FileField({
                            name: "attachments",
                            maxSelect: 10,
                            maxSize: 10485760,
                            thumbs: ["100x100", "400x300"]
                        })
                        col.fields.add(f)
                        e.app.save(col)
                        console.log(`>>> [ProjectBase] Added FileField 'attachments' to '${name}'`)
                    } catch (err) {
                        console.warn(`>>> [ProjectBase] FileField add failed on '${name}':`, err)
                    }
                }
            }
        }
        return col
    }

    try {
        // 1. Projects Collection
        let projectsCol = getOrCreateCollection("projects", "base", [
            { name: "name", type: "text", required: true },
            { name: "identifier", type: "text", required: true },
            { name: "description", type: "text" },
            { name: "icon", type: "text" },
            { name: "color", type: "text" },
            { name: "repo_url", type: "text" },
            { name: "lead", type: "text" },
            { name: "is_favorite", type: "bool" },
            { name: "settings", type: "json" }
        ])

        // 2. Cycles (Sprints) Collection
        let cyclesCol = getOrCreateCollection("cycles", "base", [
            { name: "project", type: "relation", collectionId: projectsCol.id, cascadeDelete: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "description", type: "text" },
            { name: "start_date", type: "date" },
            { name: "end_date", type: "date" },
            { name: "status", type: "select", values: ["upcoming", "active", "completed"] }
        ])

        // 3. Milestones Collection
        let milestonesCol = getOrCreateCollection("milestones", "base", [
            { name: "project", type: "relation", collectionId: projectsCol.id, cascadeDelete: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "description", type: "text" },
            { name: "target_date", type: "date" },
            { name: "status", type: "select", values: ["planned", "in_progress", "achieved"] }
        ])

        // 4. Labels Collection
        let labelsCol = getOrCreateCollection("labels", "base", [
            { name: "project", type: "relation", collectionId: projectsCol.id, cascadeDelete: false },
            { name: "name", type: "text", required: true },
            { name: "color", type: "text", required: true },
            { name: "description", type: "text" }
        ])

        // 5. Issues Collection (with native file attachments & thumbnails)
        let issuesCol = getOrCreateCollection("issues", "base", [
            { name: "project", type: "relation", collectionId: projectsCol.id, cascadeDelete: true, required: true },
            { name: "identifier", type: "text", required: true },
            { name: "issue_number", type: "number" },
            { name: "title", type: "text", required: true },
            { name: "description", type: "text" },
            { name: "status", type: "select", values: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] },
            { name: "priority", type: "select", values: ["urgent", "high", "medium", "low", "none"] },
            { name: "assignee", type: "text" },
            { name: "due_date", type: "date" },
            { name: "estimate", type: "number" },
            { name: "labels", type: "json" },
            { name: "subtasks", type: "json" },
            { name: "attachments", type: "file", maxSelect: 10, maxSize: 10485760, thumbs: ["100x100", "400x300"] },
            { name: "cycle", type: "relation", collectionId: cyclesCol.id, cascadeDelete: false },
            { name: "milestone", type: "relation", collectionId: milestonesCol.id, cascadeDelete: false },
            { name: "order", type: "number" }
        ])

        // 6. Comments Collection
        let commentsCol = getOrCreateCollection("comments", "base", [
            { name: "issue", type: "relation", collectionId: issuesCol.id, cascadeDelete: true, required: true },
            { name: "author", type: "text", required: true },
            { name: "author_type", type: "select", values: ["user", "agent", "system"] },
            { name: "content", type: "text", required: true },
            { name: "attachments", type: "file", maxSelect: 5, maxSize: 10485760, thumbs: ["100x100"] }
        ])

        // 7. Activity Collection
        let activityCol = getOrCreateCollection("activity", "base", [
            { name: "project", type: "relation", collectionId: projectsCol.id, cascadeDelete: true },
            { name: "issue", type: "relation", collectionId: issuesCol.id, cascadeDelete: true },
            { name: "actor", type: "text", required: true },
            { name: "actor_type", type: "select", values: ["user", "agent", "system"] },
            { name: "action", type: "text", required: true },
            { name: "details", type: "json" }
        ])

        console.log(">>> [ProjectBase] Schema initialization verified with file storage & timestamps.")
    } catch (err) {
        console.error(">>> [ProjectBase Schema Error]:", err)
    }
})
