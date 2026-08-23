// ProjectBase migration 10 — strip forbidden monetization schema drift.
//
// ProjectBase is 100% free and open-source (MIT). The strict FOSS rule forbids
// paid plans, Pro tiers, Stripe billing, payment gates, and hosted cloud
// waitlists. A few older demo databases carry orphaned collections/fields that
// were created ad-hoc (never declared in any migration, never referenced by
// hooks, UI, scripts, or docs):
//
//   - `orders`    — Stripe checkout table (stripe_session_id, amount_cents)
//   - `leads`     — hosted waitlist / lead capture table
//   - `users.plan`— paid-tier field on the user record
//
// This migration removes them idempotently from any existing install so every
// deployment converges to the clean FOSS schema defined in migration 0000.
// Fresh installs are unaffected (the artifacts simply do not exist there).
// Safe: deletes only these exact orphaned names and never touches other data.
migrate((app) => {
    const dropCollection = (name) => {
        try {
            const col = app.findCollectionByNameOrId(name)
            if (col) {
                app.delete(col)
                console.log(">>> [Migration] Removed forbidden monetization collection: " + name)
            }
        } catch (err) {
            console.log(">>> [Migration] Skipped (absent) collection: " + name)
        }
    }

    dropCollection("orders")
    dropCollection("leads")

    // Remove users.plan (paid-tier field) if present, preserving all other fields.
    try {
        const users = app.findCollectionByNameOrId("users")
        let planField = null
        try { planField = users.fields.getByName("plan") } catch (e) {}
        if (planField) {
            users.fields = users.fields.filter((f) => f.name !== "plan")
            app.save(users)
            console.log(">>> [Migration] Removed forbidden users.plan (paid tier) field")
        }
    } catch (err) {
        console.log(">>> [Migration] users collection unavailable: " + String((err && err.message) || err))
    }
}, (app) => {
    // Intentionally non-reversible: these artifacts violate the FOSS rule.
    // Restoring them would reintroduce prohibited monetization schema.
})
