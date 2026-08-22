// ProjectBase migration 6 — enable secure public self-signup.
//
// Context (cycle 5, strategic calibration / first-stranger milestone):
//   - The roadmap explicitly flags "stranger signup UX" as the blocker to
//     shipping to real users.
//   - Previously users.createRule = "@request.auth.role = 'admin'", so a
//     stranger could NOT self-register at all; the login gate had no signup.
//
// This migration is intentionally split into two halves:
//   1) Here we ONLY relax users.createRule to allow public self-registration.
//   2) A companion pb_hooks file (15_signup_security.pb.js) forces any new
//      user's role to 'member' via onRecordCreateRequest, so a stranger can
//      never self-escalate to admin/manager/agent regardless of what they
//      submit in the create payload. This keeps privilege escalation closed
//      even though the create API is now public.
//
// listRule/viewRule/updateRule/deleteRule remain locked down unchanged.
// Purely additive to auth posture: we only widen the single create gate and
// back it with a mandatory role coercion.
migrate((app) => {
    const usersCol = app.findCollectionByNameOrId("users")
    if (!usersCol) {
        throw new Error("users collection not found")
    }
    usersCol.createRule = ""
    app.save(usersCol)
    console.log(">>> [Migration] Enabled public user self-registration (role enforced to member by pb_hooks)")
}, (app) => {
    // Reversible: restore admin-only creation.
    try {
        const usersCol = app.findCollectionByNameOrId("users")
        usersCol.createRule = "@request.auth.role = 'admin'"
        app.save(usersCol)
    } catch (err) {}
})
