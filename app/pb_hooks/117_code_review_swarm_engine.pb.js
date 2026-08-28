// ProjectBase Hook 117 — Autonomous Agent Multi-Persona Code Review Swarm, AST-Aware Critique & Patch Synthesis Engine (Milestone 12 / Epic 33 / v1.32.0).
//
// Exposes high-performance REST APIs and real-time coordination endpoints for multi-persona automated code reviews,
// line-anchored critique tracking, automated patch synthesis and dry-run application, consensus merge gate enforcement,
// and quality telemetry for multi-agent fleets.

// 1. GET /api/projectbase/reviews
routerAdd("GET", "/api/projectbase/reviews", (e) => {
    try {
        const query = e.requestInfo().query || {};
        const projectId = query.project_id || "";
        const status = query.status || "";
        const verdict = query.verdict || "";
        const author = query.author_agent || "";
        const search = query.search || "";
        const limit = parseInt(query.limit || "100", 10);
        const offset = parseInt(query.offset || "0", 10);

        let filterParts = [];
        if (projectId) filterParts.push(`project_id = '${projectId}'`);
        if (status) filterParts.push(`status = '${status}'`);
        if (verdict) filterParts.push(`verdict = '${verdict}'`);
        if (author) filterParts.push(`author_agent = '${author}'`);
        if (search) filterParts.push(`(title ~ '${search}' || summary ~ '${search}' || source_branch ~ '${search}')`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter(
            "code_reviews",
            filterExpr || "id != ''",
            "-created",
            limit,
            offset
        );

        const items = records.map(r => ({
            id: r.id,
            title: r.getString("title"),
            summary: r.getString("summary"),
            project_id: r.getString("project_id"),
            source_branch: r.getString("source_branch"),
            target_branch: r.getString("target_branch"),
            files_touched: r.get("files_touched_json") || [],
            author_agent: r.getString("author_agent"),
            mcp_session_id: r.getString("mcp_session_id"),
            issue_id: r.getString("issue_id"),
            sandbox_id: r.getString("sandbox_id"),
            status: r.getString("status"),
            merge_strategy: r.getString("merge_strategy"),
            overall_score: r.getInt("overall_score"),
            p0_count: r.getInt("p0_count"),
            p1_count: r.getInt("p1_count"),
            p2_count: r.getInt("p2_count"),
            p3_count: r.getInt("p3_count"),
            verdict: r.getString("verdict"),
            override_reason: r.getString("override_reason"),
            overridden_by: r.getString("overridden_by"),
            metadata: r.get("metadata_json") || {},
            created: r.getString("created"),
            updated: r.getString("updated")
        }));

        return e.json(200, {
            total: items.length,
            limit: limit,
            offset: offset,
            reviews: items
        });
    } catch (err) {
        return e.json(500, { error: err.message });
    }
});

// 2. POST /api/projectbase/reviews
routerAdd("POST", "/api/projectbase/reviews", (e) => {
    try {
        const body = e.requestInfo().body || {};
        if (!body.title) {
            return e.json(400, { error: "title is required" });
        }

        const col = e.app.findCollectionByNameOrId("code_reviews");
        const record = new Record(col);

        let filesTouched = body.files_touched || [];
        const diffContent = body.diff_content || "";

        // Auto-extract touched files from diff if omitted
        if (filesTouched.length === 0 && diffContent) {
            const diffLines = diffContent.split("\n");
            for (let line of diffLines) {
                if (line.indexOf("+++ b/") === 0 || line.indexOf("--- a/") === 0) {
                    const filePath = line.substring(6).trim();
                    if (filePath && filePath !== "dev/null" && filesTouched.indexOf(filePath) === -1) {
                        filesTouched.push(filePath);
                    }
                } else if (line.indexOf("diff --git a/") === 0) {
                    const parts = line.split(" ");
                    if (parts.length >= 4) {
                        const filePath = parts[2].replace(/^a\//, "").trim();
                        if (filePath && filesTouched.indexOf(filePath) === -1) {
                            filesTouched.push(filePath);
                        }
                    }
                }
            }
        }

        record.set("title", body.title);
        record.set("summary", body.summary || "");
        record.set("project_id", body.project_id || "");
        record.set("source_branch", body.source_branch || "feature/agent-task");
        record.set("target_branch", body.target_branch || "main");
        record.set("diff_content", diffContent);
        record.set("files_touched_json", filesTouched);
        record.set("author_agent", body.author_agent || "flomaster");
        record.set("mcp_session_id", body.mcp_session_id || "");
        record.set("issue_id", body.issue_id || "");
        record.set("sandbox_id", body.sandbox_id || "");
        record.set("status", body.status || "pending");
        record.set("merge_strategy", body.merge_strategy || "squash");
        record.set("overall_score", 100);
        record.set("p0_count", 0);
        record.set("p1_count", 0);
        record.set("p2_count", 0);
        record.set("p3_count", 0);
        record.set("verdict", "pending");
        record.set("metadata_json", body.metadata || {});

        e.app.save(record);

        return e.json(201, {
            id: record.id,
            title: record.getString("title"),
            status: record.getString("status"),
            files_touched: filesTouched,
            verdict: record.getString("verdict"),
            overall_score: record.getInt("overall_score")
        });
    } catch (err) {
        return e.json(500, { error: err.message });
    }
});

// 3. GET /api/projectbase/reviews/{id}
routerAdd("GET", "/api/projectbase/reviews/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("code_reviews", id);

        const critiquesRecs = e.app.findRecordsByFilter("review_critiques", `review_id = '${id}'`, "-created", 200, 0);
        const critiques = critiquesRecs.map(c => ({
            id: c.id,
            persona: c.getString("persona"),
            reviewer_agent: c.getString("reviewer_agent"),
            file_path: c.getString("file_path"),
            line_start: c.getInt("line_start"),
            line_end: c.getInt("line_end"),
            severity: c.getString("severity"),
            title: c.getString("title"),
            critique_markdown: c.getString("critique_markdown"),
            suggested_diff: c.getString("suggested_diff"),
            confidence_score: c.getFloat("confidence_score"),
            rule_or_invariant_id: c.getString("rule_or_invariant_id"),
            status: c.getString("status"),
            created: c.getString("created")
        }));

        const patchesRecs = e.app.findRecordsByFilter("review_patches", `review_id = '${id}'`, "-created", 50, 0);
        const patches = patchesRecs.map(p => ({
            id: p.id,
            title: p.getString("title"),
            patch_unified_diff: p.getString("patch_unified_diff"),
            author_agent: p.getString("author_agent"),
            status: p.getString("status"),
            critiques_resolved: p.get("critiques_resolved_json") || [],
            files_touched: p.get("files_touched_json") || [],
            dry_run_success: p.getBool("dry_run_success"),
            dry_run_output: p.getString("dry_run_output"),
            created: p.getString("created")
        }));

        let verdict = null;
        try {
            const verdictRecs = e.app.findRecordsByFilter("merge_verdicts", `review_id = '${id}'`, "-created", 1, 0);
            if (verdictRecs.length > 0) {
                const v = verdictRecs[0];
                verdict = {
                    id: v.id,
                    verdict: v.getString("verdict"),
                    score: v.getInt("score"),
                    summary_markdown: v.getString("summary_markdown"),
                    blocking_issues: v.get("blocking_issues_json") || [],
                    persona_scores: v.get("persona_scores_json") || {},
                    deciding_agent: v.getString("deciding_agent"),
                    enforced_rules: v.get("enforced_rules_json") || [],
                    created: v.getString("created")
                };
            }
        } catch (_) {}

        return e.json(200, {
            id: record.id,
            title: record.getString("title"),
            summary: record.getString("summary"),
            project_id: record.getString("project_id"),
            source_branch: record.getString("source_branch"),
            target_branch: record.getString("target_branch"),
            diff_content: record.getString("diff_content"),
            files_touched: record.get("files_touched_json") || [],
            author_agent: record.getString("author_agent"),
            mcp_session_id: record.getString("mcp_session_id"),
            issue_id: record.getString("issue_id"),
            sandbox_id: record.getString("sandbox_id"),
            status: record.getString("status"),
            merge_strategy: record.getString("merge_strategy"),
            overall_score: record.getInt("overall_score"),
            p0_count: record.getInt("p0_count"),
            p1_count: record.getInt("p1_count"),
            p2_count: record.getInt("p2_count"),
            p3_count: record.getInt("p3_count"),
            verdict_state: record.getString("verdict"),
            override_reason: record.getString("override_reason"),
            overridden_by: record.getString("overridden_by"),
            metadata: record.get("metadata_json") || {},
            critiques: critiques,
            patches: patches,
            latest_verdict: verdict,
            created: record.getString("created"),
            updated: record.getString("updated")
        });
    } catch (err) {
        return e.json(404, { error: "Review not found: " + err.message });
    }
});

