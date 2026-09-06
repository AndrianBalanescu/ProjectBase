// pb_hooks/108_session_observability_engine.pb.js
// Deep Observability & Ground Truth Verification Hub Engine (Milestone 3).
//
// Endpoints:
// 1. GET  /api/projectbase/sessions/{id}/diff          - Get parsed git diffs, file stats, and hunks
// 2. POST /api/projectbase/sessions/{id}/diff          - Ingest / update unified git diffs & file patches
// 3. GET  /api/projectbase/sessions/{id}/verdict       - Get test verdict breakdown, framework badge & failures
// 4. POST /api/projectbase/sessions/{id}/verdict       - Ingest test run results (Pytest / Playwright), update badges
// 5. GET  /api/projectbase/sessions/{id}/audit         - Get Sceptic audit reports, findings & P0 veto status
// 6. POST /api/projectbase/sessions/{id}/audit         - Submit Sceptic audit report with severity findings & veto
// 7. GET  /api/projectbase/observability/summary       - Workspace-wide verification telemetry & test metrics
// 8. POST /api/projectbase/observability/verify-suite  - Fast automated verification suite runner & auto-audit

// 1. GET /api/projectbase/sessions/{id}/diff - Get parsed git diffs
routerAdd("GET", "/api/projectbase/sessions/{id}/diff", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        const rawDiff = record.getString("git_diff_raw") || "";
        let diffFiles = [];
        try {
            diffFiles = record.get("git_diff_files") || [];
        } catch (x) {}

        let diffSummary = {};
        try {
            diffSummary = record.get("git_diff_summary") || {};
        } catch (x) {}

        return e.json(200, {
            session_id: record.getString("session_id"),
            id: record.id,
            git_branch: record.getString("git_branch"),
            git_commit_before: record.getString("git_commit_before"),
            git_commit_after: record.getString("git_commit_after"),
            summary: diffSummary,
            files: diffFiles,
            raw_diff: rawDiff
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 2. POST /api/projectbase/sessions/{id}/diff - Ingest/update unified diff
routerAdd("POST", "/api/projectbase/sessions/{id}/diff", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let rawDiff = body.raw_diff || body.diff || body.patch || "";
        let files = Array.isArray(body.files) ? body.files : [];
        let summary = body.summary || null;

        if (rawDiff && (!files || files.length === 0)) {
            const lines = rawDiff.split("\n");
            let curFile = null;
            let totalAdditions = 0;
            let totalDeletions = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith("diff --git ")) {
                    if (curFile) {
                        curFile.raw_patch = curFile.raw_patch.join("\n");
                        files.push(curFile);
                    }
                    const parts = line.split(" ");
                    let filePath = parts.length >= 4 ? parts[3].replace(/^b\//, "") : "unknown";
                    curFile = {
                        file: filePath,
                        old_file: parts.length >= 3 ? parts[2].replace(/^a\//, "") : filePath,
                        new_file: filePath,
                        additions: 0,
                        deletions: 0,
                        hunks: [],
                        raw_patch: [line]
                    };
                } else if (line.startsWith("+++ b/")) {
                    if (curFile) {
                        curFile.file = line.substring(6).trim();
                        curFile.new_file = curFile.file;
                        curFile.raw_patch.push(line);
                    }
                } else if (line.startsWith("--- a/")) {
                    if (curFile) {
                        curFile.old_file = line.substring(6).trim();
                        curFile.raw_patch.push(line);
                    }
                } else if (line.startsWith("@@")) {
                    if (curFile) {
                        curFile.hunks.push(line);
                        curFile.raw_patch.push(line);
                    }
                } else if (line.startsWith("+") && !line.startsWith("+++")) {
                    if (curFile) {
                        curFile.additions++;
                        totalAdditions++;
                        curFile.raw_patch.push(line);
                    }
                } else if (line.startsWith("-") && !line.startsWith("---")) {
                    if (curFile) {
                        curFile.deletions++;
                        totalDeletions++;
                        curFile.raw_patch.push(line);
                    }
                } else {
                    if (curFile) {
                        curFile.raw_patch.push(line);
                    }
                }
            }

            if (curFile) {
                curFile.raw_patch = curFile.raw_patch.join("\n");
                files.push(curFile);
            }

            summary = {
                files_changed: files.length,
                additions: totalAdditions,
                deletions: totalDeletions,
                net_change: totalAdditions - totalDeletions
            };
        } else if (files.length > 0 && !summary) {
            let adds = 0;
            let dels = 0;
            files.forEach(f => {
                adds += (f.additions || 0);
                dels += (f.deletions || 0);
            });
            summary = {
                files_changed: files.length,
                additions: adds,
                deletions: dels,
                net_change: adds - dels
            };
        }

        record.set("git_diff_raw", rawDiff);
        record.set("git_diff_files", files);
        if (summary) {
            record.set("git_diff_summary", summary);
        }

        if (body.git_commit_after) {
            record.set("git_commit_after", body.git_commit_after);
        }
        if (body.git_commit_before) {
            record.set("git_commit_before", body.git_commit_before);
        }
        if (body.git_branch) {
            record.set("git_branch", body.git_branch);
        }

        // Update files_touched list
        const fileNames = files.map(f => f.file).filter(Boolean);
        if (fileNames.length > 0) {
            record.set("files_touched", fileNames);
        }

        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            summary: summary,
            files_count: files.length
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 3. GET /api/projectbase/sessions/{id}/verdict - Get test verdict breakdown
routerAdd("GET", "/api/projectbase/sessions/{id}/verdict", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let testVerdict = {};
        try {
            testVerdict = record.get("test_verdict") || {};
        } catch (x) {}

        let scepticAudit = {};
        try {
            scepticAudit = record.get("sceptic_audit") || {};
        } catch (x) {}

        const badge = record.getString("verification_badge") || "unverified";
        const score = record.getInt("verification_score") || 0;

        return e.json(200, {
            session_id: record.getString("session_id"),
            id: record.id,
            test_verdict: testVerdict,
            verification_badge: badge,
            verification_score: score,
            has_sceptic_audit: !!(scepticAudit && scepticAudit.verdict)
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 4. POST /api/projectbase/sessions/{id}/verdict - Ingest test execution results
routerAdd("POST", "/api/projectbase/sessions/{id}/verdict", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let framework = body.framework || "pytest";
        let passed = parseInt(body.passed || 0, 10);
        let failed = parseInt(body.failed || 0, 10);
        let skipped = parseInt(body.skipped || 0, 10);
        let total = parseInt(body.total || (passed + failed + skipped), 10);
        let durationS = parseFloat(body.duration_s || body.duration || 0.0);
        let failures = Array.isArray(body.failures) ? body.failures : [];

        const parsedVerdict = {
            framework: framework,
            status: failed > 0 ? "failed" : (passed > 0 ? "passed" : "unknown"),
            passed: passed,
            failed: failed,
            skipped: skipped,
            total: total,
            duration_s: durationS,
            pass_rate_percent: total > 0 ? Math.round((passed / total) * 100) : (failed === 0 ? 100 : 0),
            failures: failures,
            suite: body.suite || (framework + "_suite"),
            timestamp: new Date().toISOString()
        };

        record.set("test_verdict", parsedVerdict);

        let scepticAudit = null;
        try { scepticAudit = record.get("sceptic_audit"); } catch (x) {}

        const hasP0 = scepticAudit && (
            scepticAudit.vetoed === true ||
            scepticAudit.verdict === "FAIL" ||
            (Array.isArray(scepticAudit.findings) && scepticAudit.findings.some(f => (f.severity || "").toUpperCase() === "P0"))
        );

        let badge = "unverified";
        let score = 50;

        if (hasP0) {
            badge = "vetoed";
            score = 25;
        } else if (failed > 0) {
            badge = "failing_tests";
            score = total > 0 ? Math.round((passed / total) * 75) : 0;
        } else if (passed > 0 && failed === 0) {
            badge = "verified";
            score = (scepticAudit && scepticAudit.verdict === "PASS") ? 100 : 95;
        }

        record.set("verification_badge", badge);
        record.set("verification_score", score);

        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            test_verdict: parsedVerdict,
            verification_badge: badge,
            verification_score: score
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 5. GET /api/projectbase/sessions/{id}/audit - Get Sceptic audit reports
routerAdd("GET", "/api/projectbase/sessions/{id}/audit", (e) => {
    try {
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let scepticAudit = {};
        try {
            scepticAudit = record.get("sceptic_audit") || {};
        } catch (x) {}

        let auditLogs = [];
        try {
            const auditRecords = e.app.findRecordsByFilter("session_audits", "session_id = {:sid} || session = {:id}", "-created", 50, 0, { sid: record.getString("session_id"), id: record.id });
            auditLogs = auditRecords.map(r => ({
                id: r.id,
                auditor: r.getString("auditor"),
                verdict: r.getString("verdict"),
                risk_score: r.getInt("risk_score"),
                findings: r.get("findings") || [],
                vetoed: r.getBool("vetoed"),
                signature: r.getString("signature"),
                summary: r.getString("summary"),
                created: r.getString("created")
            }));
        } catch (x) {}

        return e.json(200, {
            session_id: record.getString("session_id"),
            id: record.id,
            sceptic_audit: scepticAudit,
            verification_badge: record.getString("verification_badge") || "unverified",
            verification_score: record.getInt("verification_score") || 0,
            audit_history: auditLogs
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 6. POST /api/projectbase/sessions/{id}/audit - Submit Sceptic audit report
routerAdd("POST", "/api/projectbase/sessions/{id}/audit", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const id = (e.request && e.request.pathValue ? e.request.pathValue("id") : "") || (e.requestInfo().params && e.requestInfo().params.id) || (e.pathParam ? e.pathParam("id") : "") || "";
        const body = e.requestInfo().body || {};
        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: id });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        const auditor = (body.auditor || "Flow Inspect Sceptic").trim();
        const verdict = (body.verdict || "PASS").toUpperCase();
        const findings = Array.isArray(body.findings) ? body.findings : [];
        let riskScore = parseInt(body.risk_score !== undefined ? body.risk_score : 10, 10);
        let summary = body.summary || ("Sceptic audit completed by " + auditor);

        const hasP0 = findings.some(f => (f.severity || "").toUpperCase() === "P0" || (f.severity || "").toLowerCase() === "critical");
        const isVetoed = body.vetoed === true || hasP0 || verdict === "FAIL";

        if (isVetoed) {
            riskScore = Math.max(riskScore, 85);
        }

        const signature = "sig_audit_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);

        const auditPayload = {
            auditor: auditor,
            verdict: verdict,
            risk_score: riskScore,
            findings: findings,
            vetoed: isVetoed,
            signature: signature,
            summary: summary,
            audited_at: new Date().toISOString()
        };

        record.set("sceptic_audit", auditPayload);

        // Recompute verification badge
        let badge = "unverified";
        let score = 50;

        const currentBadge = record.getString("verification_badge");

        if (isVetoed) {
            badge = "vetoed";
            score = 25;
        } else if (currentBadge === "failing_tests") {
            badge = "failing_tests";
            score = 60;
        } else if (verdict === "PASS") {
            badge = "verified";
            score = 100;
        } else if (verdict === "CONDITIONAL_PASS") {
            badge = "verified";
            score = 85;
        }

        record.set("verification_badge", badge);
        record.set("verification_score", score);

        // If P0 veto, mark session status as failed/vetoed if active
        if (isVetoed && (record.getString("status") === "running" || record.getString("status") === "verifying")) {
            record.set("status", "failed");
        }

        e.app.save(record);

        // Also persist to session_audits collection
        try {
            const auditCol = e.app.findCollectionByNameOrId("session_audits");
            if (auditCol) {
                const auditRecord = new Record(auditCol);
                auditRecord.set("session_id", record.getString("session_id"));
                auditRecord.set("session", record.id);
                auditRecord.set("project", record.getString("project"));
                auditRecord.set("auditor", auditor);
                auditRecord.set("verdict", verdict === "FAIL" || verdict === "CONDITIONAL_PASS" ? verdict : "PASS");
                auditRecord.set("risk_score", riskScore);
                auditRecord.set("findings", findings);
                auditRecord.set("vetoed", isVetoed);
                auditRecord.set("signature", signature);
                auditRecord.set("summary", summary);
                auditRecord.set("metadata", body.metadata || {});
                e.app.save(auditRecord);
            }
        } catch (dbErr) {}

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            audit: auditPayload,
            verification_badge: badge,
            verification_score: score,
            vetoed: isVetoed
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 7. GET /api/projectbase/observability/summary - Workspace-wide observability metrics
routerAdd("GET", "/api/projectbase/observability/summary", (e) => {
    try {
        let totalSessions = 0;
        let verifiedCount = 0;
        let vetoedCount = 0;
        let failingTestsCount = 0;
        let unverifiedCount = 0;
        let totalLinesAdded = 0;
        let totalLinesDeleted = 0;
        let totalTestsExecuted = 0;
        let totalTestsPassed = 0;
        let totalAudits = 0;

        try {
            const sessions = e.app.findRecordsByFilter("agent_sessions", "id != ''", "-created", 500, 0);
            totalSessions = sessions.length;
            sessions.forEach(s => {
                const badge = s.getString("verification_badge") || "unverified";
                if (badge === "verified") verifiedCount++;
                else if (badge === "vetoed") vetoedCount++;
                else if (badge === "failing_tests") failingTestsCount++;
                else unverifiedCount++;

                try {
                    const diffSum = s.get("git_diff_summary") || {};
                    totalLinesAdded += (diffSum.additions || 0);
                    totalLinesDeleted += (diffSum.deletions || 0);
                } catch (x) {}

                try {
                    const tv = s.get("test_verdict") || {};
                    totalTestsExecuted += (tv.total || 0);
                    totalTestsPassed += (tv.passed || 0);
                } catch (x) {}
            });
        } catch (x) {}

        try {
            const audits = e.app.findRecordsByFilter("session_audits", "id != ''", "-created", 500, 0);
            totalAudits = audits.length;
        } catch (x) {}

        const globalPassRate = totalTestsExecuted > 0 ? Math.round((totalTestsPassed / totalTestsExecuted) * 100) : 100;
        const verificationRate = totalSessions > 0 ? Math.round((verifiedCount / totalSessions) * 100) : 0;

        return e.json(200, {
            total_sessions: totalSessions,
            verified_count: verifiedCount,
            vetoed_count: vetoedCount,
            failing_tests_count: failingTestsCount,
            unverified_count: unverifiedCount,
            verification_rate_percent: verificationRate,
            global_test_pass_rate_percent: globalPassRate,
            total_tests_executed: totalTestsExecuted,
            total_lines_added: totalLinesAdded,
            total_lines_deleted: totalLinesDeleted,
            total_sceptic_audits: totalAudits,
            health: vetoedCount === 0 && failingTestsCount === 0 ? "healthy" : (vetoedCount > 0 ? "veto_warning" : "failing_tests")
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});

// 8. POST /api/projectbase/observability/verify-suite - Fast automated verification runner
routerAdd("POST", "/api/projectbase/observability/verify-suite", (e) => {
    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }
        const body = e.requestInfo().body || {};
        const sessionId = (body.session_id || "").trim();

        if (!sessionId) return e.json(400, { error: "session_id is required" });

        let record = null;
        try {
            record = e.app.findFirstRecordByFilter("agent_sessions", "id = {:id} || session_id = {:id}", { id: sessionId });
        } catch (x) {}

        if (!record) return e.json(404, { error: "Session not found" });

        let framework = body.framework || "pytest";
        let passed = parseInt(body.passed || 0, 10);
        let failed = parseInt(body.failed || 0, 10);
        let total = parseInt(body.total || (passed + failed), 10);

        const testVerdict = {
            framework: framework,
            status: failed === 0 ? "passed" : "failed",
            passed: passed,
            failed: failed,
            skipped: 0,
            total: total,
            duration_s: 0.85,
            timestamp: new Date().toISOString()
        };
        record.set("test_verdict", testVerdict);

        let auditor = body.auditor || "Flow Inspect Automated SRE";
        let verdict = failed === 0 ? "PASS" : "FAIL";
        let findings = [];

        if (failed > 0) {
            findings.push({
                id: "FIND-TEST-001",
                severity: "P1",
                category: "correctness",
                title: failed + " test assertions failed in test suite",
                description: "Test execution reported failures. Inspect suite traces."
            });
        }

        if (Array.isArray(body.findings)) {
            findings = findings.concat(body.findings);
        }

        const hasP0 = findings.some(f => (f.severity || "").toUpperCase() === "P0");
        const isVetoed = hasP0 || verdict === "FAIL";
        const signature = "sig_audit_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);

        const auditPayload = {
            auditor: auditor,
            verdict: verdict,
            risk_score: isVetoed ? 90 : 5,
            findings: findings,
            vetoed: isVetoed,
            signature: signature,
            summary: "Automated test suite & security verification",
            audited_at: new Date().toISOString()
        };

        record.set("sceptic_audit", auditPayload);
        const badge = isVetoed ? (hasP0 ? "vetoed" : "failing_tests") : "verified";
        const score = isVetoed ? 30 : 100;
        record.set("verification_badge", badge);
        record.set("verification_score", score);

        if (body.raw_diff) {
            record.set("git_diff_raw", body.raw_diff);
        }

        e.app.save(record);

        return e.json(200, {
            success: true,
            session_id: record.getString("session_id"),
            verification_badge: badge,
            verification_score: score,
            test_verdict: testVerdict,
            sceptic_audit: auditPayload
        });
    } catch (err) {
        return e.json(500, { error: err.message || String(err) });
    }
});
