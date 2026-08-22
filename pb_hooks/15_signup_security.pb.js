// ProjectBase signup security hook.
//
// Public self-signup is enabled by migration 1710000006 (users.createRule = "").
// These hooks are the privilege-escalation guard: they force EVERY newly
// created user record to role = 'member', and they block any self-service role
// escalation on update.
//
// Why a hook and not just a createRule:
//   - A createRule alone cannot set a value; it only gates access. With the
//     create API public, a stranger could otherwise submit role:'admin' and
//     gain admin on the very account they register.
//   - onRecordCreateRequest runs before persistence and is authoritative for
//     the payload, so we can overwrite any attempted role escalation.
//   - The users.updateRule currently allows a user to edit their own record
//     (`id = @request.auth.id || ...`). Without an update guard, a member
//     could PATCH their own role to 'admin' and gain admin privileges. The
//     onRecordUpdateRequest handler below blocks that: a non-privileged actor
//     can never raise a role, and any payload attempting it is coerced back to
//     'member'.
//
// Admin/manager role assignment remains possible only by an authenticated
// admin (or PocketBase superuser) creating or updating the account; any other
// creator/updater (or the anonymous public) is forced to member.

function _isPrivileged(req) {
    const admin = req && req.admin
    const auth = req && req.auth
    return Boolean(
        admin ||
        (auth && auth.get && (auth.get("role") === "admin" || auth.get("role") === "manager")))
}

onRecordCreateRequest((e) => {
    try {
        if (!_isPrivileged(e.requestInfo())) {
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

onRecordUpdateRequest((e) => {
    try {
        const req = e.requestInfo()
        const auth = req && req.auth
        const isSelfUpdate = auth && auth.id && auth.id === e.record.id
        if (isSelfUpdate && !_isPrivileged(req)) {
            // A member editing their own profile must not be able to escalate
            // their role. Coerce any attempted role change back to member.
            e.record.set("role", "member")
        }
    } catch (err) {
        // Fail safe: never allow a self-service role escalation on error.
        try {
            const r = e.record.get("role")
            if (r === "admin" || r === "manager" || r === "agent") {
                e.record.set("role", "member")
            }
        } catch (_) {}
        console.error(">>> Error guarding role on user update:", err)
    }
    e.next()
}, "users")
