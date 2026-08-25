// pb_hooks/60_notifications.pb.js
// Multi-channel notification dispatcher: Discord, Telegram, and Generic Webhooks.
//
// SCOPING NOTE (critical): In the Goja runtime PocketBase uses, module-scope
// function declarations are NOT resolvable from inside a hook callback — every
// call throws `ReferenceError: <fn> is not defined`. This is the same bug class
// as the cycle-5 P0 fix in 15_signup_security.pb.js and the note in
// 55_notifications.pb.js. ALL dispatch logic is therefore inlined directly
// inside each callback (or defined as local `const` arrow functions at the top
// of the callback, which Goja CAN resolve). Every path is wrapped in try/catch
// so a broken notification never breaks the core write path.
//
// Channel config is runtime-editable via the `notification_settings` singleton
// collection (see migration 19 + the admin-gated routes in 30_custom_routes.pb.js).
// The dispatcher reads the DB row first and falls back to process environment
// (DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
// PROJECTBASE_WEBHOOK_URL), so existing installs and Docker deployments keep
// working unchanged.

// 1. Hook on Issue Created — posts to Discord (rich embed) and/or Telegram.
onRecordAfterCreateSuccess((e) => {
    try {
        let identifier = e.record.get("identifier")
        let title = e.record.get("title")
        let priority = e.record.get("priority") || "none"
        let status = e.record.get("status") || "todo"
        let assignee = e.record.get("assignee") || "Unassigned"

        // Channel config is runtime-editable via notification_settings (singleton
        // collection); env remains the fallback for fresh installs / Docker.
        let discordUrl = $os.getenv("DISCORD_WEBHOOK_URL")
        let telegramToken = $os.getenv("TELEGRAM_BOT_TOKEN")
        let telegramChatId = $os.getenv("TELEGRAM_CHAT_ID")
        try {
            const rows = e.app.findRecordsByFilter("notification_settings", "1=1", "", 1, 0)
            if (rows.length > 0) {
                const row = rows[0]
                const dbDiscord = row.get("discord_webhook_url")
                const dbToken = row.get("telegram_token")
                const dbChat = row.get("telegram_chat_id")
                if (dbDiscord) discordUrl = dbDiscord
                if (dbToken) telegramToken = dbToken
                if (dbChat) telegramChatId = dbChat
            }
        } catch (settingsErr) {
            // notification_settings collection missing on old installs — env only.
        }

        if (discordUrl) {
            try {
                let decimalColor = parseInt("#6366f1".replace("#", ""), 16) || 65280
                $http.send({
                    url: discordUrl,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: "ProjectBase Bot",
                        avatar_url: "https://raw.githubusercontent.com/pocketbase/pocketbase/master/examples/base/pb_public/images/logo.png",
                        embeds: [{
                            title: `✨ New Work Item: ${identifier}`,
                            description: `**${title}**`,
                            color: decimalColor,
                            fields: [
                                { name: "Status", value: status, inline: true },
                                { name: "Priority", value: priority, inline: true },
                                { name: "Assignee", value: assignee, inline: true }
                            ],
                            footer: { text: "ProjectBase • Homelab" },
                            timestamp: new Date().toISOString()
                        }]
                    }),
                    timeout: 5
                })
            } catch (discordErr) {
                console.warn(">>> [ProjectBase] Discord notification error:", discordErr)
            }
        }

        if (telegramToken && telegramChatId) {
            try {
                $http.send({
                    url: `https://api.telegram.org/bot${telegramToken}/sendMessage`,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: telegramChatId,
                        text: `⚡ *New Task in ProjectBase*\n*ID:* \`${identifier}\`\n*Title:* ${title}\n*Priority:* ${priority}\n*Assignee:* ${assignee}`,
                        parse_mode: "Markdown"
                    }),
                    timeout: 5
                })
            } catch (telegramErr) {
                console.warn(">>> [ProjectBase] Telegram notification error:", telegramErr)
            }
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] create-channel notification failed:", err)
    }
    e.next()
}, "issues")

// 2. Hook on Issue Status / Priority Updated — Discord embed + generic webhook.
onRecordAfterUpdateSuccess((e) => {
    try {
        // NOTE: this PocketBase JSVM has no `originalCopy()`; use `original()`.
        const original = e.record.original()
        let oldStatus = original ? (original.get("status") || "") : ""
        let newStatus = e.record.get("status") || ""
        let identifier = e.record.get("identifier")
        let title = e.record.get("title")
        let assignee = e.record.get("assignee") || "Unassigned"

        let discordUrl = $os.getenv("DISCORD_WEBHOOK_URL")
        let genericWebhookUrl = $os.getenv("PROJECTBASE_WEBHOOK_URL")
        // Runtime-editable channel config from notification_settings (env fallback).
        try {
            const rows = e.app.findRecordsByFilter("notification_settings", "1=1", "", 1, 0)
            if (rows.length > 0) {
                const row = rows[0]
                const dbDiscord = row.get("discord_webhook_url")
                const dbWebhook = row.get("generic_webhook_url")
                if (dbDiscord) discordUrl = dbDiscord
                if (dbWebhook) genericWebhookUrl = dbWebhook
            }
        } catch (settingsErr) {
            // notification_settings collection missing on old installs — env only.
        }

        if (oldStatus !== newStatus) {
            let color = "#3b82f6"
            if (newStatus === "done") color = "#10b981"
            if (newStatus === "cancelled") color = "#ef4444"
            if (newStatus === "in_review") color = "#eab308"

            if (discordUrl) {
                try {
                    let decimalColor = parseInt(color.replace("#", ""), 16) || 65280
                    $http.send({
                        url: discordUrl,
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: "ProjectBase Bot",
                            avatar_url: "https://raw.githubusercontent.com/pocketbase/pocketbase/master/examples/base/pb_public/images/logo.png",
                            embeds: [{
                                title: `🔄 Status Changed: ${identifier} -> ${newStatus.toUpperCase()}`,
                                description: `**${title}**`,
                                color: decimalColor,
                                fields: [
                                    { name: "From", value: oldStatus, inline: true },
                                    { name: "To", value: newStatus, inline: true },
                                    { name: "Assignee", value: assignee, inline: true }
                                ],
                                footer: { text: "ProjectBase • Homelab" },
                                timestamp: new Date().toISOString()
                            }]
                        }),
                        timeout: 5
                    })
                } catch (discordErr) {
                    console.warn(">>> [ProjectBase] Discord notification error:", discordErr)
                }
            }

            if (genericWebhookUrl) {
                try {
                    $http.send({
                        url: genericWebhookUrl,
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            event: "issue.status_changed",
                            issue: {
                                id: e.record.id,
                                identifier: identifier,
                                title: title,
                                old_status: oldStatus,
                                new_status: newStatus,
                                assignee: assignee
                            },
                            timestamp: new Date().toISOString()
                        }),
                        timeout: 5
                    })
                } catch (webhookErr) {
                    console.warn(">>> [ProjectBase] generic webhook notification error:", webhookErr)
                }
            }
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] status-change webhook failed:", err)
    }
    e.next()
}, "issues")
