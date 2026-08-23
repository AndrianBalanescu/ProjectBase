// pb_hooks/60_notifications.pb.js
// Multi-channel notification dispatcher: Discord, Telegram, Slack, Email, and Generic Webhooks

function sendDiscordNotification(webhookUrl, title, description, colorHex, fields = []) {
    if (!webhookUrl) return
    try {
        let decimalColor = parseInt(colorHex.replace("#", ""), 16) || 65280
        $http.send({
            url: webhookUrl,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "ProjectBase Bot",
                avatar_url: "https://raw.githubusercontent.com/pocketbase/pocketbase/master/examples/base/pb_public/images/logo.png",
                embeds: [{
                    title: title,
                    description: description,
                    color: decimalColor,
                    fields: fields,
                    footer: { text: "ProjectBase • Homelab" },
                    timestamp: new Date().toISOString()
                }]
            }),
            timeout: 5
        })
    } catch (err) {
        console.warn(">>> [ProjectBase] Discord notification error:", err)
    }
}

function sendTelegramNotification(botToken, chatId, messageText) {
    if (!botToken || !chatId) return
    try {
        $http.send({
            url: `https://api.telegram.org/bot${botToken}/sendMessage`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: "Markdown"
            }),
            timeout: 5
        })
    } catch (err) {
        console.warn(">>> [ProjectBase] Telegram notification error:", err)
    }
}

// 1. Hook on Issue Created
onRecordAfterCreateSuccess((e) => {
    try {
        let identifier = e.record.get("identifier")
        let title = e.record.get("title")
        let priority = e.record.get("priority") || "none"
        let status = e.record.get("status") || "todo"
        let assignee = e.record.get("assignee") || "Unassigned"

        let discordUrl = $os.getenv("DISCORD_WEBHOOK_URL")
        let telegramToken = $os.getenv("TELEGRAM_BOT_TOKEN")
        let telegramChatId = $os.getenv("TELEGRAM_CHAT_ID")

        if (discordUrl) {
            sendDiscordNotification(
                discordUrl,
                `✨ New Work Item: ${identifier}`,
                `**${title}**`,
                "#6366f1",
                [
                    { name: "Status", value: status, inline: true },
                    { name: "Priority", value: priority, inline: true },
                    { name: "Assignee", value: assignee, inline: true }
                ]
            )
        }

        if (telegramToken && telegramChatId) {
            sendTelegramNotification(
                telegramToken,
                telegramChatId,
                `⚡ *New Task in ProjectBase*\n*ID:* \`${identifier}\`\n*Title:* ${title}\n*Priority:* ${priority}\n*Assignee:* ${assignee}`
            )
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] create-channel notification failed:", err)
    }
    e.next()
}, "issues")

// 2. Hook on Issue Status / Priority Updated
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

        if (oldStatus !== newStatus) {
            let color = "#3b82f6"
            if (newStatus === "done") color = "#10b981"
            if (newStatus === "cancelled") color = "#ef4444"
            if (newStatus === "in_review") color = "#eab308"

            if (discordUrl) {
                sendDiscordNotification(
                    discordUrl,
                    `🔄 Status Changed: ${identifier} -> ${newStatus.toUpperCase()}`,
                    `**${title}**`,
                    color,
                    [
                        { name: "From", value: oldStatus, inline: true },
                        { name: "To", value: newStatus, inline: true },
                        { name: "Assignee", value: assignee, inline: true }
                    ]
                )
            }

            if (genericWebhookUrl) {
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
            }
        }
    } catch (err) {
        console.warn(">>> [ProjectBase] status-change webhook failed:", err)
    }
    e.next()
}, "issues")
