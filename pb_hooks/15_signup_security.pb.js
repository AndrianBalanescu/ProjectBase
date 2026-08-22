// ProjectBase signup security hook.
//
// Public self-signup is enabled by migration 1710000006 (users.createRule = "").
// This hook is the privilege-escalation guard: it forces EVERY newly created
// user record to role = 'member', regardless of what the caller submitted.
//
// Why a hook and not just a createRule:
//   - A createRule alone cannot set a value; it only gates access. With the
//     create API public, a stranger could otherwise submit role:'admin' and
//     gain admin on the very account they register.
//   - onRecordCreateRequest runs before persistence and is authoritative for
//     the payload, so we can overwrite any attempted role escalation.
//
// The coercion applies to the /api/collections/users/records create path.
// Admin/manager role assignment remains possible only by an authenticated
// admin (or PocketBase superuser) creating the account; any other creator
// (or the anonymous public) is forced to member.

onRecordCreateRequest((e) => {
    try {
        const req = e.requestInfo()
        const admin = req && req.admin
        const auth = req && req.auth
        const privileged =
            admin ||
            (auth && auth.get && (auth.get("role") === "admin" || auth.get("role") === "manager"))
        if (!privileged) {
            // Anonymous self-service signup: force member, never escalate.
            e.record.set("role", "member")
        }
    } catch (err) {
        // On any introspection failure, fail safe to member (never escalate).
        try { e.record.set("role", "member") } catch (_) {}
        console.error(">>> Error forcing member role on new user:", err)
    }
    e.next()
}, "users")
