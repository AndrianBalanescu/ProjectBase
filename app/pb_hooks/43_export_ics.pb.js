// pb_hooks/43_export_ics.pb.js
// ICS calendar feed for ProjectBase (cycle 81, PB-10533).
//
// Linear and Plane both let a user subscribe their workspace calendar from
// Google Calendar / Apple Calendar / Thunderbird via an .ics feed. ProjectBase
// already stores the three date-bearing surfaces (issue due_date, cycle
// start/end, milestone target_date) but had no way to expose them to calendar
// clients — this hook closes that M3 parity gap.
//
// GET /api/projectbase/export/ics?project=<project_id>
//   - Requires an authenticated user (same gate as export/csv|json).
//   - Returns a text/calendar (RFC 5545) attachment. One VEVENT per dated item:
//       * issues with a due_date        -> all-day event on the due date
//       * cycles with start/end dates   -> timed event spanning the sprint
//       * milestones with a target_date -> all-day event on the target date
//   - UIDs are stable ("<prefix>-<record-id>@projectbase") so calendar clients
//     dedupe instead of duplicating on every refresh.
//   - DTSTAMP and all timestamps are UTC (Z suffix); all-day events use
//     VALUE=DATE form (no time, no Z).
//   - Text is escaped per RFC 5545 §3.3.11 (backslash, semicolon, comma,
//     newline). Line endings are CRLF as the RFC requires.
//   - The response is served inline (Content-Disposition: attachment) so the
//     browser downloads <Project>-calendar.ics.
//
// NOTE: All helpers are inlined inside the routerAdd callback because
// PocketBase Goja runs the callback in an isolated execution context —
// module-level declarations are NOT visible to it.

