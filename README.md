# ⚡ ProjectBase

**The ultra-lightweight, high-performance Plane & Linear alternative for multi-project Kanban, sprint cycles, and autonomous AI agent workflows.**

*Runs on ~50 MB RAM • Single Binary • Zero Build Step • Real-time SSE • Instant SQLite*

## 🚀 Key Features

- **⚡ Ultra-Low Footprint**: ~50 MB RAM idle in production (vs 2,700 MB on Plane CE). Cold starts in 36-96 ms.
- **✨ Zero-Build Frontend**: Vanilla Vue 3 UMD + Tailwind CSS served straight from `app/pb_public/`. No `node_modules`.
- **📋 Multi-Project & Sprints**: Manage multiple repos/domains, timeboxed Sprint Cycles, burndown, custom labels.
- **🎯 Fluid Kanban & List Views**: Drag-and-drop via SortableJS with real-time SSE sync.
- **📝 Markdown Drawer & Subtasks**: Full markdown descriptions, subtasks, custom fields.
- **🤖 AI Agent Ready**: FastMCP server + custom API for autonomous agent dispatch.

## 🛡️ 100% Free & Open Source

Free and open source.

## 🚀 Quick Start

**Run the binary directly** (Linux/macOS, no dependencies):

```bash
git clone https://github.com/AndrianBalanescu/ProjectBase
cd ProjectBase
./scripts/install.sh                      # downloads the PocketBase 0.39.11 binary
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='use-a-long-random-password' ./scripts/bootstrap.sh
# → http://localhost:8120
```

**Or with Docker:**

```bash
docker compose up -d                      # builds the image, serves on :8120
# data persists in ./app/pb_data
```

**Or with Docker + automatic HTTPS** (for a public demo domain):

```bash
./scripts/deploy-demo.sh --domain demo.example.com --email you@example.com --password 'use-a-long-random-password'
```

Then sign in at `http://localhost:8120` with the credentials you set. For the
AI-agent surface, point any MCP client at `scripts/mcp_server.py` (FastMCP:
`list_projects`, `create_issue`, `move_issue`, `add_comment`, ...).

## 🛠️ Make targets & tests

| Command | What it does |
|---|---|
| `make start` | Run the server locally on :8120 |
| `make test` | Full pytest suite (unit + static drift guards) |
| `make docker-build` / `make docker-up` | Build and run the container stack |
| `./scripts/build_css.sh` | Recompile Tailwind CSS after editing templates |
| `python3 scripts/bench/bench.py` | Reproducible cold-start / RAM / query benchmark |

## 🐣 First Boot (fresh deployments)

On a brand-new data directory, the container/systemd entrypoint applies the
schema migrations once, restarts the server, and then serves normally
(`scripts/serve-firstboot.sh`). This works around a PocketBase 0.39.x quirk
where the very first boot's records API cannot see rows created by migrations
until the process restarts. Existing data dirs are unaffected and boot
straight through.

## 📄 License

MIT © [Andrian Balanescu](https://github.com/AndrianBalanescu)
