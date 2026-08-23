// pb_hooks/50_cron_automation.pb.js
// Built-in PocketBase Cron jobs for cycle auto-rollover and hourly workspace snapshots

cronAdd("daily_cycle_monitor", "0 0 * * *", (e) => {
    try {
        console.log(">>> [ProjectBase Cron] Running daily sprint cycle monitor...")
        let cyclesCol = e.app.findCollectionByNameOrId("cycles")
        let activeCycles = e.app.findRecordsByFilter("cycles", "status = 'active'", "-created", 100, 0)
        let now = new Date()

        for (let c of activeCycles) {
            let endStr = c.get("end_date")
            if (endStr) {
                let endDate = new Date(endStr)
                if (endDate < now) {
                    c.set("status", "completed")
                    e.app.save(c)
                    console.log(`>>> [ProjectBase Cron] Auto-completed expired cycle: ${c.get("name")} (${c.id})`)
                }
            }
        }
    } catch (err) {
        console.error(">>> [ProjectBase Cron Error]:", err)
    }
})

cronAdd("hourly_velocity_logger", "0 * * * *", (e) => {
    try {
        let issues = e.app.findRecordsByFilter("issues", "1=1", "-created", 1000, 0)
        let done = issues.filter(i => i.get("status") === "done").length
        let total = issues.length
        let percent = total > 0 ? Math.round((done / total) * 100) : 0
        console.log(`>>> [ProjectBase Heartbeat] Active issues: ${total}, Completed: ${done} (${percent}%)`)
    } catch (err) {
        // Heartbeat log error
    }
})
