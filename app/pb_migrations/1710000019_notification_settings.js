// ProjectBase migration 19 — self-hosted notification channel settings.
//
// Adds a `notification_settings` singleton collection holding the external
// messaging channel credentials that `60_notifications.pb.js` dispatches to:
//   - `discord_webhook_url` — Discord webhook endpoint for rich embeds
//   - `telegram_bot_token`  — Telegram bot token
//   - `telegram_chat_id`    — Telegram chat / channel id to post to
//   - `generic_webhook_url` — arbitrary JSON webhook for status changes
//
// The dispatcher already reads the SAME keys from process environment
// (DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
// PROJECTBASE_WEBHOOK_URL). This migration makes them runtime-editable in-app
// so a self-hoster can change channels without a restart. The dispatcher
// reads these DB rows first and falls back to env (env wins only when the
// DB value is empty), preserving existing installs and Docker deployments.
//
// The collection is a SINGLETON base collection. Its rows hold secrets, so the
// public API rules are locked down: only superuser/admin can read/update via
// the /api/projectbase/notification-settings routes (which bypass API rules
// via app-level saves). createRule is null so strangers cannot forge rows.
//
// Purely additive + idempotent: safe on existing and fresh installs.
migrate((app) => {
    const name = "notification_settings"

    let collection
    try { collection = app.findCollectionByNameOrId(name) } catch (err) {}

    const hasField = (col, fieldName) => {
        const found = col.fields.getByName(fieldName)
        return !!(found && found.name)
    }

    if (!collection) {
        collection = new Collection({
            name,
            type: "base",
            listRule: null,
            viewRule: null,
            createRule: null,
            updateRule: null,
            deleteRule: null,
        })
    }

    let added = false
    for (const field of [
        new TextField({ name: "discord_webhook_url", max: 2048 }),
        new TextField({ name: "telegram_token", max: 512 }),
        new TextField({ name: "telegram_chat_id", max: 128 }),
        new TextField({ name: "generic_webhook_url", max: 2048 }),
    ]) {
        if (!hasField(collection, field.name)) {
            collection.fields.add(field)
            added = true
        }
    }
    if (!collection || added) {
        app.save(collection)
    }

    // Seed the singleton row if absent (empty channel values => env fallback).
    let existing = []
    try { existing = app.findRecordsByFilter(name, "1=1", "", 1, 0) } catch (err) { existing = [] }
    if (existing.length === 0) {
        const record = new Record(collection)
        app.save(record)
        console.log(">>> [Migration] notification_settings seeded (empty singleton row)")
    }

    console.log(">>> [Migration] notification_settings collection ensured")
})
