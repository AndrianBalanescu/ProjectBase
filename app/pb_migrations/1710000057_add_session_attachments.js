// Session copilot attachments. Files are stored separately from agent_sessions so
// runtime records remain lightweight and attachment cleanup is explicit.
migrate((app) => {
    let col = null
    try { col = app.findCollectionByNameOrId("session_attachments") } catch (err) {}
    if (col) return

    col = new Collection({ name: "session_attachments", type: "base" })
    col.fields.add(new TextField({ name: "owner", required: true, max: 32 }))
    col.fields.add(new TextField({ name: "session_id", required: true, max: 255 }))
    col.fields.add(new FileField({
        name: "file",
        required: true,
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: [
            "image/png", "image/jpeg", "image/gif", "image/webp",
            "text/plain", "text/markdown", "application/json",
            "application/pdf", "text/csv", "application/zip"
        ],
        thumbs: ["320x240", "800x600"]
    }))
    col.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }))
    col.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
    app.save(col)

    col = app.findCollectionByNameOrId("session_attachments")
    col.listRule = "owner = @request.auth.id"
    col.viewRule = "owner = @request.auth.id"
    col.createRule = "@request.auth.id != '' && @request.body.owner = @request.auth.id"
    col.updateRule = "owner = @request.auth.id && @request.body.owner:changed = false"
    col.deleteRule = "owner = @request.auth.id"
    app.save(col)
}, (app) => {
    try { app.delete(app.findCollectionByNameOrId("session_attachments")) } catch (err) {}
})
