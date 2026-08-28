// ProjectBase Hook 115 — Autonomous Multi-Agent Incident Response, Live Debugging War-Room & Root-Cause Post-Mortem Engine (Milestone 10 / Epic 31).
//
// Exposes high-performance REST APIs and real-time coordination endpoints for incident triage,
// multi-agent collaborative live debugging, hypothesis falsification, mitigation action tracking,
// and automated 5-Whys post-mortem generation.

// 1. GET /api/projectbase/incidents
routerAdd("GET", "/api/projectbase/incidents", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const status = query.status || "";
        const severity = query.severity || "";
        const projectId = query.project_id || "";
        const search = query.search || "";
        const limit = parseInt(query.limit || "100", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [];
        if (status) filterParts.push(`status = '${status}'`);
        if (severity) filterParts.push(`severity = '${severity}'`);
        if (projectId) filterParts.push(`project_id = '${projectId}'`);
        if (search) filterParts.push(`(title ~ '${search}' || summary ~ '${search}' || service_name ~ '${search}')`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "incidents",
            filterExpr || "id != ''",
            "-created",
            limit,
            offset
        );

        const items = records.map(r => ({
            id: r.id,
            title: r.getString("title"),
            slug: r.getString("slug"),
            summary: r.getString("summary"),
            project_id: r.getString("project_id"),
            severity: r.getString("severity") || "p2_medium",
            status: r.getString("status") || "declared",
            incident_commander: r.getString("incident_commander"),
            lead_investigator: r.getString("lead_investigator"),
            source: r.getString("source") || "manual",
            impact_scope: r.getString("impact_scope"),
            service_name: r.getString("service_name"),
            started_at: r.getString("started_at"),
            detected_at: r.getString("detected_at"),
            mitigated_at: r.getString("mitigated_at"),
            resolved_at: r.getString("resolved_at"),
            mcp_session_id: r.getString("mcp_session_id"),
            sandbox_id: r.getString("sandbox_id"),
            tags: r.get("tags_json") || [],
            metadata: r.get("metadata_json") || {},
            postmortem_id: r.getString("postmortem_id"),
            created: r.getString("created"),
            updated: r.getString("updated")
        }));

        return e.json(200, { success: true, count: items.length, data: items });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 2. POST /api/projectbase/incidents
routerAdd("POST", "/api/projectbase/incidents", (e) => {
    try {
        const body = e.requestInfo().body || {};
        const title = (body.title || "").trim();
        if (!title) {
            return e.json(400, { success: false, error: "Missing required field: title" });
        }

        const col = e.app.findCollectionByNameOrId("incidents");
        const record = new Record(col);

        const slug = (body.slug || ("inc-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6))).toLowerCase();
        const nowIso = new Date().toISOString();

        record.set("title", title);
        record.set("slug", slug);
        record.set("summary", body.summary || "");
        record.set("project_id", body.project_id || "");
        record.set("severity", body.severity || "p2_medium");
        record.set("status", body.status || "declared");
        record.set("incident_commander", body.incident_commander || "Flomaster-Commander");
        record.set("lead_investigator", body.lead_investigator || "");
        record.set("source", body.source || "manual");
        record.set("impact_scope", body.impact_scope || "");
        record.set("service_name", body.service_name || "core");
        record.set("started_at", body.started_at || nowIso);
        record.set("detected_at", body.detected_at || nowIso);
        record.set("mitigated_at", body.mitigated_at || "");
        record.set("resolved_at", body.resolved_at || "");
        record.set("mcp_session_id", body.mcp_session_id || "");
        record.set("sandbox_id", body.sandbox_id || "");
        record.set("tags_json", body.tags || []);
        record.set("metadata_json", body.metadata || {});
        record.set("postmortem_id", "");

        e.app.save(record);

        // Auto create initial declaration event in timeline
        try {
            const evCol = e.app.findCollectionByNameOrId("incident_events");
            const evRec = new Record(evCol);
            evRec.set("incident_id", record.id);
            evRec.set("event_type", "status_change");
            evRec.set("author", body.incident_commander || "Flomaster-Commander");
            evRec.set("author_type", "agent");
            evRec.set("title", `Incident Declared: ${record.getString("severity").toUpperCase()} - ${record.getString("title")}`);
            evRec.set("content", body.summary || "Incident declared and war-room initialized.");
            evRec.set("payload_json", { status: record.getString("status"), severity: record.getString("severity") });
            evRec.set("severity", record.getString("severity") === "p0_critical" ? "critical" : "warning");
            evRec.set("timestamp", nowIso);
            e.app.save(evRec);
        } catch (evErr) {}

        return e.json(201, {
            success: true,
            data: {
                id: record.id,
                title: record.getString("title"),
                slug: record.getString("slug"),
                severity: record.getString("severity"),
                status: record.getString("status"),
                incident_commander: record.getString("incident_commander"),
                created: record.getString("created")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 3. GET /api/projectbase/incidents/{id}
routerAdd("GET", "/api/projectbase/incidents/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        let incident = null;
        try {
            incident = e.app.findRecordById("incidents", id);
        } catch (x) {
            try {
                incident = e.app.findFirstRecordByData("incidents", "slug", id);
            } catch (x2) {
                return e.json(404, { success: false, error: "Incident not found" });
            }
        }

        let events = [];
        try {
            events = e.app.findRecordsByFilter("incident_events", `incident_id = '${incident.id}'`, "+timestamp", 200, 0).map(ev => ({
                id: ev.id,
                incident_id: ev.getString("incident_id"),
                event_type: ev.getString("event_type"),
                author: ev.getString("author"),
                author_type: ev.getString("author_type"),
                title: ev.getString("title"),
                content: ev.getString("content"),
                payload: ev.get("payload_json") || {},
                severity: ev.getString("severity"),
                timestamp: ev.getString("timestamp")
            }));
        } catch (x) {}

        let hypotheses = [];
        try {
            hypotheses = e.app.findRecordsByFilter("incident_hypotheses", `incident_id = '${incident.id}'`, "-confidence_score", 100, 0).map(h => ({
                id: h.id,
                incident_id: h.getString("incident_id"),
                proposed_by: h.getString("proposed_by"),
                hypothesis: h.getString("hypothesis"),
                rationale: h.getString("rationale"),
                status: h.getString("status"),
                test_plan: h.getString("test_plan"),
                evidence: h.getString("evidence"),
                confidence_score: h.getFloat("confidence_score") || 0,
                tested_by: h.getString("tested_by"),
                tested_at: h.getString("tested_at"),
                artifact_url: h.getString("artifact_url")
            }));
        } catch (x) {}

        let mitigations = [];
        try {
            mitigations = e.app.findRecordsByFilter("incident_mitigations", `incident_id = '${incident.id}'`, "-created", 100, 0).map(m => ({
                id: m.id,
                incident_id: m.getString("incident_id"),
                title: m.getString("title"),
                description: m.getString("description"),
                action_type: m.getString("action_type"),
                status: m.getString("status"),
                executed_by: m.getString("executed_by"),
                executed_at: m.getString("executed_at"),
                verification_method: m.getString("verification_method"),
                verification_result: m.getString("verification_result"),
                rollback_plan: m.getString("rollback_plan")
            }));
        } catch (x) {}

        let postmortem = null;
        try {
            const pmRec = e.app.findFirstRecordByData("incident_postmortems", "incident_id", incident.id);
            if (pmRec) {
                postmortem = {
                    id: pmRec.id,
                    incident_id: pmRec.getString("incident_id"),
                    title: pmRec.getString("title"),
                    slug: pmRec.getString("slug"),
                    status: pmRec.getString("status"),
                    executive_summary: pmRec.getString("executive_summary"),
                    root_cause_analysis: pmRec.getString("root_cause_analysis"),
                    contributing_factors: pmRec.get("contributing_factors_json") || [],
                    impact_metrics: pmRec.get("impact_metrics_json") || {},
                    timeline_summary: pmRec.getString("timeline_summary"),
                    detection_gap: pmRec.getString("detection_gap"),
                    action_items: pmRec.get("action_items_json") || [],
                    lessons_learned: pmRec.getString("lessons_learned"),
                    author: pmRec.getString("author"),
                    published_at: pmRec.getString("published_at")
                };
            }
        } catch (x) {}

        return e.json(200, {
            success: true,
            data: {
                id: incident.id,
                title: incident.getString("title"),
                slug: incident.getString("slug"),
                summary: incident.getString("summary"),
                project_id: incident.getString("project_id"),
                severity: incident.getString("severity"),
                status: incident.getString("status"),
                incident_commander: incident.getString("incident_commander"),
                lead_investigator: incident.getString("lead_investigator"),
                source: incident.getString("source"),
                impact_scope: incident.getString("impact_scope"),
                service_name: incident.getString("service_name"),
                started_at: incident.getString("started_at"),
                detected_at: incident.getString("detected_at"),
                mitigated_at: incident.getString("mitigated_at"),
                resolved_at: incident.getString("resolved_at"),
                mcp_session_id: incident.getString("mcp_session_id"),
                sandbox_id: incident.getString("sandbox_id"),
                tags: incident.get("tags_json") || [],
                metadata: incident.get("metadata_json") || {},
                postmortem_id: incident.getString("postmortem_id"),
                created: incident.getString("created"),
                updated: incident.getString("updated"),
                events: events,
                hypotheses: hypotheses,
                mitigations: mitigations,
                postmortem: postmortem
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 4. PATCH /api/projectbase/incidents/{id}
routerAdd("PATCH", "/api/projectbase/incidents/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const incident = e.app.findRecordById("incidents", id);

        if (body.title !== undefined) incident.set("title", (body.title || "").trim());
        if (body.summary !== undefined) incident.set("summary", body.summary);
        if (body.severity !== undefined) incident.set("severity", body.severity);
        if (body.status !== undefined) incident.set("status", body.status);
        if (body.incident_commander !== undefined) incident.set("incident_commander", body.incident_commander);
        if (body.lead_investigator !== undefined) incident.set("lead_investigator", body.lead_investigator);
        if (body.impact_scope !== undefined) incident.set("impact_scope", body.impact_scope);
        if (body.service_name !== undefined) incident.set("service_name", body.service_name);
        if (body.mcp_session_id !== undefined) incident.set("mcp_session_id", body.mcp_session_id);
        if (body.sandbox_id !== undefined) incident.set("sandbox_id", body.sandbox_id);
        if (body.tags !== undefined) incident.set("tags_json", body.tags);
        if (body.metadata !== undefined) incident.set("metadata_json", body.metadata);

        e.app.save(incident);
        return e.json(200, { success: true, data: { id: incident.id, status: incident.getString("status"), severity: incident.getString("severity") } });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 5. DELETE /api/projectbase/incidents/{id}
routerAdd("DELETE", "/api/projectbase/incidents/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const incident = e.app.findRecordById("incidents", id);

        // Delete cascade child records
        try {
            const evs = e.app.findRecordsByFilter("incident_events", `incident_id = '${incident.id}'`, "id", 500, 0);
            evs.forEach(ev => { try { e.app.delete(ev); } catch(x){} });

            const hypos = e.app.findRecordsByFilter("incident_hypotheses", `incident_id = '${incident.id}'`, "id", 500, 0);
            hypos.forEach(h => { try { e.app.delete(h); } catch(x){} });

            const mits = e.app.findRecordsByFilter("incident_mitigations", `incident_id = '${incident.id}'`, "id", 500, 0);
            mits.forEach(m => { try { e.app.delete(m); } catch(x){} });

            const pms = e.app.findRecordsByFilter("incident_postmortems", `incident_id = '${incident.id}'`, "id", 100, 0);
            pms.forEach(p => { try { e.app.delete(p); } catch(x){} });
        } catch (x) {}

        e.app.delete(incident);
        return e.json(200, { success: true, message: `Incident ${id} deleted successfully` });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 6. POST /api/projectbase/incidents/{id}/status
routerAdd("POST", "/api/projectbase/incidents/{id}/status", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const newStatus = body.status;
        if (!newStatus) {
            return e.json(400, { success: false, error: "Missing required field: status" });
        }

        const incident = e.app.findRecordById("incidents", id);
        const oldStatus = incident.getString("status");
        incident.set("status", newStatus);
        const nowIso = new Date().toISOString();

        if (newStatus === "mitigated" && !incident.getString("mitigated_at")) {
            incident.set("mitigated_at", nowIso);
        } else if (newStatus === "resolved" && !incident.getString("resolved_at")) {
            incident.set("resolved_at", nowIso);
            if (!incident.getString("mitigated_at")) incident.set("mitigated_at", nowIso);
        }

        e.app.save(incident);

        // Record status change event
        try {
            const evCol = e.app.findCollectionByNameOrId("incident_events");
            const evRec = new Record(evCol);
            evRec.set("incident_id", incident.id);
            evRec.set("event_type", "status_change");
            evRec.set("author", body.author || incident.getString("incident_commander") || "Flomaster-Commander");
            evRec.set("author_type", body.author_type || "agent");
            evRec.set("title", `Status transitioned: ${oldStatus} -> ${newStatus}`);
            evRec.set("content", body.note || `Incident status updated to ${newStatus}.`);
            evRec.set("payload_json", { old_status: oldStatus, new_status: newStatus });
            evRec.set("severity", newStatus === "resolved" ? "info" : (newStatus === "mitigated" ? "warning" : "error"));
            evRec.set("timestamp", nowIso);
            e.app.save(evRec);
        } catch (x) {}

        return e.json(200, {
            success: true,
            data: {
                id: incident.id,
                old_status: oldStatus,
                new_status: newStatus,
                mitigated_at: incident.getString("mitigated_at"),
                resolved_at: incident.getString("resolved_at")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 7. POST /api/projectbase/incidents/{id}/events
routerAdd("POST", "/api/projectbase/incidents/{id}/events", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const title = (body.title || "").trim();
        if (!title) {
            return e.json(400, { success: false, error: "Missing required field: title" });
        }

        const incident = e.app.findRecordById("incidents", id);
        const col = e.app.findCollectionByNameOrId("incident_events");
        const record = new Record(col);

        const nowIso = new Date().toISOString();
        record.set("incident_id", incident.id);
        record.set("event_type", body.event_type || "log_entry");
        record.set("author", body.author || "Flomaster-Investigator");
        record.set("author_type", body.author_type || "agent");
        record.set("title", title);
        record.set("content", body.content || "");
        record.set("payload_json", body.payload || {});
        record.set("severity", body.severity || "info");
        record.set("timestamp", body.timestamp || nowIso);

        e.app.save(record);

        return e.json(201, {
            success: true,
            data: {
                id: record.id,
                incident_id: record.getString("incident_id"),
                event_type: record.getString("event_type"),
                title: record.getString("title"),
                timestamp: record.getString("timestamp")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 8. GET /api/projectbase/incidents/{id}/events
routerAdd("GET", "/api/projectbase/incidents/{id}/events", (e) => {
    try {
        const id = e.request.pathValue("id");
        const incident = e.app.findRecordById("incidents", id);
        const records = e.app.findRecordsByFilter("incident_events", `incident_id = '${incident.id}'`, "+timestamp", 200, 0);

        const items = records.map(r => ({
            id: r.id,
            incident_id: r.getString("incident_id"),
            event_type: r.getString("event_type"),
            author: r.getString("author"),
            author_type: r.getString("author_type"),
            title: r.getString("title"),
            content: r.getString("content"),
            payload: r.get("payload_json") || {},
            severity: r.getString("severity"),
            timestamp: r.getString("timestamp")
        }));

        return e.json(200, { success: true, count: items.length, data: items });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 9. POST /api/projectbase/incidents/{id}/hypotheses
routerAdd("POST", "/api/projectbase/incidents/{id}/hypotheses", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const hypothesis = (body.hypothesis || "").trim();
        if (!hypothesis) {
            return e.json(400, { success: false, error: "Missing required field: hypothesis" });
        }

        const incident = e.app.findRecordById("incidents", id);
        const col = e.app.findCollectionByNameOrId("incident_hypotheses");
        const record = new Record(col);

        record.set("incident_id", incident.id);
        record.set("proposed_by", body.proposed_by || "Flomaster-Investigator");
        record.set("hypothesis", hypothesis);
        record.set("rationale", body.rationale || "");
        record.set("status", body.status || "proposed");
        record.set("test_plan", body.test_plan || "");
        record.set("evidence", body.evidence || "");
        record.set("confidence_score", body.confidence_score !== undefined ? Number(body.confidence_score) : 0.5);
        record.set("tested_by", body.tested_by || "");
        record.set("tested_at", body.tested_at || "");
        record.set("artifact_url", body.artifact_url || "");

        e.app.save(record);

        // Record timeline event
        try {
            const evCol = e.app.findCollectionByNameOrId("incident_events");
            const evRec = new Record(evCol);
            evRec.set("incident_id", incident.id);
            evRec.set("event_type", "hypothesis_tested");
            evRec.set("author", record.getString("proposed_by"));
            evRec.set("author_type", "agent");
            evRec.set("title", `Hypothesis Proposed: ${record.getString("hypothesis")}`);
            evRec.set("content", record.getString("rationale") || "New diagnostic hypothesis registered.");
            evRec.set("payload_json", { hypothesis_id: record.id, status: record.getString("status"), confidence: record.getFloat("confidence_score") });
            evRec.set("severity", "info");
            evRec.set("timestamp", new Date().toISOString());
            e.app.save(evRec);
        } catch (x) {}

        return e.json(201, {
            success: true,
            data: {
                id: record.id,
                incident_id: record.getString("incident_id"),
                hypothesis: record.getString("hypothesis"),
                status: record.getString("status"),
                confidence_score: record.getFloat("confidence_score")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 10. PATCH /api/projectbase/incidents/{id}/hypotheses/{hypoId}
routerAdd("PATCH", "/api/projectbase/incidents/{id}/hypotheses/{hypoId}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const hypoId = e.request.pathValue("hypoId");
        const body = e.requestInfo().body || {};

        const incident = e.app.findRecordById("incidents", id);
        const hypo = e.app.findRecordById("incident_hypotheses", hypoId);

        if (body.hypothesis !== undefined) hypo.set("hypothesis", (body.hypothesis || "").trim());
        if (body.rationale !== undefined) hypo.set("rationale", body.rationale);
        if (body.status !== undefined) hypo.set("status", body.status);
        if (body.test_plan !== undefined) hypo.set("test_plan", body.test_plan);
        if (body.evidence !== undefined) hypo.set("evidence", body.evidence);
        if (body.confidence_score !== undefined) hypo.set("confidence_score", Number(body.confidence_score));
        if (body.tested_by !== undefined) hypo.set("tested_by", body.tested_by);
        if (body.artifact_url !== undefined) hypo.set("artifact_url", body.artifact_url);

        if (body.status === "confirmed" || body.status === "falsified") {
            hypo.set("tested_at", new Date().toISOString());
        }

        e.app.save(hypo);

        // Record timeline event
        try {
            const evCol = e.app.findCollectionByNameOrId("incident_events");
            const evRec = new Record(evCol);
            evRec.set("incident_id", incident.id);
            evRec.set("event_type", "hypothesis_tested");
            evRec.set("author", hypo.getString("tested_by") || hypo.getString("proposed_by") || "Flomaster-Investigator");
            evRec.set("author_type", "agent");
            evRec.set("title", `Hypothesis Updated: [${hypo.getString("status").toUpperCase()}] ${hypo.getString("hypothesis")}`);
            evRec.set("content", hypo.getString("evidence") || `Status updated to ${hypo.getString("status")}`);
            evRec.set("payload_json", { hypothesis_id: hypo.id, status: hypo.getString("status"), confidence: hypo.getFloat("confidence_score") });
            evRec.set("severity", hypo.getString("status") === "confirmed" ? "warning" : "info");
            evRec.set("timestamp", new Date().toISOString());
            e.app.save(evRec);
        } catch (x) {}

        return e.json(200, {
            success: true,
            data: {
                id: hypo.id,
                hypothesis: hypo.getString("hypothesis"),
                status: hypo.getString("status"),
                confidence_score: hypo.getFloat("confidence_score"),
                evidence: hypo.getString("evidence")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 11. GET /api/projectbase/incidents/{id}/hypotheses
routerAdd("GET", "/api/projectbase/incidents/{id}/hypotheses", (e) => {
    try {
        const id = e.request.pathValue("id");
        const incident = e.app.findRecordById("incidents", id);
        const records = e.app.findRecordsByFilter("incident_hypotheses", `incident_id = '${incident.id}'`, "-confidence_score", 100, 0);

        const items = records.map(h => ({
            id: h.id,
            incident_id: h.getString("incident_id"),
            proposed_by: h.getString("proposed_by"),
            hypothesis: h.getString("hypothesis"),
            rationale: h.getString("rationale"),
            status: h.getString("status"),
            test_plan: h.getString("test_plan"),
            evidence: h.getString("evidence"),
            confidence_score: h.getFloat("confidence_score") || 0,
            tested_by: h.getString("tested_by"),
            tested_at: h.getString("tested_at"),
            artifact_url: h.getString("artifact_url")
        }));

        return e.json(200, { success: true, count: items.length, data: items });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 12. POST /api/projectbase/incidents/{id}/mitigations
routerAdd("POST", "/api/projectbase/incidents/{id}/mitigations", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const title = (body.title || "").trim();
        if (!title) {
            return e.json(400, { success: false, error: "Missing required field: title" });
        }

        const incident = e.app.findRecordById("incidents", id);
        const col = e.app.findCollectionByNameOrId("incident_mitigations");
        const record = new Record(col);

        const nowIso = new Date().toISOString();
        record.set("incident_id", incident.id);
        record.set("title", title);
        record.set("description", body.description || "");
        record.set("action_type", body.action_type || "code_fix");
        record.set("status", body.status || "planned");
        record.set("executed_by", body.executed_by || "Flomaster-Commander");
        record.set("executed_at", body.status === "applied" ? nowIso : (body.executed_at || ""));
        record.set("verification_method", body.verification_method || "");
        record.set("verification_result", body.verification_result || "");
        record.set("rollback_plan", body.rollback_plan || "");

        e.app.save(record);

        // Record timeline event
        try {
            const evCol = e.app.findCollectionByNameOrId("incident_events");
            const evRec = new Record(evCol);
            evRec.set("incident_id", incident.id);
            evRec.set("event_type", "mitigation_executed");
            evRec.set("author", record.getString("executed_by"));
            evRec.set("author_type", "agent");
            evRec.set("title", `Mitigation Registered: ${record.getString("title")} [${record.getString("action_type")}]`);
            evRec.set("content", record.getString("description") || "Mitigation action created.");
            evRec.set("payload_json", { mitigation_id: record.id, action_type: record.getString("action_type"), status: record.getString("status") });
            evRec.set("severity", "warning");
            evRec.set("timestamp", nowIso);
            e.app.save(evRec);
        } catch (x) {}

        return e.json(201, {
            success: true,
            data: {
                id: record.id,
                incident_id: record.getString("incident_id"),
                title: record.getString("title"),
                action_type: record.getString("action_type"),
                status: record.getString("status")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 13. PATCH /api/projectbase/incidents/{id}/mitigations/{mitId}
routerAdd("PATCH", "/api/projectbase/incidents/{id}/mitigations/{mitId}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const mitId = e.request.pathValue("mitId");
        const body = e.requestInfo().body || {};

        const incident = e.app.findRecordById("incidents", id);
        const mit = e.app.findRecordById("incident_mitigations", mitId);

        if (body.title !== undefined) mit.set("title", (body.title || "").trim());
        if (body.description !== undefined) mit.set("description", body.description);
        if (body.action_type !== undefined) mit.set("action_type", body.action_type);
        if (body.status !== undefined) mit.set("status", body.status);
        if (body.executed_by !== undefined) mit.set("executed_by", body.executed_by);
        if (body.verification_method !== undefined) mit.set("verification_method", body.verification_method);
        if (body.verification_result !== undefined) mit.set("verification_result", body.verification_result);
        if (body.rollback_plan !== undefined) mit.set("rollback_plan", body.rollback_plan);

        if (body.status === "applied" && !mit.getString("executed_at")) {
            mit.set("executed_at", new Date().toISOString());
        }

        e.app.save(mit);

        // Record timeline event
        try {
            const evCol = e.app.findCollectionByNameOrId("incident_events");
            const evRec = new Record(evCol);
            evRec.set("incident_id", incident.id);
            evRec.set("event_type", "mitigation_executed");
            evRec.set("author", mit.getString("executed_by") || "Flomaster-Commander");
            evRec.set("author_type", "agent");
            evRec.set("title", `Mitigation Status: [${mit.getString("status").toUpperCase()}] ${mit.getString("title")}`);
            evRec.set("content", mit.getString("verification_result") || `Status updated to ${mit.getString("status")}`);
            evRec.set("payload_json", { mitigation_id: mit.id, status: mit.getString("status") });
            evRec.set("severity", mit.getString("status") === "verified" ? "info" : (mit.getString("status") === "failed" ? "critical" : "warning"));
            evRec.set("timestamp", new Date().toISOString());
            e.app.save(evRec);
        } catch (x) {}

        return e.json(200, {
            success: true,
            data: {
                id: mit.id,
                title: mit.getString("title"),
                status: mit.getString("status"),
                verification_result: mit.getString("verification_result")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 14. GET /api/projectbase/incidents/{id}/mitigations
routerAdd("GET", "/api/projectbase/incidents/{id}/mitigations", (e) => {
    try {
        const id = e.request.pathValue("id");
        const incident = e.app.findRecordById("incidents", id);
        const records = e.app.findRecordsByFilter("incident_mitigations", `incident_id = '${incident.id}'`, "-created", 100, 0);

        const items = records.map(m => ({
            id: m.id,
            incident_id: m.getString("incident_id"),
            title: m.getString("title"),
            description: m.getString("description"),
            action_type: m.getString("action_type"),
            status: m.getString("status"),
            executed_by: m.getString("executed_by"),
            executed_at: m.getString("executed_at"),
            verification_method: m.getString("verification_method"),
            verification_result: m.getString("verification_result"),
            rollback_plan: m.getString("rollback_plan")
        }));

        return e.json(200, { success: true, count: items.length, data: items });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 15. POST /api/projectbase/incidents/{id}/postmortem
routerAdd("POST", "/api/projectbase/incidents/{id}/postmortem", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const incident = e.app.findRecordById("incidents", id);

        let pmRec = null;
        try {
            pmRec = e.app.findFirstRecordByData("incident_postmortems", "incident_id", incident.id);
        } catch (x) {}

        const isNew = !pmRec;
        if (isNew) {
            const col = e.app.findCollectionByNameOrId("incident_postmortems");
            pmRec = new Record(col);
            pmRec.set("incident_id", incident.id);
            pmRec.set("slug", (body.slug || ("pm-" + incident.getString("slug"))).toLowerCase());
        }

        const nowIso = new Date().toISOString();
        pmRec.set("title", body.title || `Post-Mortem: ${incident.getString("title")}`);
        pmRec.set("status", body.status || "draft");
        pmRec.set("executive_summary", body.executive_summary || incident.getString("summary") || "");
        pmRec.set("root_cause_analysis", body.root_cause_analysis || "");
        pmRec.set("contributing_factors_json", body.contributing_factors || []);
        pmRec.set("impact_metrics_json", body.impact_metrics || {});
        pmRec.set("timeline_summary", body.timeline_summary || "");
        pmRec.set("detection_gap", body.detection_gap || "");
        pmRec.set("action_items_json", body.action_items || []);
        pmRec.set("lessons_learned", body.lessons_learned || "");
        pmRec.set("author", body.author || incident.getString("lead_investigator") || incident.getString("incident_commander") || "Flomaster-Investigator");
        if (body.status === "published") {
            pmRec.set("published_at", nowIso);
            incident.set("status", "postmortem_published");
        }

        e.app.save(pmRec);

        incident.set("postmortem_id", pmRec.id);
        e.app.save(incident);

        return e.json(isNew ? 201 : 200, {
            success: true,
            data: {
                id: pmRec.id,
                incident_id: pmRec.getString("incident_id"),
                title: pmRec.getString("title"),
                slug: pmRec.getString("slug"),
                status: pmRec.getString("status")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 16. GET /api/projectbase/incidents/{id}/postmortem
routerAdd("GET", "/api/projectbase/incidents/{id}/postmortem", (e) => {
    try {
        const id = e.request.pathValue("id");
        const incident = e.app.findRecordById("incidents", id);
        let pmRec = null;
        try {
            pmRec = e.app.findFirstRecordByData("incident_postmortems", "incident_id", incident.id);
        } catch (x) {
            return e.json(404, { success: false, error: "Post-mortem not found for this incident" });
        }

        if (!pmRec) {
            return e.json(404, { success: false, error: "Post-mortem not found for this incident" });
        }

        return e.json(200, {
            success: true,
            data: {
                id: pmRec.id,
                incident_id: pmRec.getString("incident_id"),
                title: pmRec.getString("title"),
                slug: pmRec.getString("slug"),
                status: pmRec.getString("status"),
                executive_summary: pmRec.getString("executive_summary"),
                root_cause_analysis: pmRec.getString("root_cause_analysis"),
                contributing_factors: pmRec.get("contributing_factors_json") || [],
                impact_metrics: pmRec.get("impact_metrics_json") || {},
                timeline_summary: pmRec.getString("timeline_summary"),
                detection_gap: pmRec.getString("detection_gap"),
                action_items: pmRec.get("action_items_json") || [],
                lessons_learned: pmRec.getString("lessons_learned"),
                author: pmRec.getString("author"),
                published_at: pmRec.getString("published_at"),
                created: pmRec.getString("created"),
                updated: pmRec.getString("updated")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 17. PATCH /api/projectbase/incidents/{id}/postmortem
routerAdd("PATCH", "/api/projectbase/incidents/{id}/postmortem", (e) => {
    try {
        const id = e.request.pathValue("id");
        const body = e.requestInfo().body || {};
        const incident = e.app.findRecordById("incidents", id);
        const pmRec = e.app.findFirstRecordByData("incident_postmortems", "incident_id", incident.id);

        if (!pmRec) {
            return e.json(404, { success: false, error: "Post-mortem not found" });
        }

        if (body.title !== undefined) pmRec.set("title", body.title);
        if (body.status !== undefined) {
            pmRec.set("status", body.status);
            if (body.status === "published" && !pmRec.getString("published_at")) {
                pmRec.set("published_at", new Date().toISOString());
                incident.set("status", "postmortem_published");
                e.app.save(incident);
            }
        }
        if (body.executive_summary !== undefined) pmRec.set("executive_summary", body.executive_summary);
        if (body.root_cause_analysis !== undefined) pmRec.set("root_cause_analysis", body.root_cause_analysis);
        if (body.contributing_factors !== undefined) pmRec.set("contributing_factors_json", body.contributing_factors);
        if (body.impact_metrics !== undefined) pmRec.set("impact_metrics_json", body.impact_metrics);
        if (body.timeline_summary !== undefined) pmRec.set("timeline_summary", body.timeline_summary);
        if (body.detection_gap !== undefined) pmRec.set("detection_gap", body.detection_gap);
        if (body.action_items !== undefined) pmRec.set("action_items_json", body.action_items);
        if (body.lessons_learned !== undefined) pmRec.set("lessons_learned", body.lessons_learned);

        e.app.save(pmRec);

        return e.json(200, {
            success: true,
            data: {
                id: pmRec.id,
                title: pmRec.getString("title"),
                status: pmRec.getString("status"),
                published_at: pmRec.getString("published_at")
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 18. GET /api/projectbase/incidents/metrics
routerAdd("GET", "/api/projectbase/incidents/metrics", (e) => {
    try {
        const incidents = e.app.findRecordsByFilter("incidents", "id != ''", "-created", 500, 0);

        let total = incidents.length;
        let p0_count = 0;
        let p1_count = 0;
        let p2_count = 0;
        let p3_count = 0;
        let open_warrooms = 0;
        let resolved_count = 0;
        let total_ttm_minutes = 0;
        let ttm_samples = 0;
        let total_ttr_minutes = 0;
        let ttr_samples = 0;

        incidents.forEach(inc => {
            const sev = inc.getString("severity");
            const st = inc.getString("status");
            if (sev === "p0_critical") p0_count++;
            else if (sev === "p1_high") p1_count++;
            else if (sev === "p2_medium") p2_count++;
            else p3_count++;

            if (st === "declared" || st === "triage" || st === "investigating") {
                open_warrooms++;
            } else if (st === "resolved" || st === "postmortem_published") {
                resolved_count++;
            }

            const started = inc.getString("started_at");
            const mitigated = inc.getString("mitigated_at");
            const resolved = inc.getString("resolved_at");

            if (started && mitigated) {
                const diffMs = new Date(mitigated).getTime() - new Date(started).getTime();
                if (diffMs > 0) {
                    total_ttm_minutes += diffMs / (1000 * 60);
                    ttm_samples++;
                }
            }

            if (started && resolved) {
                const diffMs = new Date(resolved).getTime() - new Date(started).getTime();
                if (diffMs > 0) {
                    total_ttr_minutes += diffMs / (1000 * 60);
                    ttr_samples++;
                }
            }
        });

        const avg_ttm_minutes = ttm_samples > 0 ? Math.round(total_ttm_minutes / ttm_samples) : 0;
        const avg_ttr_minutes = ttr_samples > 0 ? Math.round(total_ttr_minutes / ttr_samples) : 0;

        return e.json(200, {
            success: true,
            data: {
                total_incidents: total,
                active_warrooms: open_warrooms,
                resolved_incidents: resolved_count,
                p0_critical: p0_count,
                p1_high: p1_count,
                p2_medium: p2_count,
                p3_low: p3_count,
                mean_time_to_mitigate_minutes: avg_ttm_minutes,
                mean_time_to_resolve_minutes: avg_ttr_minutes
            }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});

// 19. POST /api/projectbase/incidents/seed-demo
routerAdd("POST", "/api/projectbase/incidents/seed-demo", (e) => {
    try {
        let existing = null;
        try {
            existing = e.app.findFirstRecordByData("incidents", "slug", "inc-demo-auth-leak");
        } catch (x) {}

        if (existing) {
            return e.json(200, { success: true, message: "Demo incident already exists", incident_id: existing.id });
        }

        const incCol = e.app.findCollectionByNameOrId("incidents");
        const inc = new Record(incCol);
        const t0 = new Date(Date.now() - 3600000).toISOString();
        const t1 = new Date(Date.now() - 3000000).toISOString();
        const t2 = new Date(Date.now() - 1800000).toISOString();
        const t3 = new Date(Date.now() - 600000).toISOString();

        inc.set("title", "High Latency & Intermittent 503s on Session Dispatch API");
        inc.set("slug", "inc-demo-auth-leak");
        inc.set("summary", "Production dispatch gateway experienced request queue exhaustion due to unindexed connection pool locks under swarm burst load.");
        inc.set("project_id", "");
        inc.set("severity", "p1_high");
        inc.set("status", "resolved");
        inc.set("incident_commander", "Flomaster-Commander");
        inc.set("lead_investigator", "Flomaster-Auditor");
        inc.set("source", "runtime_probe");
        inc.set("impact_scope", "Session Dispatcher & FastMCP RPC Cluster");
        inc.set("service_name", "session-gateway");
        inc.set("started_at", t0);
        inc.set("detected_at", t1);
        inc.set("mitigated_at", t2);
        inc.set("resolved_at", t3);
        inc.set("tags_json", ["gateway", "sqlite-lock", "p1", "swarm-burst"]);
        inc.set("metadata_json", { peak_503_rate: "18.4%", affected_workers: 42 });
        e.app.save(inc);

        // Seed events
        const evCol = e.app.findCollectionByNameOrId("incident_events");
        const eventsData = [
            { type: "metric_anomaly", title: "Gateway P99 Latency Spiked to 4200ms", author: "Prometheus-Probe", author_type: "system", sev: "critical", time: t1, content: "HTTP 503 errors crossed 5% threshold across all swarm dispatch workers." },
            { type: "status_change", title: "Incident Declared: P1 - High Latency on Dispatch API", author: "Flomaster-Commander", author_type: "agent", sev: "warning", time: t1, content: "Incident response team mobilized. Investigation lead assigned." },
            { type: "log_entry", title: "SQLite Database Busy Timeout in Ingestion Hook", author: "Flomaster-Auditor", author_type: "agent", sev: "error", time: t2, content: "Log inspection revealed WAL checkpoint queue contention during concurrent session writes." }
        ];

        eventsData.forEach(ed => {
            const ev = new Record(evCol);
            ev.set("incident_id", inc.id);
            ev.set("event_type", ed.type);
            ev.set("author", ed.author);
            ev.set("author_type", ed.author_type);
            ev.set("title", ed.title);
            ev.set("content", ed.content);
            ev.set("payload_json", {});
            ev.set("severity", ed.sev);
            ev.set("timestamp", ed.time);
            e.app.save(ev);
        });

        // Seed Hypotheses
        const hypoCol = e.app.findCollectionByNameOrId("incident_hypotheses");
        const h1 = new Record(hypoCol);
        h1.set("incident_id", inc.id);
        h1.set("proposed_by", "Flomaster-Auditor");
        h1.set("hypothesis", "WAL lock contention caused by long-running transactions in session trajectory ingestion");
        h1.set("rationale", "DB busy errors aligned with swarm batch ingestion spikes.");
        h1.set("status", "confirmed");
        h1.set("test_plan", "Reproduce concurrent 100-worker write load in dev sandbox with isolated WAL settings.");
        h1.set("evidence", "Confirmed: wal_autocheckpoint interval of 1000 pages caused 4s stall under burst writes.");
        h1.set("confidence_score", 0.95);
        h1.set("tested_by", "Flomaster-Auditor");
        h1.set("tested_at", t2);
        e.app.save(h1);

        // Seed Mitigation
        const mitCol = e.app.findCollectionByNameOrId("incident_mitigations");
        const m1 = new Record(mitCol);
        m1.set("incident_id", inc.id);
        m1.set("title", "Tune SQLite PRAGMA wal_autocheckpoint and add write retry backoff");
        m1.set("description", "Set wal_autocheckpoint=4000 and exponential backoff on SQLITE_BUSY in hook 107.");
        m1.set("action_type", "config_patch");
        m1.set("status", "verified");
        m1.set("executed_by", "Flomaster-Commander");
        m1.set("executed_at", t2);
        m1.set("verification_method", "Sandbox stress benchmark with 200 concurrent agent worker bursts.");
        m1.set("verification_result", "Zero 503 errors and P99 latency dropped to 14ms.");
        e.app.save(m1);

        // Seed Post-Mortem
        const pmCol = e.app.findCollectionByNameOrId("incident_postmortems");
        const pm = new Record(pmCol);
        pm.set("incident_id", inc.id);
        pm.set("title", "Post-Mortem: Session Dispatch Gateway 503 Lock Contention");
        pm.set("slug", "pm-inc-demo-auth-leak");
        pm.set("status", "published");
        pm.set("executive_summary", "A burst of 42 autonomous agent swarm sessions caused SQLite WAL write locks on the session gateway, leading to 18.4% 503 error rates for 20 minutes before automated mitigation was applied.");
        pm.set("root_cause_analysis", "5-Whys Analysis:\n1. Why did the API return 503? Gateway threads timed out waiting for database lock.\n2. Why was the DB locked? WAL checkpointing was blocking writes for up to 4.2s.\n3. Why did checkpointing take so long? The default 1000-page threshold was too low for 40+ concurrent agents.\n4. Why wasn't write backoff present? The session ingestion hook lacked exponential retry logic.\n5. Root Cause: Default SQLite WAL configuration was unoptimized for high-concurrency autonomous agent bursts.");
        pm.set("contributing_factors_json", ["Unprecedented 42-agent swarm burst", "Default SQLite WAL checkpoint frequency", "Lack of adaptive exponential jitter backoff"]);
        pm.set("impact_metrics_json", { downtime_minutes: 20, error_rate_peak: "18.4%", affected_workers: 42, requests_failed: 1420 });
        pm.set("timeline_summary", "T+0: Swarm burst initiated\nT+10m: Prometheus latency alarm fired\nT+15m: War-room declared, commander assigned\nT+30m: Hypothesis confirmed & PRAGMA patch applied\nT+40m: Metrics stabilized, incident resolved");
        pm.set("detection_gap", "Synthetic health probes did not generate enough concurrent write volume to trigger lock contention prior to production swarm runs.");
        pm.set("action_items_json", [
            { task_id: "ACT-01", title: "Add SQLite WAL tuning to deployment scripts", owner: "Flomaster-DevOps", priority: "high", status: "completed" },
            { task_id: "ACT-02", title: "Implement synthetic swarm burst fuzz test in CI", owner: "Flomaster-QA", priority: "medium", status: "in_progress" }
        ]);
        pm.set("lessons_learned", "Agent fleets generate write profiles fundamentally different from human users; stress test all ingestion endpoints with realistic agent burst patterns.");
        pm.set("author", "Flomaster-Commander");
        pm.set("published_at", t3);
        e.app.save(pm);

        inc.set("postmortem_id", pm.id);
        e.app.save(inc);

        return e.json(201, {
            success: true,
            message: "Demo incident war-room seeded successfully",
            data: { incident_id: inc.id, postmortem_id: pm.id }
        });
    } catch (err) {
        return e.json(500, { success: false, error: err.message });
    }
});