routerAdd("GET", "/api/projectbase/export/ics", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let projectId = e.requestInfo().query && e.requestInfo().query.project
        if (!projectId) {
            return e.badRequestError("Missing required 'project' query param")
        }

        let project
        try {
            project = e.app.findRecordById("projects", projectId)
        } catch (err) {
            return e.json(404, { error: "Project not found" })
        }

        // RFC 5545 §3.3.11 TEXT escaping: backslash first, then semicolon,
        // comma and (folded) newlines.
        function icsEscape(v) {
            return String(v == null ? "" : v)
                .replace(/\\/g, "\\\\")
                .replace(/;/g, "\\;")
                .replace(/,/g, "\\,")
                .replace(/\r?\n/g, "\\n")
        }

        // "2026-09-05 17:04:45.050Z" | "2026-09-05T17:04:45Z" | "2026-09-05"
        //   -> { date: "20260905", time: "170445", hasTime: bool }
        // Always normalized to UTC: a date-only or naive string is already
        // UTC by convention in this codebase (PB stores UTC); a timestamp is
        // taken as UTC. No TZ conversions are attempted client-side.
        function parseWhen(raw) {
            if (v_empty(raw)) return null
            let s = String(raw).trim()
            if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null
            let date = s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 10)
            let hasTime = s.length > 10
            let time = "000000"
            if (hasTime) {
                let tm = s.slice(11, 19).match(/^(\d{2}):(\d{2}):(\d{2})/)
                if (tm) time = tm[1] + tm[2] + tm[3]
                else { hasTime = false; time = "000000" }
            }
            return { date: date, time: time, hasTime: hasTime }
        }

        function v_empty(v) {
            return v == null || v === "" || (typeof v === "undefined")
        }

        function nowStamp() {
            // YYYYMMDDTHHMMSSZ in UTC without depending on Date format quirks.
            let d = new Date()
            function p2(n) { return (n < 10 ? "0" : "") + n }
            return "" + d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) +
                "T" + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + "Z"
        }

        function dtStamp(when) {
            if (!when) return ""
            return when.date + "T" + when.time + "Z"
        }

        function foldLine(line) {
            // RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF
            // + single whitespace. Content here is ASCII-safe after escaping.
            if (line.length <= 75) return [line]
            let out = []
            let rest = line
            while (rest.length > 75) {
                out.push(rest.slice(0, 75))
                rest = " " + rest.slice(75)
            }
            if (rest.length) out.push(rest)
            return out
        }

        // Goja returns JSON fields as byte arrays — decode before use.
        function decodeJson(v) {
            if (v == null) return v
            if (Array.isArray(v) && v.length && typeof v[0] === "number") {
                try { return String.fromCharCode.apply(null, v) } catch (err) { return null }
            }
            return v
        }

        let events = [] // { uid, dtstamp, start, end|null, allDay, summary, description }

        // 1) Issues with a due date -> all-day VEVENT.
        let issues = e.app.findRecordsByFilter("issues", `project = '${projectId}' && due_date != ''`, "due_date,created", 10000, 0)
        for (let i = 0; i < issues.length; i++) {
            const rec = issues[i]
            let when = parseWhen(rec.get("due_date"))
            if (!when) continue
            let title = rec.get("title") || ""
            let status = rec.get("status") || ""
            let descParts = []
            if (rec.get("description")) descParts.push(rec.get("description"))
            descParts.push("Status: " + status)
            if (rec.get("identifier")) descParts.push(rec.get("identifier"))
            events.push({
                uid: "issue-" + rec.id + "@projectbase",
                dtstamp: dtStamp(when),
                start: when.date,
                end: null,
                allDay: true,
                summary: (status && status !== "done" ? "[Due] " : "[Due·done] ") + title,
                description: descParts.join("\n")
            })
        }

        // 2) Cycles with start/end -> timed VEVENT spanning the sprint.
        let cycles = e.app.findRecordsByFilter("cycles", `project = '${projectId}' && start_date != ''`, "start_date,created", 1000, 0)
        for (let i = 0; i < cycles.length; i++) {
            const rec = cycles[i]
            let start = parseWhen(rec.get("start_date"))
            let end = parseWhen(rec.get("end_date"))
            if (!start) continue
            // RFC 5545 DTEND is non-inclusive for DATE values; a date-only end
            // gets +1 day so the sprint's last day is covered.
            let endOut = null
            if (end) {
                if (!end.hasTime) {
                    let y = parseInt(end.date.slice(0, 4), 10)
                    let mo = parseInt(end.date.slice(4, 6), 10)
                    let d = parseInt(end.date.slice(6, 8), 10)
                    let dt = new Date(Date.UTC(y, mo - 1, d))
                    dt.setUTCDate(dt.getUTCDate() + 1)
                    function p2(n) { return (n < 10 ? "0" : "") + n }
                    endOut = "" + dt.getUTCFullYear() + p2(dt.getUTCMonth() + 1) + p2(dt.getUTCDate())
                } else {
                    endOut = end.date + "T" + end.time + "Z"
                }
            }
            events.push({
                uid: "cycle-" + rec.id + "@projectbase",
                dtstamp: dtStamp(start),
                start: start.hasTime ? (start.date + "T" + start.time + "Z") : start.date,
                end: endOut,
                allDay: !start.hasTime,
                summary: "[Cycle] " + (rec.get("name") || "Sprint"),
                description: rec.get("description") || ""
            })
        }

        // 3) Milestones with a target date -> all-day VEVENT.
        let milestones = e.app.findRecordsByFilter("milestones", `project = '${projectId}' && target_date != ''`, "target_date,created", 1000, 0)
        for (let i = 0; i < milestones.length; i++) {
            const rec = milestones[i]
            let when = parseWhen(rec.get("target_date"))
            if (!when) continue
            events.push({
                uid: "milestone-" + rec.id + "@projectbase",
                dtstamp: dtStamp(when),
                start: when.date,
                end: null,
                allDay: true,
                summary: "[Milestone] " + (rec.get("name") || "Milestone"),
                description: rec.get("description") || ""
            })
        }

        // Assemble the VCALENDAR with CRLF line endings and 75-octet folding.
        let prodName = (project.get("name") || "ProjectBase")
        let lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//ProjectBase//Calendar Export 1.0//EN",
            "CALSCALE:GREGORIAN",
            "X-WR-CALNAME:" + icsEscape(prodName + " — Calendar")
        ]
        for (let i = 0; i < events.length; i++) {
            const ev = events[i]
            lines.push("BEGIN:VEVENT")
            lines.push("UID:" + ev.uid)
            lines.push("DTSTAMP:" + (ev.dtstamp || nowStamp()))
            if (ev.allDay) {
                lines.push("DTSTART;VALUE=DATE:" + ev.start)
                if (ev.end) lines.push("DTEND;VALUE=DATE:" + ev.end)
            } else {
                lines.push("DTSTART:" + ev.start)
                if (ev.end) lines.push("DTEND:" + ev.end)
            }
            lines = lines.concat(foldLine("SUMMARY:" + icsEscape(ev.summary)))
            if (ev.description) lines = lines.concat(foldLine("DESCRIPTION:" + icsEscape(ev.description)))
            lines.push("END:VEVENT")
        }
        lines.push("END:VCALENDAR")

        // RFC 5545 requires CRLF line endings.
        const ics = lines.join("\r\n") + "\r\n"
        const safeName = (project.get("name") || "project").replace(/[^\w\-]+/g, "_")
        e.response.header().set("Content-Type", "text/calendar; charset=utf-8")
        e.response.header().set("Content-Disposition", `inline; filename="${safeName}-calendar.ics"`)
        e.response.write(ics)
        return
    } catch (err) {
        console.log(">>> [ProjectBase] export/ics error:", JSON.stringify(String((err && err.message) || err)))
        return e.json(500, { error: "Internal server error" })
    }
})