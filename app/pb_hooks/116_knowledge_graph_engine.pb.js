// ProjectBase Hook 116 — Autonomous Agent Knowledge Graph, Architectural Memory Index & Codebase Semantic Retrieval Engine (Milestone 11 / Epic 32).
//
// Exposes high-performance REST APIs and real-time coordination endpoints for architectural memory,
// codebase symbol indexing, dependency/governance relation graphs, automated invariant compliance verification,
// and architectural decision records (ADR) for multi-agent fleets.

// 1. GET /api/projectbase/knowledge/nodes
routerAdd("GET", "/api/projectbase/knowledge/nodes", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const kind = query.kind || "";
        const status = query.status || "";
        const projectId = query.project_id || "";
        const search = query.search || "";
        const author = query.author_agent || "";
        const filePath = query.file_path || "";
        const limit = parseInt(query.limit || "100", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [];
        if (kind) filterParts.push(`kind = '${kind}'`);
        if (status) filterParts.push(`status = '${status}'`);
        if (projectId) filterParts.push(`project_id = '${projectId}'`);
        if (author) filterParts.push(`author_agent = '${author}'`);
        if (filePath) filterParts.push(`file_path ~ '${filePath}'`);
        if (search) filterParts.push(`(title ~ '${search}' || summary ~ '${search}' || symbol_name ~ '${search}' || file_path ~ '${search}')`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "knowledge_nodes",
            filterExpr || "id != ''",
            "-created",
            limit,
            offset
        );

        const items = records.map(r => ({
            id: r.id,
            title: r.getString("title"),
            slug: r.getString("slug"),
            kind: r.getString("kind"),
            summary: r.getString("summary"),
            content_markdown: r.getString("content_markdown"),
            project_id: r.getString("project_id"),
            file_path: r.getString("file_path"),
            symbol_name: r.getString("symbol_name"),
            status: r.getString("status"),
            confidence_score: r.getFloat("confidence_score") || 1.0,
            author_agent: r.getString("author_agent"),
            mcp_session_id: r.getString("mcp_session_id"),
            tags_json: r.get("tags_json") || [],
            metadata_json: r.get("metadata_json") || {},
            created: r.getString("created"),
            updated: r.getString("updated")
        }));

        let total = items.length;
        try {
            const allCount = e.app.findRecordsByFilter("knowledge_nodes", filterExpr || "id != ''", "", 10000, 0);
            total = allCount.length;
        } catch (_) {}

        return e.json(200, { items, total, limit, offset });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. POST /api/projectbase/knowledge/nodes
routerAdd("POST", "/api/projectbase/knowledge/nodes", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const data = e.requestInfo().body || {};
        if (!data.title) {
            return e.json(400, { error: "Missing required field: title" });
        }

        const col = e.app.findCollectionByNameOrId("knowledge_nodes");
        const record = new Record(col);

        let rawSlug = data.slug || data.title;
        let slug = rawSlug.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+|-+$/g, "");
        if (!slug) slug = "node-" + Math.random().toString(36).substring(2, 8);

        // Ensure uniqueness
        let existing = null;
        try {
            existing = e.app.findFirstRecordByData("knowledge_nodes", "slug", slug);
        } catch (_) {}
        if (existing) {
            slug = slug + "-" + Math.random().toString(36).substring(2, 6);
        }

        record.set("title", data.title);
        record.set("slug", slug);
        record.set("kind", data.kind || "invariant");
        record.set("summary", data.summary || "");
        record.set("content_markdown", data.content_markdown || "");
        record.set("project_id", data.project_id || "");
        record.set("file_path", data.file_path || "");
        record.set("symbol_name", data.symbol_name || "");
        record.set("status", data.status || "active");
        record.set("confidence_score", typeof data.confidence_score === "number" ? data.confidence_score : 1.0);
        record.set("author_agent", data.author_agent || "system");
        record.set("mcp_session_id", data.mcp_session_id || "");
        record.set("tags_json", Array.isArray(data.tags_json) ? data.tags_json : (data.tags ? data.tags : []));
        record.set("metadata_json", typeof data.metadata_json === "object" ? data.metadata_json : {});

        e.app.save(record);

        return e.json(201, {
            success: true,
            node: {
                id: record.id,
                title: record.getString("title"),
                slug: record.getString("slug"),
                kind: record.getString("kind"),
                summary: record.getString("summary"),
                content_markdown: record.getString("content_markdown"),
                project_id: record.getString("project_id"),
                file_path: record.getString("file_path"),
                symbol_name: record.getString("symbol_name"),
                status: record.getString("status"),
                confidence_score: record.getFloat("confidence_score"),
                author_agent: record.getString("author_agent"),
                mcp_session_id: record.getString("mcp_session_id"),
                tags_json: record.get("tags_json") || [],
                metadata_json: record.get("metadata_json") || {},
                created: record.getString("created")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. GET /api/projectbase/knowledge/nodes/{id}
routerAdd("GET", "/api/projectbase/knowledge/nodes/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        let record = null;
        try {
            record = e.app.findRecordById("knowledge_nodes", id);
        } catch (_) {
            try {
                record = e.app.findFirstRecordByData("knowledge_nodes", "slug", id);
            } catch (_) {}
        }

        if (!record) {
            return e.json(404, { error: "Knowledge node not found: " + id });
        }

        // Fetch relations
        let outbound = [];
        let inbound = [];
        try {
            const outRecords = e.app.findRecordsByFilter("knowledge_relations", `source_node_id = '${record.id}'`, "-created", 100, 0);
            outbound = outRecords.map(r => ({
                id: r.id,
                target_node_id: r.getString("target_node_id"),
                relation_type: r.getString("relation_type"),
                weight: r.getFloat("weight") || 1.0,
                description: r.getString("description"),
                metadata_json: r.get("metadata_json") || {}
            }));
        } catch (_) {}

        try {
            const inRecords = e.app.findRecordsByFilter("knowledge_relations", `target_node_id = '${record.id}'`, "-created", 100, 0);
            inbound = inRecords.map(r => ({
                id: r.id,
                source_node_id: r.getString("source_node_id"),
                relation_type: r.getString("relation_type"),
                weight: r.getFloat("weight") || 1.0,
                description: r.getString("description"),
                metadata_json: r.get("metadata_json") || {}
            }));
        } catch (_) {}

        // Fetch linked invariants
        let invariants = [];
        try {
            const invRecords = e.app.findRecordsByFilter("architectural_invariants", `node_id = '${record.id}'`, "-created", 50, 0);
            invariants = invRecords.map(r => ({
                id: r.id,
                rule_name: r.getString("rule_name"),
                rule_type: r.getString("rule_type"),
                pattern_expression: r.getString("pattern_expression"),
                severity: r.getString("severity"),
                enforcement_action: r.getString("enforcement_action"),
                is_active: r.getBool("is_active")
            }));
        } catch (_) {}

        return e.json(200, {
            node: {
                id: record.id,
                title: record.getString("title"),
                slug: record.getString("slug"),
                kind: record.getString("kind"),
                summary: record.getString("summary"),
                content_markdown: record.getString("content_markdown"),
                project_id: record.getString("project_id"),
                file_path: record.getString("file_path"),
                symbol_name: record.getString("symbol_name"),
                status: record.getString("status"),
                confidence_score: record.getFloat("confidence_score"),
                author_agent: record.getString("author_agent"),
                mcp_session_id: record.getString("mcp_session_id"),
                tags_json: record.get("tags_json") || [],
                metadata_json: record.get("metadata_json") || {},
                created: record.getString("created"),
                updated: record.getString("updated")
            },
            outbound_relations: outbound,
            inbound_relations: inbound,
            invariants: invariants
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 4. PATCH /api/projectbase/knowledge/nodes/{id}
routerAdd("PATCH", "/api/projectbase/knowledge/nodes/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = e.request.pathValue("id");
        let record = null;
        try {
            record = e.app.findRecordById("knowledge_nodes", id);
        } catch (_) {
            try {
                record = e.app.findFirstRecordByData("knowledge_nodes", "slug", id);
            } catch (_) {}
        }
        if (!record) return e.json(404, { error: "Knowledge node not found: " + id });

        const data = e.requestInfo().body || {};
        if (data.title !== undefined) record.set("title", data.title);
        if (data.slug !== undefined) {
            let s = data.slug.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+|-+$/g, "");
            record.set("slug", s);
        }
        if (data.kind !== undefined) record.set("kind", data.kind);
        if (data.summary !== undefined) record.set("summary", data.summary);
        if (data.content_markdown !== undefined) record.set("content_markdown", data.content_markdown);
        if (data.project_id !== undefined) record.set("project_id", data.project_id);
        if (data.file_path !== undefined) record.set("file_path", data.file_path);
        if (data.symbol_name !== undefined) record.set("symbol_name", data.symbol_name);
        if (data.status !== undefined) record.set("status", data.status);
        if (typeof data.confidence_score === "number") record.set("confidence_score", data.confidence_score);
        if (data.author_agent !== undefined) record.set("author_agent", data.author_agent);
        if (data.mcp_session_id !== undefined) record.set("mcp_session_id", data.mcp_session_id);
        if (data.tags_json !== undefined) record.set("tags_json", data.tags_json);
        if (data.metadata_json !== undefined) record.set("metadata_json", data.metadata_json);

        e.app.save(record);
        return e.json(200, { success: true, node: { id: record.id, title: record.getString("title"), status: record.getString("status") } });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. DELETE /api/projectbase/knowledge/nodes/{id}
routerAdd("DELETE", "/api/projectbase/knowledge/nodes/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = e.request.pathValue("id");
        let record = null;
        try {
            record = e.app.findRecordById("knowledge_nodes", id);
        } catch (_) {
            try {
                record = e.app.findFirstRecordByData("knowledge_nodes", "slug", id);
            } catch (_) {}
        }
        if (!record) return e.json(404, { error: "Knowledge node not found: " + id });

        const targetId = record.id;
        // Clean up relations
        try {
            const rels = e.app.findRecordsByFilter("knowledge_relations", `source_node_id = '${targetId}' || target_node_id = '${targetId}'`, "", 1000, 0);
            for (let r of rels) {
                e.app.delete(r);
            }
        } catch (_) {}

        e.app.delete(record);
        return e.json(200, { success: true, deleted_id: targetId });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. POST /api/projectbase/knowledge/nodes/{id}/status
routerAdd("POST", "/api/projectbase/knowledge/nodes/{id}/status", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = e.request.pathValue("id");
        let record = null;
        try {
            record = e.app.findRecordById("knowledge_nodes", id);
        } catch (_) {
            try {
                record = e.app.findFirstRecordByData("knowledge_nodes", "slug", id);
            } catch (_) {}
        }
        if (!record) return e.json(404, { error: "Knowledge node not found: " + id });

        const body = e.requestInfo().body || {};
        const newStatus = body.status || "deprecated";
        record.set("status", newStatus);

        if (body.superseded_by_id) {
            try {
                const relCol = e.app.findCollectionByNameOrId("knowledge_relations");
                const rel = new Record(relCol);
                rel.set("source_node_id", record.id);
                rel.set("target_node_id", body.superseded_by_id);
                rel.set("relation_type", "superseded_by");
                rel.set("description", body.reason || "Superseded by newer architectural standard");
                rel.set("weight", 1.0);
                e.app.save(rel);
            } catch (_) {}
        }

        e.app.save(record);
        return e.json(200, { success: true, id: record.id, status: newStatus });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. POST /api/projectbase/knowledge/relations
routerAdd("POST", "/api/projectbase/knowledge/relations", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const data = e.requestInfo().body || {};
        if (!data.source_node_id || !data.target_node_id || !data.relation_type) {
            return e.json(400, { error: "Missing required fields: source_node_id, target_node_id, relation_type" });
        }

        const col = e.app.findCollectionByNameOrId("knowledge_relations");
        const record = new Record(col);

        record.set("source_node_id", data.source_node_id);
        record.set("target_node_id", data.target_node_id);
        record.set("relation_type", data.relation_type);
        record.set("weight", typeof data.weight === "number" ? data.weight : 1.0);
        record.set("description", data.description || "");
        record.set("metadata_json", typeof data.metadata_json === "object" ? data.metadata_json : {});

        e.app.save(record);

        return e.json(201, {
            success: true,
            relation: {
                id: record.id,
                source_node_id: record.getString("source_node_id"),
                target_node_id: record.getString("target_node_id"),
                relation_type: record.getString("relation_type"),
                weight: record.getFloat("weight"),
                description: record.getString("description"),
                created: record.getString("created")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. GET /api/projectbase/knowledge/relations
routerAdd("GET", "/api/projectbase/knowledge/relations", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const source = query.source_node_id || "";
        const target = query.target_node_id || "";
        const relType = query.relation_type || "";
        const limit = parseInt(query.limit || "200", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [];
        if (source) filterParts.push(`source_node_id = '${source}'`);
        if (target) filterParts.push(`target_node_id = '${target}'`);
        if (relType) filterParts.push(`relation_type = '${relType}'`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "knowledge_relations",
            filterExpr || "id != ''",
            "-created",
            limit,
            offset
        );

        const items = records.map(r => ({
            id: r.id,
            source_node_id: r.getString("source_node_id"),
            target_node_id: r.getString("target_node_id"),
            relation_type: r.getString("relation_type"),
            weight: r.getFloat("weight") || 1.0,
            description: r.getString("description"),
            metadata_json: r.get("metadata_json") || {},
            created: r.getString("created")
        }));

        return e.json(200, { items, total: items.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 9. DELETE /api/projectbase/knowledge/relations/{id}
routerAdd("DELETE", "/api/projectbase/knowledge/relations/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("knowledge_relations", id);
        if (!record) return e.json(404, { error: "Relation not found: " + id });
        e.app.delete(record);
        return e.json(200, { success: true, deleted_id: id });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 10. GET /api/projectbase/knowledge/graph
routerAdd("GET", "/api/projectbase/knowledge/graph", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const projectId = query.project_id || "";
        const kind = query.kind || "";

        let nodeFilterParts = [];
        if (projectId) nodeFilterParts.push(`project_id = '${projectId}'`);
        if (kind) nodeFilterParts.push(`kind = '${kind}'`);

        const nodeRecords = e.app.findRecordsByFilter("knowledge_nodes", nodeFilterParts.join(" && ") || "id != ''", "-created", 300, 0);
        const nodes = nodeRecords.map(r => ({
            id: r.id,
            title: r.getString("title"),
            slug: r.getString("slug"),
            kind: r.getString("kind"),
            status: r.getString("status"),
            file_path: r.getString("file_path"),
            confidence_score: r.getFloat("confidence_score") || 1.0,
            tags: r.get("tags_json") || []
        }));

        const nodeIds = new Set(nodes.map(n => n.id));

        const relRecords = e.app.findRecordsByFilter("knowledge_relations", "id != ''", "-created", 500, 0);
        const edges = relRecords
            .filter(r => nodeIds.has(r.getString("source_node_id")) && nodeIds.has(r.getString("target_node_id")))
            .map(r => ({
                id: r.id,
                source: r.getString("source_node_id"),
                target: r.getString("target_node_id"),
                type: r.getString("relation_type"),
                weight: r.getFloat("weight") || 1.0,
                description: r.getString("description")
            }));

        return e.json(200, { nodes, edges, total_nodes: nodes.length, total_edges: edges.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 11. POST /api/projectbase/knowledge/invariants
routerAdd("POST", "/api/projectbase/knowledge/invariants", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const data = e.requestInfo().body || {};
        if (!data.rule_name || !data.rule_type || !data.pattern_expression) {
            return e.json(400, { error: "Missing required fields: rule_name, rule_type, pattern_expression" });
        }

        const col = e.app.findCollectionByNameOrId("architectural_invariants");
        const record = new Record(col);

        record.set("node_id", data.node_id || "");
        record.set("rule_name", data.rule_name);
        record.set("rule_type", data.rule_type);
        record.set("pattern_expression", data.pattern_expression);
        record.set("severity", data.severity || "p0_blocking");
        record.set("enforcement_action", data.enforcement_action || "block_merge");
        record.set("is_active", data.is_active !== undefined ? Boolean(data.is_active) : true);
        record.set("metadata_json", typeof data.metadata_json === "object" ? data.metadata_json : {});

        e.app.save(record);

        return e.json(201, {
            success: true,
            invariant: {
                id: record.id,
                rule_name: record.getString("rule_name"),
                rule_type: record.getString("rule_type"),
                pattern_expression: record.getString("pattern_expression"),
                severity: record.getString("severity"),
                enforcement_action: record.getString("enforcement_action"),
                is_active: record.getBool("is_active"),
                node_id: record.getString("node_id"),
                created: record.getString("created")
            }
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 12. GET /api/projectbase/knowledge/invariants
routerAdd("GET", "/api/projectbase/knowledge/invariants", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const ruleType = query.rule_type || "";
        const severity = query.severity || "";
        const isActive = query.is_active !== undefined ? query.is_active : "";

        let filterParts = [];
        if (ruleType) filterParts.push(`rule_type = '${ruleType}'`);
        if (severity) filterParts.push(`severity = '${severity}'`);
        if (isActive !== "") filterParts.push(`is_active = ${isActive === "true" || isActive === "1" ? "true" : "false"}`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "architectural_invariants",
            filterExpr || "id != ''",
            "-created",
            100,
            0
        );

        const items = records.map(r => ({
            id: r.id,
            node_id: r.getString("node_id"),
            rule_name: r.getString("rule_name"),
            rule_type: r.getString("rule_type"),
            pattern_expression: r.getString("pattern_expression"),
            severity: r.getString("severity"),
            enforcement_action: r.getString("enforcement_action"),
            is_active: r.getBool("is_active"),
            metadata_json: r.get("metadata_json") || {},
            created: r.getString("created"),
            updated: r.getString("updated")
        }));

        return e.json(200, { items, total: items.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 13. PATCH /api/projectbase/knowledge/invariants/{id}
routerAdd("PATCH", "/api/projectbase/knowledge/invariants/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("architectural_invariants", id);
        if (!record) return e.json(404, { error: "Invariant not found: " + id });

        const data = e.requestInfo().body || {};
        if (data.rule_name !== undefined) record.set("rule_name", data.rule_name);
        if (data.rule_type !== undefined) record.set("rule_type", data.rule_type);
        if (data.pattern_expression !== undefined) record.set("pattern_expression", data.pattern_expression);
        if (data.severity !== undefined) record.set("severity", data.severity);
        if (data.enforcement_action !== undefined) record.set("enforcement_action", data.enforcement_action);
        if (data.is_active !== undefined) record.set("is_active", Boolean(data.is_active));
        if (data.node_id !== undefined) record.set("node_id", data.node_id);
        if (data.metadata_json !== undefined) record.set("metadata_json", data.metadata_json);

        e.app.save(record);
        return e.json(200, { success: true, id: record.id, is_active: record.getBool("is_active") });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 14. DELETE /api/projectbase/knowledge/invariants/{id}
routerAdd("DELETE", "/api/projectbase/knowledge/invariants/{id}", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("architectural_invariants", id);
        if (!record) return e.json(404, { error: "Invariant not found: " + id });
        e.app.delete(record);
        return e.json(200, { success: true, deleted_id: id });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 15. POST /api/projectbase/knowledge/verify-invariants
routerAdd("POST", "/api/projectbase/knowledge/verify-invariants", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    const startTime = Date.now();
    try {
        const body = e.requestInfo().body || {};
        let targetFiles = [];
        if (Array.isArray(body.target_files)) {
            targetFiles = body.target_files;
        } else if (typeof body.target_files === "string") {
            targetFiles = body.target_files.split(",").map(s => s.trim()).filter(Boolean);
        }
        const diffSummary = body.diff_summary || "";
        const projectId = body.project_id || "";
        const mcpSessionId = body.mcp_session_id || "";
        const agentName = body.agent_name || "flomaster";

        const activeInvariants = e.app.findRecordsByFilter("architectural_invariants", "is_active = true", "-created", 1000, 0);

        let violations = [];
        let passedRules = [];

        for (let inv of activeInvariants) {
            const ruleName = inv.getString("rule_name");
            const ruleType = inv.getString("rule_type");
            const pattern = inv.getString("pattern_expression");
            const severity = inv.getString("severity");
            const action = inv.getString("enforcement_action");

            let matchedViolation = false;
            let violationReason = "";

            if (ruleType === "path_pattern" || ruleType === "dependency_constraint") {
                // Check if any target file matches prohibited pattern
                for (let file of targetFiles) {
                    if (pattern.startsWith("forbidden:") || pattern.startsWith("prohibited:")) {
                        const subPattern = pattern.replace(/^(forbidden|prohibited):/, "").trim();
                        if (file.toLowerCase().includes(subPattern.toLowerCase())) {
                            matchedViolation = true;
                            violationReason = `File '${file}' matches forbidden architectural pattern '${subPattern}'`;
                            break;
                        }
                    } else if (pattern.startsWith("require_match:")) {
                        const subPattern = pattern.replace(/^require_match:/, "").trim();
                        if (!file.match(new RegExp(subPattern))) {
                            matchedViolation = true;
                            violationReason = `File '${file}' violates required path regex '${subPattern}'`;
                            break;
                        }
                    } else {
                        // General substring or regex match
                        try {
                            const reg = new RegExp(pattern, "i");
                            if (reg.test(file)) {
                                matchedViolation = true;
                                violationReason = `File '${file}' matches invariant check rule '${pattern}'`;
                                break;
                            }
                        } catch (_) {
                            if (file.toLowerCase().includes(pattern.toLowerCase())) {
                                matchedViolation = true;
                                violationReason = `File '${file}' contains invariant pattern '${pattern}'`;
                                break;
                            }
                        }
                    }
                }

                // Also check in diffSummary if provided
                if (!matchedViolation && diffSummary) {
                    if (pattern.startsWith("forbidden:") || pattern.startsWith("prohibited:")) {
                        const subPattern = pattern.replace(/^(forbidden|prohibited):/, "").trim();
                        if (diffSummary.toLowerCase().includes(subPattern.toLowerCase())) {
                            matchedViolation = true;
                            violationReason = `Diff summary violates prohibited keyword '${subPattern}'`;
                        }
                    }
                }
            } else if (ruleType === "security_policy") {
                // Check secrets / plain credentials pattern
                const checkContent = targetFiles.join(" ") + " " + diffSummary;
                if (checkContent.includes("sk_live_") || checkContent.includes("ghp_") || checkContent.includes("AKIA") || checkContent.includes("BEGIN RSA PRIVATE KEY")) {
                    matchedViolation = true;
                    violationReason = "Potential hardcoded secret or private token detected in files/diff";
                }
            }

            if (matchedViolation) {
                violations.push({
                    invariant_id: inv.id,
                    rule_name: ruleName,
                    rule_type: ruleType,
                    severity: severity,
                    action: action,
                    reason: violationReason
                });
            } else {
                passedRules.push({
                    invariant_id: inv.id,
                    rule_name: ruleName,
                    severity: severity
                });
            }
        }

        let verdict = "passed";
        const hasBlocking = violations.some(v => v.severity === "p0_blocking");
        if (hasBlocking) {
            verdict = "violations_detected";
        } else if (violations.length > 0) {
            verdict = "warnings_only";
        }

        const executionMs = Date.now() - startTime;

        // Persist verification run
        let verificationRecordId = "";
        try {
            const verCol = e.app.findCollectionByNameOrId("invariant_verifications");
            const verRecord = new Record(verCol);
            verRecord.set("project_id", projectId);
            verRecord.set("mcp_session_id", mcpSessionId);
            verRecord.set("agent_name", agentName);
            verRecord.set("target_files_json", targetFiles);
            verRecord.set("diff_summary", diffSummary);
            verRecord.set("verdict", verdict);
            verRecord.set("violations_json", violations);
            verRecord.set("passed_rules_json", passedRules);
            verRecord.set("execution_ms", executionMs);
            verRecord.set("metadata_json", { total_checked: activeInvariants.length });
            e.app.save(verRecord);
            verificationRecordId = verRecord.id;
        } catch (_) {}

        return e.json(200, {
            verdict: verdict,
            passed: verdict === "passed" || verdict === "warnings_only",
            violations: violations,
            passed_rules: passedRules,
            verification_id: verificationRecordId,
            execution_ms: executionMs,
            total_rules_checked: activeInvariants.length
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 16. GET /api/projectbase/knowledge/verifications
routerAdd("GET", "/api/projectbase/knowledge/verifications", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const projectId = query.project_id || "";
        const verdict = query.verdict || "";
        const sessionId = query.mcp_session_id || "";
        const limit = parseInt(query.limit || "50", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [];
        if (projectId) filterParts.push(`project_id = '${projectId}'`);
        if (verdict) filterParts.push(`verdict = '${verdict}'`);
        if (sessionId) filterParts.push(`mcp_session_id = '${sessionId}'`);

        const records = e.app.findRecordsByFilter(
            "invariant_verifications",
            filterParts.join(" && ") || "id != ''",
            "-created",
            limit,
            offset
        );

        const items = records.map(r => ({
            id: r.id,
            project_id: r.getString("project_id"),
            mcp_session_id: r.getString("mcp_session_id"),
            agent_name: r.getString("agent_name"),
            target_files_json: r.get("target_files_json") || [],
            diff_summary: r.getString("diff_summary"),
            verdict: r.getString("verdict"),
            violations_json: r.get("violations_json") || [],
            passed_rules_json: r.get("passed_rules_json") || [],
            execution_ms: r.getFloat("execution_ms") || 0,
            metadata_json: r.get("metadata_json") || {},
            created: r.getString("created")
        }));

        return e.json(200, { items, total: items.length });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 17. GET /api/projectbase/knowledge/metrics
routerAdd("GET", "/api/projectbase/knowledge/metrics", (e) => {
    try {
        const nodes = e.app.findRecordsByFilter("knowledge_nodes", "id != ''", "", 5000, 0);
        const relations = e.app.findRecordsByFilter("knowledge_relations", "id != ''", "", 5000, 0);
        const invariants = e.app.findRecordsByFilter("architectural_invariants", "id != ''", "", 500, 0);
        const verifications = e.app.findRecordsByFilter("invariant_verifications", "id != ''", "", 1000, 0);

        const kindCounts = {};
        const statusCounts = {};
        const authorCounts = {};

        for (let n of nodes) {
            const k = n.getString("kind") || "unknown";
            kindCounts[k] = (kindCounts[k] || 0) + 1;

            const s = n.getString("status") || "active";
            statusCounts[s] = (statusCounts[s] || 0) + 1;

            const a = n.getString("author_agent") || "system";
            authorCounts[a] = (authorCounts[a] || 0) + 1;
        }

        const activeInvariants = invariants.filter(i => i.getBool("is_active")).length;
        const totalVerifications = verifications.length;
        const passedVerifications = verifications.filter(v => v.getString("verdict") === "passed" || v.getString("verdict") === "warnings_only").length;
        const passRate = totalVerifications > 0 ? ((passedVerifications / totalVerifications) * 100).toFixed(1) : "100.0";

        return e.json(200, {
            total_nodes: nodes.length,
            total_relations: relations.length,
            total_invariants: invariants.length,
            active_invariants: activeInvariants,
            total_verifications: totalVerifications,
            pass_rate_percent: parseFloat(passRate),
            by_kind: kindCounts,
            by_status: statusCounts,
            by_author: authorCounts,
            adrs_count: kindCounts["adr"] || 0,
            symbols_count: kindCounts["symbol"] || 0,
            subsystems_count: kindCounts["subsystem"] || 0
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 18. POST /api/projectbase/knowledge/query
routerAdd("POST", "/api/projectbase/knowledge/query", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const body = e.requestInfo().body || {};
        const queryRaw = (body.query || "").toLowerCase().trim();
        const tokens = queryRaw.split(/\s+/).filter(Boolean);
        const kind = body.kind || "";
        const limit = parseInt(body.limit || "20", 10);

        let filter = "id != ''";
        if (kind) filter += ` && kind = '${kind}'`;

        const records = e.app.findRecordsByFilter("knowledge_nodes", filter, "-created", 300, 0);

        let scored = [];
        for (let r of records) {
            const title = r.getString("title").toLowerCase();
            const summary = r.getString("summary").toLowerCase();
            const content = r.getString("content_markdown").toLowerCase();
            const symbol = r.getString("symbol_name").toLowerCase();
            const filePath = r.getString("file_path").toLowerCase();

            let score = 0;
            if (tokens.length > 0) {
                for (let t of tokens) {
                    if (title.includes(t)) score += 10;
                    if (symbol.includes(t)) score += 8;
                    if (summary.includes(t)) score += 5;
                    if (filePath.includes(t)) score += 4;
                    if (content.includes(t)) score += 2;
                }
            } else {
                score = 1;
            }

            if (score > 0) {
                scored.push({
                    score: score,
                    node: {
                        id: r.id,
                        title: r.getString("title"),
                        slug: r.getString("slug"),
                        kind: r.getString("kind"),
                        summary: r.getString("summary"),
                        content_markdown: r.getString("content_markdown"),
                        file_path: r.getString("file_path"),
                        symbol_name: r.getString("symbol_name"),
                        status: r.getString("status"),
                        confidence_score: r.getFloat("confidence_score"),
                        author_agent: r.getString("author_agent"),
                        tags_json: r.get("tags_json") || []
                    }
                });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        const results = scored.slice(0, limit).map(s => ({ ...s.node, relevance_score: s.score }));

        return e.json(200, { results, total: results.length, query: body.query });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 19. POST /api/projectbase/knowledge/seed-demo
routerAdd("POST", "/api/projectbase/knowledge/seed-demo", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const nodeCol = e.app.findCollectionByNameOrId("knowledge_nodes");
        const relCol = e.app.findCollectionByNameOrId("knowledge_relations");
        const invCol = e.app.findCollectionByNameOrId("architectural_invariants");

        // Seed 4 canonical ADRs
        const adrs = [
            {
                title: "ADR-001: Zero-Build Vue 3 UMD with Standalone Tailwind CSS",
                slug: "adr-001-zero-build-vue",
                kind: "adr",
                summary: "Eliminate Node.js, Vite, npm build steps and node_modules from frontend assets by serving native Vue 3 UMD straight from pb_public.",
                content_markdown: "# ADR-001: Zero-Build Vue 3 UMD\n\n## Status\nAccepted\n\n## Context\nModern frontend builds introduce massive dependencies, slow compilation steps, and broken tooling. ProjectBase requires instant self-hosting and zero runtime overhead.\n\n## Decision\nUse Vue 3 UMD loaded via script tags and pre-compiled static Tailwind CSS. All components live in `app/pb_public/js/components/`.\n\n## Consequences\nNo `npm run build` required. Edits are immediately visible on browser reload.",
                status: "accepted",
                confidence_score: 1.0,
                author_agent: "flomaster",
                tags: ["frontend", "vue3", "zero-build", "architecture"]
            },
            {
                title: "ADR-002: Single-Binary PocketBase Backend with SQLite WAL Mode",
                slug: "adr-002-single-binary-pocketbase",
                kind: "adr",
                summary: "Run all backend services, REST APIs, SSE real-time events, and schema migrations inside a single Go PocketBase binary under 50MB RAM.",
                content_markdown: "# ADR-002: Single-Binary PocketBase\n\n## Status\nAccepted\n\n## Context\nComplex microservices or separate database servers prevent lightweight self-hosting on single VPS/homelab nodes.\n\n## Decision\nEmbed SQLite with WAL mode inside PocketBase. Extend business logic using Go-based JS hooks in `app/pb_hooks/`.\n\n## Consequences\nExtreme performance, instant cold start, sub-50MB RAM footprint.",
                status: "accepted",
                confidence_score: 1.0,
                author_agent: "flomaster",
                tags: ["backend", "pocketbase", "sqlite", "architecture"]
            },
            {
                title: "ADR-003: 100% Free & Open-Source (MIT) with Zero Monetization",
                slug: "adr-003-foss-no-monetization",
                kind: "adr",
                summary: "Strict prohibition against Stripe, subscriptions, paid tiers, telemetry paywalls, or closed licensing.",
                content_markdown: "# ADR-003: 100% Free & Open-Source (MIT)\n\n## Status\nAccepted\n\n## Context\nCommercial issue trackers (Linear, Jira, Plane Enterprise) gate critical agent features behind enterprise paywalls.\n\n## Decision\nAll ProjectBase features remain 100% MIT FOSS forever.\n\n## Consequences\nEnforced via automated test gates and architectural invariants.",
                status: "accepted",
                confidence_score: 1.0,
                author_agent: "flomaster",
                tags: ["foss", "license", "governance", "invariants"]
            },
            {
                title: "ADR-004: Execution-Native FastMCP Agent Tools Protocol",
                slug: "adr-004-execution-native-fastmcp",
                kind: "adr",
                summary: "Expose JSON-RPC 2.0 FastMCP endpoints for Flomaster, Hermes, and Cursor agents to orchestrate tasks without human UI overhead.",
                content_markdown: "# ADR-004: FastMCP Protocol Integration\n\n## Status\nAccepted\n\n## Context\nAutonomous agents need deterministic programmatic primitives to read, mutate, and observe project state.\n\n## Decision\nProvide `/api/projectbase/mcp` endpoint implementing complete FastMCP schema specification.\n\n## Consequences\nUnified agent control across all tools.",
                status: "accepted",
                confidence_score: 1.0,
                author_agent: "flomaster",
                tags: ["mcp", "ai-agents", "tools", "protocol"]
            }
        ];

        let createdNodeIds = {};
        for (let a of adrs) {
            let rec = null;
            try {
                rec = e.app.findFirstRecordByData("knowledge_nodes", "slug", a.slug);
            } catch (_) {}
            if (!rec) {
                rec = new Record(nodeCol);
                rec.set("title", a.title);
                rec.set("slug", a.slug);
                rec.set("kind", a.kind);
                rec.set("summary", a.summary);
                rec.set("content_markdown", a.content_markdown);
                rec.set("status", a.status);
                rec.set("confidence_score", a.confidence_score);
                rec.set("author_agent", a.author_agent);
                rec.set("tags_json", a.tags);
                rec.set("metadata_json", { seeded: true });
                e.app.save(rec);
            }
            createdNodeIds[a.slug] = rec.id;
        }

        // Seed Core Subsystems
        const subsystems = [
            {
                title: "Subsystem: FastMCP Server Engine",
                slug: "subsystem-fastmcp-server",
                kind: "subsystem",
                summary: "JSON-RPC 2.0 tool execution bridge handling agent tool calls and workspace introspection.",
                file_path: "app/pb_hooks/91_mcp_server.pb.js",
                symbol_name: "handleFastMCPRpc",
                status: "active",
                confidence_score: 1.0,
                author_agent: "flomaster",
                tags: ["subsystem", "mcp", "backend"]
            },
            {
                title: "Subsystem: Incident War-Room & Live Post-Mortem",
                slug: "subsystem-incident-warroom",
                kind: "subsystem",
                summary: "Autonomous multi-agent live debugging, hypothesis falsification, and 5-Whys post-mortem engine.",
                file_path: "app/pb_hooks/115_incident_warroom_engine.pb.js",
                symbol_name: "declare_incident",
                status: "active",
                confidence_score: 1.0,
                author_agent: "flomaster",
                tags: ["subsystem", "incidents", "warroom"]
            }
        ];

        for (let sub of subsystems) {
            let rec = null;
            try {
                rec = e.app.findFirstRecordByData("knowledge_nodes", "slug", sub.slug);
            } catch (_) {}
            if (!rec) {
                rec = new Record(nodeCol);
                rec.set("title", sub.title);
                rec.set("slug", sub.slug);
                rec.set("kind", sub.kind);
                rec.set("summary", sub.summary);
                rec.set("file_path", sub.file_path);
                rec.set("symbol_name", sub.symbol_name);
                rec.set("status", sub.status);
                rec.set("confidence_score", sub.confidence_score);
                rec.set("author_agent", sub.author_agent);
                rec.set("tags_json", sub.tags);
                rec.set("metadata_json", { seeded: true });
                e.app.save(rec);
            }
            createdNodeIds[sub.slug] = rec.id;
        }

        // Seed 3 Architectural Invariants
        const invariants = [
            {
                rule_name: "Zero runtime npm packages in pb_public",
                rule_type: "path_pattern",
                pattern_expression: "forbidden:node_modules",
                severity: "p0_blocking",
                enforcement_action: "block_merge",
                is_active: true,
                node_id: createdNodeIds["adr-001-zero-build-vue"] || ""
            },
            {
                rule_name: "Strict prohibition against Stripe or paid paywalls",
                rule_type: "dependency_constraint",
                pattern_expression: "forbidden:stripe",
                severity: "p0_blocking",
                enforcement_action: "block_merge",
                is_active: true,
                node_id: createdNodeIds["adr-003-foss-no-monetization"] || ""
            },
            {
                rule_name: "Hardcoded API secret token scan guard",
                rule_type: "security_policy",
                pattern_expression: "forbidden:sk_live",
                severity: "p0_blocking",
                enforcement_action: "block_merge",
                is_active: true,
                node_id: ""
            }
        ];

        for (let inv of invariants) {
            let rec = null;
            try {
                rec = e.app.findFirstRecordByData("architectural_invariants", "rule_name", inv.rule_name);
            } catch (_) {}
            if (!rec) {
                rec = new Record(invCol);
                rec.set("rule_name", inv.rule_name);
                rec.set("rule_type", inv.rule_type);
                rec.set("pattern_expression", inv.pattern_expression);
                rec.set("severity", inv.severity);
                rec.set("enforcement_action", inv.enforcement_action);
                rec.set("is_active", inv.is_active);
                rec.set("node_id", inv.node_id);
                rec.set("metadata_json", { seeded: true });
                e.app.save(rec);
            }
        }

        // Seed Relations
        if (createdNodeIds["subsystem-fastmcp-server"] && createdNodeIds["adr-004-execution-native-fastmcp"]) {
            let rec = new Record(relCol);
            rec.set("source_node_id", createdNodeIds["subsystem-fastmcp-server"]);
            rec.set("target_node_id", createdNodeIds["adr-004-execution-native-fastmcp"]);
            rec.set("relation_type", "implements");
            rec.set("description", "FastMCP server hook implements ADR-004 specification");
            rec.set("weight", 1.0);
            e.app.save(rec);
        }

        return e.json(200, { success: true, message: "Demo architectural knowledge base seeded successfully." });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
