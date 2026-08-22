// pb_hooks/60_webhooks_and_events.pb.js
// Outbound webhook dispatcher & real-time agent notifications using PocketBase native $http

onRecordAfterUpdateSuccess((e) => {
    try {
        let oldStatus = e.record.originalCopy().get("status")
        let newStatus = e.record.get("status")

        if (oldStatus !== newStatus) {
            console.log(`>>> [ProjectBase Event] Issue ${e.record.get("identifier")} status changed: ${oldStatus} -> ${newStatus}`)

            // Optional webhook notification if configured in environment
            let webhookUrl = $os.getenv("PROJECTBASE_WEBHOOK_URL")
            if (webhookUrl) {
                try {
                    $http.send({
                        url: webhookUrl,
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            event: "issue.status_changed",
                            issue: {
                                id: e.record.id,
                                identifier: e.record.get("identifier"),
                                title: e.record.get("title"),
                                status: newStatus,
                                previous_status: oldStatus,
                                project: e.record.get("project")
                            },
                            timestamp: new Date().toISOString()
                        }),
                        timeout: 5
                    })
                } catch (httpErr) {
                    // Non-blocking webhook failure
                }
            }
        }
    } catch (err) {
        // Safe fallback
    }
    e.next()
}, "issues")
