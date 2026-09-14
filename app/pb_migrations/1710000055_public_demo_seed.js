// Generic starter workspace for the first public alpha.
//
// This migration is additive and intentionally never deletes or rewrites an
// existing project. Existing installations keep all data. A fresh installation
// receives one small workspace so the core workflow is immediately discoverable.
migrate((app) => {
    let existing = []
    try { existing = app.findRecordsByFilter("projects", "id != ''", "created", 1, 0) || [] }
    catch (err) {}
    if (existing.length > 0) return

    try {
        const projects = app.findCollectionByNameOrId("projects")
        const issues = app.findCollectionByNameOrId("issues")
        const project = new Record(projects)
        project.set("name", "ProjectBase Demo")
        project.set("identifier", "PB")
        project.set("description", "A lightweight workspace for projects, issues, cycles, and milestones.")
        project.set("icon", "⚡")
        project.set("color", "#6366f1")
        project.set("repo_url", "")
        project.set("lead", "ProjectBase")
        project.set("is_favorite", true)
        app.save(project)

        const demo = [
            ["Explore the project board", "Move this issue through the workflow.", "todo", "medium"],
            ["Plan the first cycle", "Choose the issues to deliver next.", "backlog", "low"],
            ["Define a product milestone", "Describe the next meaningful outcome.", "backlog", "low"],
        ]
        demo.forEach((item, index) => {
            const issue = new Record(issues)
            issue.set("title", item[0])
            issue.set("description", item[1])
            issue.set("status", item[2])
            issue.set("priority", item[3])
            issue.set("project", project.id)
            issue.set("issue_number", index + 1)
            issue.set("identifier", `PB-${index + 1}`)
            app.save(issue)
        })
    } catch (err) {
        console.log(">>> [ProjectBase Public Demo] skipped", String(err))
    }
}, (app) => {
    // Seed data is user-owned after creation and is never removed automatically.
})
