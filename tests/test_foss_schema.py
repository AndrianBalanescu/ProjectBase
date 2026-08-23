"""FOSS schema guard tests.

ProjectBase is 100% free and open-source (MIT). The strict FOSS rule forbids
paid plans, Pro tiers, Stripe billing, payment gates, and hosted cloud
waitlists in the schema. This suite verifies:

- migration 1710000010 strips orphaned monetization drift (`orders`, `leads`,
  `users.plan`) from a database that carries it (e.g. older demo DBs that ran
  the uncommitted `1710000007_leads_and_billing.js`);
- a fresh install from the repo migrations contains no monetization
  collections/fields (regression guard if one is ever re-added).

Uses only the stdlib + the local pocketbase binary, like the rest of the suite.
"""

import json
import os
import subprocess
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PB_BIN = os.path.join(REPO, "pocketbase")
MIGRATIONS = os.path.join(REPO, "app", "pb_migrations")

FORBIDDEN_COLLECTIONS = ("orders", "leads", "payments", "subscriptions", "invoices", "plans")
FORBIDDEN_USER_FIELDS = ("plan", "tier", "billing", "stripe")


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True,
                          timeout=kw.pop("timeout", 180), **kw)


def _db_collections(db_path):
    """Return {collection_name: [field names]} from a PocketBase data.db."""
    import sqlite3
    con = sqlite3.connect(db_path)
    out = {}
    try:
        for name in ("_collections",):
            rows = con.execute(f"SELECT name, fields FROM {name}").fetchall()
        for cname, fields_json in rows:
            try:
                fields = json.loads(fields_json)
                out[cname] = [f.get("name") for f in fields]
            except Exception:
                out[cname] = []
    finally:
        con.close()
    return out


def _migrate_up(db_dir, migs_dir):
    """Run `pocketbase migrate up` against a scratch data dir."""
    res = run([PB_BIN, "migrate", "up", "--dir", db_dir, "--migrationsDir", migs_dir])
    assert res.returncode == 0, f"migrate up failed:\n{res.stdout}\n{res.stderr}"
    return res


def test_migration_strips_monetization_drift():
    """Simulate the orphaned drift, then verify migration 10 removes it."""
    with tempfile.TemporaryDirectory(prefix="pb-foss-strip-") as tmp:
        # Stage 1: a drift-sim migration that runs BEFORE migration 10,
        # recreating what the uncommitted 1710000007_leads_and_billing.js did.
        migs = os.path.join(tmp, "migs")
        os.makedirs(migs)
        for f in sorted(os.listdir(MIGRATIONS)):
            if f.endswith(".js"):
                with open(os.path.join(MIGRATIONS, f)) as src:
                    # exclude migration 10 so we can inject drift first
                    if "1710000010" not in f:
                        with open(os.path.join(migs, f), "w") as dst:
                            dst.write(src.read())
        drift_sim = os.path.join(migs, "1710000009_9_simulate_drift.js")
        with open(drift_sim, "w") as f:
            f.write('''
migrate((app) => {
    const mkCol = (name) => {
        try { app.findCollectionByNameOrId(name); return } catch (e) {}
        const col = new Collection({ name, type: "base", listRule: null, viewRule: null, createRule: "", updateRule: null, deleteRule: null })
        col.fields.add(new TextField({ name: "email" }))
        if (name === "orders") {
            col.fields.add(new TextField({ name: "stripe_session_id" }))
            col.fields.add(new TextField({ name: "amount_cents" }))
        }
        app.save(col)
    }
    mkCol("orders")
    mkCol("leads")
    try {
        const users = app.findCollectionByNameOrId("users")
        let planField = null
        try { planField = users.fields.getByName("plan") } catch (e) {}
        if (!planField) { users.fields.add(new TextField({ name: "plan" })); app.save(users) }
    } catch (e) {}
})
''')
        db_dir = os.path.join(tmp, "pb_data")
        _migrate_up(db_dir, migs)
        db_path = os.path.join(db_dir, "data.db")
        cols = _db_collections(db_path)
        assert "orders" in cols and "leads" in cols, "drift-sim should have created drift"
        assert "plan" in cols.get("users", []), "drift-sim should have added users.plan"

        # Stage 2: apply the real migration 10 to strip the drift.
        _migrate_up(db_dir, MIGRATIONS)
        cols = _db_collections(db_path)
        for forbidden in FORBIDDEN_COLLECTIONS:
            assert forbidden not in cols, f"{forbidden} should have been stripped"
        user_fields = set(cols.get("users", []))
        for fname in FORBIDDEN_USER_FIELDS:
            assert fname not in user_fields, f"users.{fname} should have been stripped"
        # Core collections must survive.
        for core in ("users", "projects", "issues", "cycles", "comments"):
            assert core in cols, f"core collection {core} must survive"


def test_fresh_install_has_no_monetization_schema():
    """A fresh install from repo migrations contains no forbidden schema."""
    with tempfile.TemporaryDirectory(prefix="pb-foss-fresh-") as tmp:
        db_dir = os.path.join(tmp, "pb_data")
        _migrate_up(db_dir, MIGRATIONS)
        cols = _db_collections(os.path.join(db_dir, "data.db"))
        for forbidden in FORBIDDEN_COLLECTIONS:
            assert forbidden not in cols, f"fresh install must not contain {forbidden}"
        user_fields = set(cols.get("users", []))
        for fname in FORBIDDEN_USER_FIELDS:
            assert fname not in user_fields, f"fresh users must not have a {fname} field"
        for core in ("users", "projects", "issues", "cycles", "milestones", "labels", "comments", "activity"):
            assert core in cols, f"fresh install missing core collection {core}"
