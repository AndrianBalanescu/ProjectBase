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

## 🐣 First Boot (fresh deployments)

On a brand-new data directory, the container/systemd entrypoint applies the
schema migrations once, restarts the server, and then serves normally
(`scripts/serve-firstboot.sh`). This works around a PocketBase 0.39.x quirk
where the very first boot's records API cannot see rows created by migrations
until the process restarts. Existing data dirs are unaffected and boot
straight through.

## 📄 License

MIT © [Andrian Balanescu](https://github.com/AndrianBalanescu)
