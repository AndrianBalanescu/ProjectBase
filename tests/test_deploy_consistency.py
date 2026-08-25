"""tests/test_deploy_consistency.py — guard against self-hosting drift.

The project's documented North Star priority #1 is "full self-hosting Docker /
Docker Compose / Caddy deployment". AGENTS.md explicitly warns about the
classic PocketBase data-dir trap: the local run uses `--dir pb_data` at the
repo root while the containerized stack serves `--dir /app/app/pb_data`
(i.e. `app/pb_data`). Keeping both consistent is a recurring footgun.

These tests lock the four deploy surfaces — `Dockerfile`,
`docker-compose.yml`, `deploy/projectbase.service` (systemd template),
`scripts/start.sh`, `Makefile`, and `deploy/Caddyfile` — to the SAME public
dir, hooks dir, migrations dir, data dir, and listen port. If someone edits a
Dockerfile mount to a different data dir than the systemd unit, or bumps the
port in one surface but not the Caddyfile/CI, these tests fail at CI time
instead of shipping a demo that boots into a stale/empty database or points a
reverse proxy at the wrong port.

These are pure static checks (no server spawn), mirroring the drift-guard
style of `tests/test_css_sync.py`.
"""

import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(rel):
    with open(os.path.join(ROOT, rel), "r", encoding="utf-8") as fh:
        return fh.read()


DOCKERFILE = _read("Dockerfile")
COMPOSE = _read("docker-compose.yml")
MAKEFILE = _read("Makefile")
START_SH = _read("scripts/start.sh")
SERVICE = _read("deploy/projectbase.service")
CADDYFILE = _read("deploy/Caddyfile")

# The canonical relative data dir the containerized + systemd stacks must serve.
DATA_DIR = "pb_data"
PUBLIC_DIR = "pb_public"
HOOKS_DIR = "pb_hooks"
MIGRATIONS_DIR = "pb_migrations"
PORT = "8120"


class TestDeployConsistency(unittest.TestCase):
    """Static consistency checks across all self-hosting surfaces."""

    def test_dockerfile_serves_app_pb_data(self):
        # The container's data dir is `/app/app/pb_data` (per Dockerfile CMD).
        # Compose must mount the SAME container path, or a fresh container
        # writes into an anonymous volume while the host bind is ignored.
        self.assertIn('--dir", "/app/app/pb_data"', DOCKERFILE)
        self.assertIn("/app/app/pb_data", DOCKERFILE)

    def test_dockerfile_serves_app_public_hooks_migrations(self):
        self.assertIn('/app/app/pb_public', DOCKERFILE)
        self.assertIn('/app/app/pb_hooks', DOCKERFILE)
        self.assertIn('/app/app/pb_migrations', DOCKERFILE)

    def test_compose_mounts_container_paths_under_app(self):
        # Host side: ./app/pb_* -> container side /app/app/pb_*.
        for sub in (DATA_DIR, PUBLIC_DIR, HOOKS_DIR, MIGRATIONS_DIR):
            self.assertIn(f"./app/{sub}:/app/app/{sub}", COMPOSE,
                          f"compose must mount ./app/{sub} -> /app/app/{sub}")

    def test_start_sh_serves_app_data_dir_from_app_cwd(self):
        # start.sh `cd "$DIR/app"` then `--dir pb_data` == app/pb_data.
        self.assertIn('cd "$DIR/app"', START_SH)
        self.assertIn("--dir pb_data", START_SH)
        self.assertIn("--publicDir pb_public", START_SH)
        self.assertIn("--hooksDir pb_hooks", START_SH)
        self.assertIn("--migrationsDir pb_migrations", START_SH)

    def test_makefile_dev_serves_app_data_dir(self):
        self.assertIn("--dir ./app/pb_data", MAKEFILE)
        self.assertIn("--publicDir ./app/pb_public", MAKEFILE)
        self.assertIn("--hooksDir ./app/pb_hooks", MAKEFILE)
        self.assertIn("--migrationsDir ./app/pb_migrations", MAKEFILE)

    def test_systemd_unit_serves_data_dir_relative_to_appdir(self):
        # systemd WorkingDirectory=__APP_DIR__ and ExecStart --dir pb_data,
        # i.e. the data dir is $APP_DIR/pb_data. ReadWritePaths must allow it.
        self.assertIn("WorkingDirectory=__APP_DIR__", SERVICE)
        self.assertIn("--dir pb_data", SERVICE)
        self.assertIn("--publicDir pb_public", SERVICE)
        self.assertIn("--hooksDir pb_hooks", SERVICE)
        self.assertIn("--migrationsDir pb_migrations", SERVICE)
        self.assertIn("ReadWritePaths=__APP_DIR__/pb_data", SERVICE)
        self.assertIn("__APP_DIR__/pb_migrations", SERVICE)

    def test_caddy_proxies_to_container_port(self):
        # Caddy reverse_proxy target must match the container listen port.
        self.assertIn(f"reverse_proxy projectbase:{PORT}", CADDYFILE)

    def test_containers_listen_on_same_port(self):
        self.assertIn(f"EXPOSE {PORT}", DOCKERFILE)
        self.assertIn(f"0.0.0.0:{PORT}", DOCKERFILE)  # CMD --http
        self.assertIn("PROJECTBASE_PORT:-8120}:8120", COMPOSE)
        self.assertIn("PROJECTBASE_PORT=8120", COMPOSE)

    def test_host_port_default_consistent_across_surfaces(self):
        self.assertIn("PROJECTBASE_PORT:-8120", START_SH)
        self.assertIn("PROJECTBASE_PORT:-8120", COMPOSE)


if __name__ == "__main__":
    unittest.main()
