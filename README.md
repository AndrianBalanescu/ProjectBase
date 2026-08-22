# ⚡ ProjectBase

> **Ultra-lightweight, high-performance Plane & Linear alternative for multi-project management and real-time Kanban.**

Built with **PocketBase** (Go + SQLite) and a **Zero-Build Vue 3 + Tailwind CSS** frontend.

---

## 🚀 Highlights

- **⚡ Ultra-Low Footprint**: Consumes only **~15 MB RAM** (vs 2,730 MB on Plane). Single binary, zero Docker microservice madness.
- **✨ Zero-Build Frontend**: Vanilla Vue 3 + Tailwind CSS served directly from `pb_public/`. Instant edits, zero Node.js build step.
- **🔄 Real-Time SSE**: Built-in Server-Sent Events subscription for zero-latency concurrent synchronization across browser tabs and AI agents.
- **📋 Multi-Project & Sprints**: Support for multiple repositories/projects, Sprint Cycles with burndown tracking, Milestones, and customizable labels.
- **🎯 Full Kanban & List Views**: Fluid drag-and-drop card movements powered by SortableJS, inline quick add, keyboard shortcuts (`C` for new task, `⌘K` for Omnibar, `1-5` for view switching).
- **🤖 AI Agent First**: Full REST API + FastMCP integration for Cursor, Flomaster, Claude, and Hermes agents with automatic identifier generation (`PB-1`, `HOME-2`).

---

## 🛠️ Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   Zero-Build Vue 3 UI                  │
│       Tailwind CSS • SortableJS • Lucide • Marked      │
└───────────────────────────┬────────────────────────────┘
                            │ SSE & REST (HTTP :8120)
┌───────────────────────────▼────────────────────────────┐
│                    PocketBase Core                     │
│       Auto-Migrations • JS Hooks • Superuser Auth      │
├────────────────────────────────────────────────────────┤
│                     SQLite Database                    │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Quick Start

### 1. Run Server
```bash
./scripts/start.sh
```

### 2. Access Web UI
Open [http://localhost:8120](http://localhost:8120) or [http://100.70.158.21:8120](http://100.70.158.21:8120) on Tailscale.

### 3. PocketBase Admin
Open [http://localhost:8120/_/](http://localhost:8120/_/)
- Email: `admin@projectbase.local`
- Password: `projectbase123456`

---

## 🤖 AI Agent MCP Integration

Add to `~/.cursor/mcp.json` or `~/.flomaster/config.json`:

```json
{
  "mcpServers": {
    "projectbase": {
      "command": "python3",
      "args": ["/home/ubuntu/projects/projectbase/scripts/mcp_server.py"],
      "env": {
        "PROJECTBASE_URL": "http://100.70.158.21:8120"
      }
    }
  }
}
```

---

## 📄 License
MIT
