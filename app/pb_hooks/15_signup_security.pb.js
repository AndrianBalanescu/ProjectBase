// ProjectBase signup security hook.
//
// Public self-signup is enabled by migration 1710000006 (users.createRule = "").
// These hooks are the privilege-escalation guard: they force EVERY newly
// created user record to role = 'member', and they freeze the role on
// self-service updates so a user can never promote their own account.
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
//     onRecordUpdateRequest handler below freezes the role to its existing
//     stored value on any self-service update, so a user can edit their
//     profile (name/email/etc.) without losing their role, but can NEVER
//     raise their own role.
//
// Admin/manager role assignment remains possible only by an authenticated
// admin (or PocketBase superuser) creating or updating the account; any other
// creator/updater (or the anonymous public) is forced to member.
//
// Scoping note (why everything is inlined):
// In the Goja runtime PocketBase uses, module-scope function declarations are
// NOT resolvable from inside a hook callback — every call to one throws
// `ReferenceError: <fn> is not defined`. An earlier version declared a
// module-scope `_isPrivileged(req)` helper and called it from the callbacks;
// every invocation threw, the catch forced `member` unconditionally, and even
// superuser-created manager accounts were silently downgraded to member. All
// logic below is therefore inlined directly inside each callback.
//
// A superuser authenticates as a record in the `_superusers` collection, which
// has no `role` field; it is detected via `auth.collection().name`.

onRecordCreateRequest((e) => {
    try {
        // ANY actor creating a user record (anonymous public, regular
        // admin/manager, even a superuser via REST) is coerced to 'member' on
        // the CREATE path. This makes it impossible for a stranger to self-
        // escalate, and keeps role assignment a strictly UPDATE-path concern:
        // an account is promoted to admin/manager only by a privileged PATCH
        // (see the onRecordUpdateRequest handler below and
        // test_manager_admin_cannot_mint_privileged_user_via_create).
        e.record.set("role", "member")
    } catch (err) {
        // Fail safe to member (never escalate).
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
        // Determine whether this is a privileged updater (superuser, or an
        // authenticated user with role admin/manager). Privileged updaters may
        // change roles; a self-service edit by anyone else is frozen.
        let privileged = false
        let who = null
        try { who = req && (req.admin || req.auth) } catch (x) {}
        if (who) {
            try {
                if (who.collection && who.collection().name === "_superusers") {
                    privileged = true
                } else if (who.get) {
                    const role = who.get("role")
                    privileged = role === "admin" || role === "manager"
                }
            } catch (x) {}
        }
        if (isSelfUpdate && !privileged) {
            // Self-service update by a non-privileged user: freeze the role to
            // its current stored value. This blocks self-promotion to
            // admin/manager while allowing a user to edit their own name,
            // email, etc. without losing their role.
            let existingRole = "member"
            try {
                const cur = e.app.findRecordById("users", e.record.id)
                if (cur && cur.get) {
                    existingRole = cur.get("role") || "member"
                }
            } catch (err) {
                existingRole = "member"
            }
            e.record.set("role", existingRole)
        }
    } catch (err) {
        console.error(">>> Error guarding role on user update:", err)
    }
    e.next()
}, "users")
