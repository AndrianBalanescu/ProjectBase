"""Regression tests for the public, upgrade-safe ProjectBase seed."""

import shutil
import sqlite3
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POCKETBASE = ROOT / "pocketbase"
MIGRATIONS = ROOT / "app" / "pb_migrations"
LATEST_SEED = "1710000055_public_demo_seed.js"
PERSONAL_CATALOG = ("LoadETA", "iBrowse", "OmniRoute", "Memrize", "Homelab")


def _migrate(data_dir: Path, migrations_dir: Path) -> None:
    result = subprocess.run(
        [str(POCKETBASE), "migrate", "up", "--dir", str(data_dir),
         "--migrationsDir", str(migrations_dir)],
        cwd=ROOT, capture_output=True, text=True, timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def _database(data_dir: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(data_dir / "data.db")
    connection.row_factory = sqlite3.Row
    return connection


def test_fresh_install_has_only_generic_minimal_product_seed(tmp_path):
    data_dir = tmp_path / "fresh-data"
    _migrate(data_dir, MIGRATIONS)
    with _database(data_dir) as db:
        projects = db.execute(
            "SELECT id, name, identifier, lead, repo_url FROM projects"
        ).fetchall()
        issues = db.execute(
            "SELECT identifier, title FROM issues ORDER BY issue_number"
        ).fetchall()

    assert [dict(row) for row in projects] == [{
        "id": projects[0]["id"], "name": "ProjectBase Demo",
        "identifier": "PB", "lead": "ProjectBase", "repo_url": "",
    }]
    assert [dict(row) for row in issues] == [
        {"identifier": "PB-1", "title": "Explore the project board"},
        {"identifier": "PB-2", "title": "Plan the first cycle"},
        {"identifier": "PB-3", "title": "Define a product milestone"},
    ]
    sources = "\n".join(path.read_text() for path in MIGRATIONS.glob("*.js"))
    assert not any(name.casefold() in sources.casefold() for name in PERSONAL_CATALOG)


def test_seed_never_changes_existing_project_or_related_data(tmp_path):
    prior = tmp_path / "prior-migrations"
    prior.mkdir()
    for migration in MIGRATIONS.glob("*.js"):
        if migration.name != LATEST_SEED:
            shutil.copy2(migration, prior / migration.name)

    data_dir = tmp_path / "upgrade-data"
    _migrate(data_dir, prior)
    with _database(data_dir) as db:
        db.execute(
            "INSERT INTO projects (id,name,identifier,description,lead,repo_url) "
            "VALUES (?,?,?,?,?,?)",
            ("userproject0001", "User workspace", "USR", "changed description",
             "Owner", "https://example.invalid/user"),
        )
        db.commit()

    _migrate(data_dir, MIGRATIONS)
    with _database(data_dir) as db:
        row = db.execute(
            "SELECT name,identifier,description,lead,repo_url FROM projects "
            "WHERE id='userproject0001'"
        ).fetchone()
        count = db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]

    assert dict(row) == {
        "name": "User workspace", "identifier": "USR",
        "description": "changed description", "lead": "Owner",
        "repo_url": "https://example.invalid/user",
    }
    assert count == 1


def test_public_seed_is_strictly_additive():
    source = (MIGRATIONS / LATEST_SEED).read_text().casefold()
    assert "app.delete" not in source
    assert "delete from" not in source
    assert "existing.length > 0" in source