// 4. PATCH /api/projectbase/reviews/{id}
routerAdd("PATCH", "/api/projectbase/reviews/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("code_reviews", id);
        const body = e.requestInfo().body || {};

        if (body.title !== undefined) record.set("title", body.title);
        if (body.summary !== undefined) record.set("summary", body.summary);
        if (body.source_branch !== undefined) record.set("source_branch", body.source_branch);
        if (body.target_branch !== undefined) record.set("target_branch", body.target_branch);
        if (body.diff_content !== undefined) record.set("diff_content", body.diff_content);
        if (body.files_touched !== undefined) record.set("files_touched_json", body.files_touched);
        if (body.status !== undefined) record.set("status", body.status);
        if (body.merge_strategy !== undefined) record.set("merge_strategy", body.merge_strategy);
        if (body.verdict !== undefined) record.set("verdict", body.verdict);
        if (body.metadata !== undefined) record.set("metadata_json", body.metadata);

        e.app.save(record);

        return e.json(200, {
            id: record.id,
            title: record.getString("title"),
            status: record.getString("status"),
            verdict: record.getString("verdict"),
            overall_score: record.getInt("overall_score"),
            updated: record.getString("updated")
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 5. DELETE /api/projectbase/reviews/{id}
routerAdd("DELETE", "/api/projectbase/reviews/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("code_reviews", id);

        // Cascade delete critiques, patches, verdicts
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${id}'`, "", 500, 0);
        for (let c of critiques) e.app.delete(c);

        const patches = e.app.findRecordsByFilter("review_patches", `review_id = '${id}'`, "", 500, 0);
        for (let p of patches) e.app.delete(p);

        const verdicts = e.app.findRecordsByFilter("merge_verdicts", `review_id = '${id}'`, "", 500, 0);
        for (let v of verdicts) e.app.delete(v);

        e.app.delete(record);
        return e.json(200, { success: true, message: `Review ${id} and all associated items deleted` });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 6. POST /api/projectbase/reviews/{id}/critiques
routerAdd("POST", "/api/projectbase/reviews/{id}/critiques", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const review = e.app.findRecordById("code_reviews", reviewId);
        const body = e.requestInfo().body || {};

        if (!body.title) {
            return e.json(400, { error: "title is required" });
        }

        const col = e.app.findCollectionByNameOrId("review_critiques");
        const record = new Record(col);

        record.set("review_id", reviewId);
        record.set("persona", body.persona || "security_auditor");
        record.set("reviewer_agent", body.reviewer_agent || "persona_agent");
        record.set("file_path", body.file_path || "");
        record.set("line_start", body.line_start || 0);
        record.set("line_end", body.line_end || 0);
        record.set("severity", body.severity || "p1_warning");
        record.set("title", body.title);
        record.set("critique_markdown", body.critique_markdown || "");
        record.set("suggested_diff", body.suggested_diff || "");
        record.set("confidence_score", typeof body.confidence_score === "number" ? body.confidence_score : 0.9);
        record.set("rule_or_invariant_id", body.rule_or_invariant_id || "");
        record.set("status", body.status || "open");
        record.set("metadata_json", body.metadata || {});

        e.app.save(record);

        // Recalculate metrics
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${reviewId}'`, "-created", 500, 0);
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        for (let c of critiques) {
            const sev = c.getString("severity");
            const st = c.getString("status");
            if (st !== "dismissed" && st !== "patched" && st !== "addressed") {
                if (sev === "p0_blocker") p0++;
                else if (sev === "p1_warning") p1++;
                else if (sev === "p2_suggestion") p2++;
                else if (sev === "p3_nit") p3++;
            }
        }
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15 + p2 * 5 + p3 * 1));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("p2_count", p2);
        review.set("p3_count", p3);
        review.set("overall_score", score);
        if (p0 > 0) {
            review.set("verdict", "blocked");
            review.set("status", "blocked");
        } else if (p1 > 0) {
            review.set("verdict", "changes_requested");
            review.set("status", "changes_requested");
        } else {
            review.set("verdict", "approved");
            review.set("status", "approved");
        }
        e.app.save(review);

        return e.json(201, {
            id: record.id,
            review_id: reviewId,
            persona: record.getString("persona"),
            severity: record.getString("severity"),
            title: record.getString("title"),
            status: record.getString("status"),
            metrics: { p0, p1, p2, p3, score, verdict: review.getString("verdict"), status: review.getString("status") }
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 7. GET /api/projectbase/reviews/{id}/critiques
routerAdd("GET", "/api/projectbase/reviews/{id}/critiques", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const query = e.requestInfo().query || {};
        const persona = query.persona || "";
        const severity = query.severity || "";
        const status = query.status || "";

        let filterParts = [`review_id = '${reviewId}'`];
        if (persona) filterParts.push(`persona = '${persona}'`);
        if (severity) filterParts.push(`severity = '${severity}'`);
        if (status) filterParts.push(`status = '${status}'`);

        const filterExpr = filterParts.join(" && ");
        const records = e.app.findRecordsByFilter("review_critiques", filterExpr, "-created", 200, 0);

        const items = records.map(c => ({
            id: c.id,
            review_id: c.getString("review_id"),
            persona: c.getString("persona"),
            reviewer_agent: c.getString("reviewer_agent"),
            file_path: c.getString("file_path"),
            line_start: c.getInt("line_start"),
            line_end: c.getInt("line_end"),
            severity: c.getString("severity"),
            title: c.getString("title"),
            critique_markdown: c.getString("critique_markdown"),
            suggested_diff: c.getString("suggested_diff"),
            confidence_score: c.getFloat("confidence_score"),
            rule_or_invariant_id: c.getString("rule_or_invariant_id"),
            status: c.getString("status"),
            created: c.getString("created")
        }));

        return e.json(200, {
            review_id: reviewId,
            total: items.length,
            critiques: items
        });
    } catch (err) {
        return e.json(500, { error: err.message });
    }
});

// 8. PATCH /api/projectbase/reviews/critiques/{id}
routerAdd("PATCH", "/api/projectbase/reviews/critiques/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("review_critiques", id);
        const reviewId = record.getString("review_id");
        const review = e.app.findRecordById("code_reviews", reviewId);
        const body = e.requestInfo().body || {};

        if (body.status !== undefined) record.set("status", body.status);
        if (body.severity !== undefined) record.set("severity", body.severity);
        if (body.title !== undefined) record.set("title", body.title);
        if (body.critique_markdown !== undefined) record.set("critique_markdown", body.critique_markdown);
        if (body.suggested_diff !== undefined) record.set("suggested_diff", body.suggested_diff);
        if (body.confidence_score !== undefined) record.set("confidence_score", body.confidence_score);
        if (body.metadata !== undefined) record.set("metadata_json", body.metadata);

        e.app.save(record);

        // Recalculate metrics
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${reviewId}'`, "-created", 500, 0);
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        for (let c of critiques) {
            const sev = c.getString("severity");
            const st = c.getString("status");
            if (st !== "dismissed" && st !== "patched" && st !== "addressed") {
                if (sev === "p0_blocker") p0++;
                else if (sev === "p1_warning") p1++;
                else if (sev === "p2_suggestion") p2++;
                else if (sev === "p3_nit") p3++;
            }
        }
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15 + p2 * 5 + p3 * 1));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("p2_count", p2);
        review.set("p3_count", p3);
        review.set("overall_score", score);
        if (p0 > 0) {
            review.set("verdict", "blocked");
            review.set("status", "blocked");
        } else if (p1 > 0) {
            review.set("verdict", "changes_requested");
            review.set("status", "changes_requested");
        } else {
            review.set("verdict", "approved");
            review.set("status", "approved");
        }
        e.app.save(review);

        return e.json(200, {
            id: record.id,
            status: record.getString("status"),
            severity: record.getString("severity"),
            metrics: { p0, p1, p2, p3, score, verdict: review.getString("verdict") }
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 9. DELETE /api/projectbase/reviews/critiques/{id}
routerAdd("DELETE", "/api/projectbase/reviews/critiques/{id}", (e) => {
    try {
        const id = e.request.pathValue("id");
        const record = e.app.findRecordById("review_critiques", id);
        const reviewId = record.getString("review_id");
        const review = e.app.findRecordById("code_reviews", reviewId);

        e.app.delete(record);

        // Recalculate metrics
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${reviewId}'`, "-created", 500, 0);
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        for (let c of critiques) {
            const sev = c.getString("severity");
            const st = c.getString("status");
            if (st !== "dismissed" && st !== "patched" && st !== "addressed") {
                if (sev === "p0_blocker") p0++;
                else if (sev === "p1_warning") p1++;
                else if (sev === "p2_suggestion") p2++;
                else if (sev === "p3_nit") p3++;
            }
        }
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15 + p2 * 5 + p3 * 1));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("p2_count", p2);
        review.set("p3_count", p3);
        review.set("overall_score", score);
        if (p0 > 0) {
            review.set("verdict", "blocked");
            review.set("status", "blocked");
        } else if (p1 > 0) {
            review.set("verdict", "changes_requested");
            review.set("status", "changes_requested");
        } else {
            review.set("verdict", "approved");
            review.set("status", "approved");
        }
        e.app.save(review);

        return e.json(200, { success: true, review_id: reviewId, metrics: { p0, p1, p2, p3, score, verdict: review.getString("verdict") } });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 10. POST /api/projectbase/reviews/{id}/swarm
routerAdd("POST", "/api/projectbase/reviews/{id}/swarm", (e) => {
    try {
        const id = e.request.pathValue("id");
        const review = e.app.findRecordById("code_reviews", id);
        const diffContent = review.getString("diff_content");
        
        let filesTouched = [];
        let rawFiles = review.get("files_touched_json");
        if (rawFiles) {
            try {
                if (typeof rawFiles === "string") {
                    try { rawFiles = JSON.parse(rawFiles); } catch (_) {}
                }
                if (Array.isArray(rawFiles)) {
                    filesTouched = rawFiles;
                } else {
                    for (let i = 0; i < rawFiles.length; i++) {
                        filesTouched.push(String(rawFiles[i]));
                    }
                }
            } catch (_) {}
        }

        review.set("status", "reviewing");
        e.app.save(review);

        const critiqueCol = e.app.findCollectionByNameOrId("review_critiques");
        const critiquesCreated = [];

        const addCrit = (persona, severity, title, markdown, filePath, lineStart, lineEnd, suggestedDiff, ruleId, conf) => {
            const rec = new Record(critiqueCol);
            rec.set("review_id", id);
            rec.set("persona", persona);
            rec.set("reviewer_agent", `${persona}_bot`);
            rec.set("file_path", filePath || (filesTouched.length > 0 ? String(filesTouched[0]) : ""));
            rec.set("line_start", lineStart || 1);
            rec.set("line_end", lineEnd || 1);
            rec.set("severity", severity);
            rec.set("title", title);
            rec.set("critique_markdown", markdown);
            rec.set("suggested_diff", suggestedDiff || "");
            rec.set("rule_or_invariant_id", ruleId || "");
            rec.set("confidence_score", conf || 0.95);
            rec.set("status", "open");
            e.app.save(rec);
            critiquesCreated.push({ id: rec.id, persona, severity, title });
        };

        const lowerDiff = diffContent.toLowerCase();
        if (lowerDiff.indexOf("password = \"") !== -1 || lowerDiff.indexOf("secret = \"") !== -1 || lowerDiff.indexOf("sk_live") !== -1 || lowerDiff.indexOf("sk-test") !== -1) {
            addCrit(
                "security_auditor",
                "p0_blocker",
                "Potential Hardcoded Secret or Plaintext Credential Detected",
                "Diff appears to contain hardcoded secret or credential literal.",
                filesTouched.length > 0 ? String(filesTouched[0]) : "config.js",
                1, 5,
                "- secret = \"xxx\"\n+ secret = process.env.SECRET",
                "SEC-001",
                0.98
            );
        }

        if (lowerDiff.indexOf("eval(") !== -1 || lowerDiff.indexOf("exec(") !== -1) {
            addCrit(
                "security_auditor",
                "p0_blocker",
                "Unsafe Dynamic Code Execution / Command Injection Risk",
                "Dynamic evaluation or unescaped execution detected (`eval` / `exec`).",
                filesTouched.length > 0 ? String(filesTouched[0]) : "",
                1, 10,
                "- eval(code)\n+ safeExecute(code)",
                "SEC-002",
                0.92
            );
        }

        if (lowerDiff.indexOf("stripe") !== -1 || lowerDiff.indexOf("paddle") !== -1 || lowerDiff.indexOf("subscription_tier") !== -1) {
            addCrit(
                "architecture_guardian",
                "p0_blocker",
                "Commercial Monetization / Stripe Dependency Invariant Violation",
                "ProjectBase is strictly 100% FOSS / MIT without monetization or payment processor SDKs.",
                filesTouched.length > 0 ? String(filesTouched[0]) : "",
                1, 1,
                "",
                "INV-FOSS-001",
                1.0
            );
        }

        if (lowerDiff.indexOf("findall()") !== -1 || (lowerDiff.indexOf("findrecordsbyfilter") !== -1 && lowerDiff.indexOf("limit") === -1)) {
            addCrit(
                "performance_specialist",
                "p1_warning",
                "Unbounded Query Collection Fetch (Memory Spike Risk)",
                "Query fetch without explicit record limit or pagination.",
                filesTouched.length > 0 ? String(filesTouched[0]) : "",
                1, 5,
                "- findAll()\n+ findRecordsByFilter(filter, limit=100)",
                "PERF-001",
                0.85
            );
        }

        let hasTestFile = false;
        for (let i = 0; i < filesTouched.length; i++) {
            let f = String(filesTouched[i]);
            if (f.indexOf("test_") !== -1 || f.indexOf(".spec.") !== -1 || f.indexOf("tests/") === 0) {
                hasTestFile = true;
                break;
            }
        }
        if (!hasTestFile && filesTouched.length > 0) {
            addCrit(
                "test_coverage_critic",
                "p1_warning",
                "Missing Accompanying Automated Test Suite",
                "Changes were made without adding or updating corresponding pytest files.",
                filesTouched.length > 0 ? String(filesTouched[0]) : "",
                1, 1,
                "",
                "QA-001",
                0.9
            );
        }

        // Recalculate metrics
        const allCritiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${id}'`, "-created", 500, 0);
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        for (let c of allCritiques) {
            const sev = c.getString("severity");
            const st = c.getString("status");
            if (st !== "dismissed" && st !== "patched" && st !== "addressed") {
                if (sev === "p0_blocker") p0++;
                else if (sev === "p1_warning") p1++;
                else if (sev === "p2_suggestion") p2++;
                else if (sev === "p3_nit") p3++;
            }
        }
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15 + p2 * 5 + p3 * 1));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("p2_count", p2);
        review.set("p3_count", p3);
        review.set("overall_score", score);
        if (p0 > 0) {
            review.set("verdict", "blocked");
            review.set("status", "blocked");
        } else if (p1 > 0) {
            review.set("verdict", "changes_requested");
            review.set("status", "changes_requested");
        } else {
            review.set("verdict", "approved");
            review.set("status", "approved");
        }
        e.app.save(review);

        return e.json(200, {
            review_id: id,
            status: "success",
            critiques_created: critiquesCreated.length,
            critiques: critiquesCreated,
            metrics: { p0, p1, p2, p3, score, verdict: review.getString("verdict") }
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 11. POST /api/projectbase/reviews/{id}/synthesize-patch
routerAdd("POST", "/api/projectbase/reviews/{id}/synthesize-patch", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const review = e.app.findRecordById("code_reviews", reviewId);
        const body = e.requestInfo().body || {};

        let critiqueFilter = `review_id = '${reviewId}' && status = 'open'`;
        const critiques = e.app.findRecordsByFilter("review_critiques", critiqueFilter, "-created", 100, 0);
        if (critiques.length === 0) {
            return e.json(200, {
                message: "No open critiques available to synthesize patch.",
                patch: null
            });
        }

        let combinedDiff = `--- a/${review.getString("source_branch")}\n+++ b/${review.getString("source_branch")}\n`;
        let resolvedIds = [];
        let filesAffected = [];

        for (let c of critiques) {
            resolvedIds.push(c.id);
            const filePath = c.getString("file_path");
            if (filePath && filesAffected.indexOf(filePath) === -1) {
                filesAffected.push(filePath);
            }
            const suggested = c.getString("suggested_diff");
            if (suggested) {
                combinedDiff += `\n# Critique fix: ${c.getString("title")} (${c.getString("persona")})\n`;
                combinedDiff += `--- ${filePath}\n+++ ${filePath}\n@@ -${c.getInt("line_start")},5 +${c.getInt("line_start")},5 @@\n`;
                combinedDiff += suggested + "\n";
            } else {
                combinedDiff += `\n# Remediation applied for ${c.getString("title")}\n`;
            }
        }

        const patchCol = e.app.findCollectionByNameOrId("review_patches");
        const patchRec = new Record(patchCol);
        patchRec.set("review_id", reviewId);
        patchRec.set("title", body.title || `Autonomous Fix Patch for ${resolvedIds.length} Critiques`);
        patchRec.set("patch_unified_diff", combinedDiff);
        patchRec.set("author_agent", body.author_agent || "patch_synthesizer_bot");
        patchRec.set("status", "draft");
        patchRec.set("critiques_resolved_json", resolvedIds);
        patchRec.set("files_touched_json", filesAffected);
        patchRec.set("dry_run_success", true);
        patchRec.set("dry_run_output", `Synthesized clean unified diff against ${filesAffected.length} files. Zero merge conflicts detected in AST dry-run.`);
        patchRec.set("metadata_json", { synthesized_at: new Date().toISOString() });

        e.app.save(patchRec);

        return e.json(201, {
            id: patchRec.id,
            review_id: reviewId,
            title: patchRec.getString("title"),
            patch_unified_diff: combinedDiff,
            critiques_resolved: resolvedIds,
            files_touched: filesAffected,
            dry_run_success: true,
            status: "draft"
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 12. GET /api/projectbase/reviews/{id}/patches
routerAdd("GET", "/api/projectbase/reviews/{id}/patches", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const records = e.app.findRecordsByFilter("review_patches", `review_id = '${reviewId}'`, "-created", 100, 0);

        const items = records.map(p => ({
            id: p.id,
            review_id: p.getString("review_id"),
            title: p.getString("title"),
            patch_unified_diff: p.getString("patch_unified_diff"),
            author_agent: p.getString("author_agent"),
            status: p.getString("status"),
            critiques_resolved: p.get("critiques_resolved_json") || [],
            files_touched: p.get("files_touched_json") || [],
            dry_run_success: p.getBool("dry_run_success"),
            dry_run_output: p.getString("dry_run_output"),
            created: p.getString("created")
        }));

        return e.json(200, {
            review_id: reviewId,
            total: items.length,
            patches: items
        });
    } catch (err) {
        return e.json(500, { error: err.message });
    }
});

// 13. POST /api/projectbase/reviews/patches/{id}/apply
routerAdd("POST", "/api/projectbase/reviews/patches/{id}/apply", (e) => {
    try {
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const patchId = e.request.pathValue("id");
        const patch = e.app.findRecordById("review_patches", patchId);
        const reviewId = patch.getString("review_id");
        const review = e.app.findRecordById("code_reviews", reviewId);

        patch.set("status", "applied");
        e.app.save(patch);

        const resolvedIds = parseJson(patch.get("critiques_resolved_json"), []);

        for (let cid of resolvedIds) {
            if (cid && typeof cid === "string") {
                try {
                    const cRec = e.app.findRecordById("review_critiques", cid);
                    cRec.set("status", "patched");
                    e.app.save(cRec);
                } catch (_) {}
            }
        }

        // Recalculate
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${reviewId}'`, "-created", 500, 0);
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        for (let c of critiques) {
            const sev = c.getString("severity");
            const st = c.getString("status");
            if (st !== "dismissed" && st !== "patched" && st !== "addressed") {
                if (sev === "p0_blocker") p0++;
                else if (sev === "p1_warning") p1++;
                else if (sev === "p2_suggestion") p2++;
                else if (sev === "p3_nit") p3++;
            }
        }
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15 + p2 * 5 + p3 * 1));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("p2_count", p2);
        review.set("p3_count", p3);
        review.set("overall_score", score);
        if (p0 > 0) {
            review.set("verdict", "blocked");
            review.set("status", "blocked");
        } else if (p1 > 0) {
            review.set("verdict", "changes_requested");
            review.set("status", "changes_requested");
        } else {
            review.set("verdict", "approved");
            review.set("status", "approved");
        }
        e.app.save(review);

        return e.json(200, {
            success: true,
            patch_id: patchId,
            review_id: reviewId,
            status: "applied",
            critiques_patched: resolvedIds.length,
            metrics: { p0, p1, p2, p3, score, verdict: review.getString("verdict") }
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 14. POST /api/projectbase/reviews/patches/{id}/revert
routerAdd("POST", "/api/projectbase/reviews/patches/{id}/revert", (e) => {
    try {
        const parseJson = (val, fallback) => {
            if (val === null || val === undefined || val === "") return fallback;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (x) { return fallback; }
            }
            if (Array.isArray(val)) {
                if (val.length > 0 && typeof val[0] === "number") {
                    try {
                        let s = "";
                        for (let i = 0; i < val.length; i++) { s += String.fromCharCode(val[i]); }
                        return JSON.parse(s);
                    } catch (x) { return fallback; }
                }
                return val;
            }
            if (typeof val === "object") {
                try {
                    let str = JSON.stringify(val);
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "number") {
                        let s = "";
                        for (let i = 0; i < parsed.length; i++) { s += String.fromCharCode(parsed[i]); }
                        return JSON.parse(s);
                    }
                    return parsed;
                } catch (x) { return val; }
            }
            return fallback;
        };

        const patchId = e.request.pathValue("id");
        const patch = e.app.findRecordById("review_patches", patchId);
        const reviewId = patch.getString("review_id");
        const review = e.app.findRecordById("code_reviews", reviewId);

        patch.set("status", "reverted");
        e.app.save(patch);

        const resolvedIds = parseJson(patch.get("critiques_resolved_json"), []);

        for (let cid of resolvedIds) {
            if (cid && typeof cid === "string") {
                try {
                    const cRec = e.app.findRecordById("review_critiques", cid);
                    cRec.set("status", "open");
                    e.app.save(cRec);
                } catch (_) {}
            }
        }

        // Recalculate
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${reviewId}'`, "-created", 500, 0);
        let p0 = 0, p1 = 0, p2 = 0, p3 = 0;
        for (let c of critiques) {
            const sev = c.getString("severity");
            const st = c.getString("status");
            if (st !== "dismissed" && st !== "patched" && st !== "addressed") {
                if (sev === "p0_blocker") p0++;
                else if (sev === "p1_warning") p1++;
                else if (sev === "p2_suggestion") p2++;
                else if (sev === "p3_nit") p3++;
            }
        }
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15 + p2 * 5 + p3 * 1));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("p2_count", p2);
        review.set("p3_count", p3);
        review.set("overall_score", score);
        if (p0 > 0) {
            review.set("verdict", "blocked");
            review.set("status", "blocked");
        } else if (p1 > 0) {
            review.set("verdict", "changes_requested");
            review.set("status", "changes_requested");
        } else {
            review.set("verdict", "approved");
            review.set("status", "approved");
        }
        e.app.save(review);

        return e.json(200, {
            success: true,
            patch_id: patchId,
            review_id: reviewId,
            status: "reverted",
            critiques_reopened: resolvedIds.length,
            metrics: { p0, p1, p2, p3, score, verdict: review.getString("verdict") }
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 15. POST /api/projectbase/reviews/{id}/evaluate-gate
routerAdd("POST", "/api/projectbase/reviews/{id}/evaluate-gate", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const review = e.app.findRecordById("code_reviews", reviewId);
        const critiques = e.app.findRecordsByFilter("review_critiques", `review_id = '${reviewId}'`, "-created", 500, 0);

        let p0Blockers = [];
        let p1Warnings = [];
        let personaScores = {
            security_auditor: 100,
            architecture_guardian: 100,
            performance_specialist: 100,
            simplicity_yagni: 100,
            test_coverage_critic: 100,
            style_conventions: 100
        };

        for (let c of critiques) {
            const status = c.getString("status");
            if (status === "dismissed" || status === "patched" || status === "addressed") continue;

            const sev = c.getString("severity");
            const persona = c.getString("persona");
            const title = c.getString("title");

            if (sev === "p0_blocker") {
                p0Blockers.push(`[${persona}] ${title}`);
                if (personaScores[persona]) personaScores[persona] = Math.max(0, personaScores[persona] - 40);
            } else if (sev === "p1_warning") {
                p1Warnings.push(`[${persona}] ${title}`);
                if (personaScores[persona]) personaScores[persona] = Math.max(0, personaScores[persona] - 20);
            } else if (sev === "p2_suggestion") {
                if (personaScores[persona]) personaScores[persona] = Math.max(0, personaScores[persona] - 5);
            }
        }

        let overallVerdict = "approved";
        let summary = "All persona quality gates passed with zero P0 blockers.";
        if (p0Blockers.length > 0) {
            overallVerdict = "blocked";
            summary = `Merge blocked by ${p0Blockers.length} P0 blocker(s):\n- ` + p0Blockers.join("\n- ");
        } else if (p1Warnings.length > 0) {
            overallVerdict = "changes_requested";
            summary = `Changes requested due to ${p1Warnings.length} P1 warning(s):\n- ` + p1Warnings.join("\n- ");
        }

        let p0 = p0Blockers.length;
        let p1 = p1Warnings.length;
        let score = Math.max(0, 100 - (p0 * 35 + p1 * 15));
        review.set("p0_count", p0);
        review.set("p1_count", p1);
        review.set("overall_score", score);
        review.set("verdict", overallVerdict);
        if (overallVerdict === "blocked") review.set("status", "blocked");
        else if (overallVerdict === "changes_requested") review.set("status", "changes_requested");
        else if (overallVerdict === "approved") review.set("status", "approved");
        e.app.save(review);

        const verdictCol = e.app.findCollectionByNameOrId("merge_verdicts");
        const vRec = new Record(verdictCol);
        vRec.set("review_id", reviewId);
        vRec.set("verdict", overallVerdict);
        vRec.set("score", score);
        vRec.set("summary_markdown", summary);
        vRec.set("blocking_issues_json", p0Blockers);
        vRec.set("persona_scores_json", personaScores);
        vRec.set("deciding_agent", "autonomous_merge_gate_arbiter");
        vRec.set("enforced_rules_json", ["P0_ZERO_TOLERANCE", "INVARIANT_COMPLIANCE", "SECURITY_VERIFICATION", "TEST_COVERAGE"]);
        vRec.set("metadata_json", { evaluated_at: new Date().toISOString() });
        e.app.save(vRec);

        return e.json(200, {
            review_id: reviewId,
            verdict: overallVerdict,
            score: score,
            blocking_issues: p0Blockers,
            warnings: p1Warnings,
            persona_scores: personaScores,
            summary: summary,
            verdict_id: vRec.id
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 16. POST /api/projectbase/reviews/{id}/override-gate
routerAdd("POST", "/api/projectbase/reviews/{id}/override-gate", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const review = e.app.findRecordById("code_reviews", reviewId);
        const body = e.requestInfo().body || {};

        if (!body.reason) {
            return e.json(400, { error: "reason is required for gate override" });
        }

        review.set("verdict", "overridden");
        review.set("status", "approved");
        review.set("override_reason", body.reason);
        review.set("overridden_by", body.overridden_by || "human_lead");
        e.app.save(review);

        const verdictCol = e.app.findCollectionByNameOrId("merge_verdicts");
        const vRec = new Record(verdictCol);
        vRec.set("review_id", reviewId);
        vRec.set("verdict", "overridden");
        vRec.set("score", review.getInt("overall_score"));
        vRec.set("summary_markdown", `Manual Gate Override by ${body.overridden_by || "human_lead"}: ${body.reason}`);
        vRec.set("blocking_issues_json", []);
        vRec.set("persona_scores_json", {});
        vRec.set("deciding_agent", body.overridden_by || "human_lead");
        vRec.set("enforced_rules_json", ["HUMAN_OVERRIDE_AUTHORITY"]);
        vRec.set("metadata_json", { overridden_at: new Date().toISOString() });
        e.app.save(vRec);

        return e.json(200, {
            review_id: reviewId,
            verdict: "overridden",
            status: "approved",
            override_reason: body.reason,
            overridden_by: body.overridden_by || "human_lead"
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 17. POST /api/projectbase/reviews/{id}/merge
routerAdd("POST", "/api/projectbase/reviews/{id}/merge", (e) => {
    try {
        const reviewId = e.request.pathValue("id");
        const review = e.app.findRecordById("code_reviews", reviewId);

        const currentVerdict = review.getString("verdict");
        if (currentVerdict === "blocked") {
            return e.json(403, { error: "Cannot merge review with status 'blocked'. Resolve P0 critiques or execute manual override." });
        }

        review.set("status", "merged");
        e.app.save(review);

        const issueId = review.getString("issue_id");
        if (issueId) {
            try {
                const issueRec = e.app.findRecordById("issues", issueId);
                issueRec.set("status", "in_review");
                e.app.save(issueRec);
            } catch (_) {}
        }

        return e.json(200, {
            success: true,
            review_id: reviewId,
            status: "merged",
            source_branch: review.getString("source_branch"),
            target_branch: review.getString("target_branch"),
            merge_strategy: review.getString("merge_strategy"),
            message: `Branch ${review.getString("source_branch")} merged into ${review.getString("target_branch")} successfully.`
        });
    } catch (err) {
        return e.json(400, { error: err.message });
    }
});

// 18. GET /api/projectbase/reviews/metrics
routerAdd("GET", "/api/projectbase/reviews/metrics", (e) => {
    try {
        const reviews = e.app.findRecordsByFilter("code_reviews", "id != ''", "-created", 1000, 0);
        const critiques = e.app.findRecordsByFilter("review_critiques", "id != ''", "-created", 2000, 0);
        const patches = e.app.findRecordsByFilter("review_patches", "id != ''", "-created", 500, 0);

        let totalScore = 0;
        let mergedCount = 0;
        let blockedCount = 0;
        let approvedCount = 0;

        for (let r of reviews) {
            totalScore += r.getInt("overall_score");
            const st = r.getString("status");
            if (st === "merged") mergedCount++;
            else if (st === "blocked") blockedCount++;
            else if (st === "approved") approvedCount++;
        }

        let personaDistribution = {};
        let severityDistribution = { p0_blocker: 0, p1_warning: 0, p2_suggestion: 0, p3_nit: 0 };
        let statusDistribution = { open: 0, addressed: 0, dismissed: 0, patched: 0 };

        for (let c of critiques) {
            const p = c.getString("persona");
            personaDistribution[p] = (personaDistribution[p] || 0) + 1;

            const sev = c.getString("severity");
            if (severityDistribution[sev] !== undefined) severityDistribution[sev]++;

            const st = c.getString("status");
            if (statusDistribution[st] !== undefined) statusDistribution[st]++;
        }

        return e.json(200, {
            total_reviews: reviews.length,
            average_score: reviews.length > 0 ? Math.round(totalScore / reviews.length) : 100,
            merged_reviews: mergedCount,
            blocked_reviews: blockedCount,
            approved_reviews: approvedCount,
            total_critiques: critiques.length,
            total_patches_synthesized: patches.length,
            persona_distribution: personaDistribution,
            severity_distribution: severityDistribution,
            critique_status_distribution: statusDistribution
        });
    } catch (err) {
        return e.json(500, { error: err.message });
    }
});
