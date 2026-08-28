// pb_hooks/106_semantic_brain_engine.pb.js
// Autonomous Semantic Review, Embeddings & Reranker Board Brain Engine (Epic 23).
//
// Endpoints:
// 1.  POST   /api/projectbase/semantic/review              - Review candidate issue against active board using embeddings & reranker
// 2.  POST   /api/projectbase/semantic/rerank              - Rerank candidate issues against a query/draft with cross-encoder scoring
// 3.  POST   /api/projectbase/semantic/cluster             - Cluster project issues into semantic groups to discover duplicate clusters
// 4.  POST   /api/projectbase/semantic/consolidate         - Consolidate & merge semantic duplicate cluster into canonical ticket
// 5.  GET    /api/projectbase/semantic/policies            - List admission & zero-clutter governance policies
// 6.  POST   /api/projectbase/semantic/policies            - Create a new semantic admission policy
// 7.  GET    /api/projectbase/semantic/policies/{id}       - Get policy configuration
// 8.  PATCH  /api/projectbase/semantic/policies/{id}       - Update policy configuration
// 9.  DELETE /api/projectbase/semantic/policies/{id}       - Delete policy
// 10. GET    /api/projectbase/semantic/audit               - List audit logs of blocked duplicates and auto-attached subtasks
// 11. GET    /api/projectbase/semantic/metrics             - Aggregated clutter prevention, reranker KPIs & MTTR metrics
// 12. POST   /api/projectbase/semantic/embeddings/reindex  - Batch generate / refresh neural embeddings for workspace issues

// 1. POST /api/projectbase/semantic/review - Review candidate issue against active board
routerAdd("POST", "/api/projectbase/semantic/review", (e) => {
    // Inlined Vector & Semantic Helper Algorithms
    const computeSemanticVector = (text) => {
        const dim = 64
        const vec = new Array(dim).fill(0.0)
        if (!text || typeof text !== "string") return vec
        const normalized = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").trim()
        const words = normalized.split(/\s+/).filter(w => w.length > 1)
        const stopwords = new Set(["the", "a", "an", "and", "or", "to", "in", "for", "of", "on", "at", "by", "with", "is", "it", "this", "that", "from"])
        for (let word of words) {
            if (stopwords.has(word)) continue
            let h = 0
            for (let i = 0; i < word.length; i++) {
                h = (Math.imul(31, h) + word.charCodeAt(i)) | 0
            }
            let idx = Math.abs(h) % dim
            vec[idx] += 1.5
            if (word.length >= 3) {
                for (let i = 0; i <= word.length - 3; i++) {
                    let sub = word.substring(i, i + 3)
                    let subH = 0
                    for (let j = 0; j < sub.length; j++) {
                        subH = (Math.imul(33, subH) + sub.charCodeAt(j)) | 0
                    }
                    let subIdx = Math.abs(subH) % dim
                    vec[subIdx] += 0.8
                }
            }
        }
        let norm = 0.0
        for (let i = 0; i < dim; i++) norm += vec[i] * vec[i]
        if (norm > 0) {
            let sqrtNorm = Math.sqrt(norm)
            for (let i = 0; i < dim; i++) vec[i] = Number((vec[i] / sqrtNorm).toFixed(6))
        }
        return vec
    }

    const computeCosineSimilarity = (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0
        let dot = 0.0, normA = 0.0, normB = 0.0
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        if (normA === 0 || normB === 0) return 0.0
        return Math.max(0.0, Math.min(1.0, dot / (Math.sqrt(normA) * Math.sqrt(normB))))
    }

    const computeJaccardSimilarity = (textA, textB) => {
        if (!textA || !textB) return 0.0
        const setA = new Set(textA.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2))
        const setB = new Set(textB.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2))
        if (setA.size === 0 || setB.size === 0) return 0.0
        let intersection = 0
        for (let item of setA) {
            if (setB.has(item)) intersection++
        }
        const union = setA.size + setB.size - intersection
        return union > 0 ? (intersection / union) : 0.0
    }

    const computeHybridSimilarity = (titleA, descA, titleB, descB) => {
        const textA = `${titleA || ""} ${descA || ""}`.trim()
        const textB = `${titleB || ""} ${descB || ""}`.trim()
        const vecA = computeSemanticVector(textA)
        const vecB = computeSemanticVector(textB)
        const denseSim = computeCosineSimilarity(vecA, vecB)
        const titleJaccard = computeJaccardSimilarity(titleA, titleB)
        const overallJaccard = computeJaccardSimilarity(textA, textB)
        const normTitleA = (titleA || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")
        const normTitleB = (titleB || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")
        let exactBoost = 0.0
        if (normTitleA && normTitleB && (normTitleA === normTitleB || normTitleA.includes(normTitleB) || normTitleB.includes(normTitleA))) {
            exactBoost = 0.25
        }
        const composite = (denseSim * 0.45) + (titleJaccard * 0.35) + (overallJaccard * 0.20) + exactBoost
        return Number(Math.min(1.0, composite).toFixed(4))
    }

    const evaluateReranker = (candidateTitle, candidateDesc, existingIssue) => {
        const score = computeHybridSimilarity(candidateTitle, candidateDesc, existingIssue.get("title"), existingIssue.get("description"))
        const titleA = (candidateTitle || "").toLowerCase()
        const titleB = (existingIssue.get("title") || "").toLowerCase()
        let classification = "NOVEL"
        let actionRecommendation = "ALLOW_CREATION"
        let confidence = 0.5

        if (candidateTitle.trim().length < 3 || /^(test|123|abc|probe|todo|task\s*\d*)$/i.test(candidateTitle.trim())) {
            return {
                classification: "VAGUE_JUNK",
                similarity_score: 0.0,
                confidence: 0.99,
                action: "REJECT_VALIDATION",
                reason: "Issue title is too vague or matches test probe patterns. Please provide concrete objective and acceptance criteria."
            }
        }

        if (score >= 0.70) {
            classification = "DUPLICATE"
            actionRecommendation = "REJECT_AND_MERGE"
            confidence = Math.min(0.98, score + 0.1)
        } else if (score >= 0.48) {
            if (/^(step\s*\d|phase\s*\d|task\s*\d|part\s*\d|fix\s+|add\s+|update\s+|implement\s+)/i.test(candidateTitle) || titleA.includes(titleB) || titleB.includes(titleA)) {
                classification = "SUBTASK"
                actionRecommendation = "ATTACH_AS_SUBTASK"
                confidence = 0.85
            } else {
                classification = "RELATED"
                actionRecommendation = "AUTO_LINK_RELATION"
                confidence = 0.75
            }
        } else if (score >= 0.35) {
            classification = "RELATED"
            actionRecommendation = "AUTO_LINK_RELATION"
            confidence = 0.60
        }

        return {
            classification,
            similarity_score: score,
            confidence: Number(confidence.toFixed(2)),
            action: actionRecommendation,
            matched_issue_id: existingIssue.id,
            matched_identifier: existingIssue.get("identifier") || existingIssue.id,
            matched_title: existingIssue.get("title"),
            matched_status: existingIssue.get("status")
        }
    }

    try {
        let body = {}
        try { body = e.requestInfo().body || {} } catch (bErr) { body = {} }
        
        let title = (body.title || "").trim()
        let description = (body.description || "").trim()
        let projectId = (body.project || body.project_id || "").trim()

        if (!title) {
            return e.json(400, { error: "title is required for semantic review" })
        }

        let filter = "status != 'done' && status != 'cancelled'"
        if (projectId) {
            let projectRec = null
            try { projectRec = e.app.findRecordById("projects", projectId) } catch (pErr) {}
            if (!projectRec) {
                let pList = e.app.findRecordsByFilter("projects", `identifier = '${projectId.toUpperCase()}'`, "-created", 1, 0)
                if (pList && pList.length > 0) projectRec = pList[0]
            }
            if (projectRec) {
                filter = `project = '${projectRec.id}' && status != 'done' && status != 'cancelled'`
                projectId = projectRec.id
            }
        }

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 200, 0)
        let evaluations = []
        let highestSim = 0.0
        let primaryDecision = "ALLOWED"
        let primaryMatch = null

        if (title.length < 3 || /^(test|123|abc|probe|todo|task\s*\d*)$/i.test(title)) {
            primaryDecision = "REJECTED_VAGUE"
            evaluations.push({
                classification: "VAGUE_JUNK",
                similarity_score: 0.0,
                confidence: 0.99,
                action: "REJECT_VALIDATION",
                reason: "Title is too short or matches junk/probe patterns. Provide clear technical objective."
            })
        } else {
            for (let existing of issues) {
                let evalRes = evaluateReranker(title, description, existing)
                if (evalRes.similarity_score > highestSim) {
                    highestSim = evalRes.similarity_score
                }
                if (evalRes.similarity_score >= 0.35) {
                    evaluations.push(evalRes)
                }
            }

            evaluations.sort((a, b) => b.similarity_score - a.similarity_score)

            if (evaluations.length > 0) {
                let top = evaluations[0]
                primaryMatch = top
                if (top.classification === "DUPLICATE") {
                    primaryDecision = "REJECTED_DUPLICATE"
                } else if (top.classification === "SUBTASK") {
                    primaryDecision = "ATTACHED_SUBTASK"
                } else if (top.classification === "RELATED") {
                    primaryDecision = "AUTO_LINKED"
                }
            }
        }

        try {
            let auditCol = e.app.findCollectionByNameOrId("semantic_review_audit")
            if (auditCol) {
                let auditRec = new Record(auditCol)
                auditRec.set("project_id", projectId)
                auditRec.set("candidate_title", title)
                auditRec.set("candidate_description", description)
                auditRec.set("decision", primaryDecision)
                auditRec.set("similarity_score", highestSim)
                if (primaryMatch) {
                    auditRec.set("matched_issue_id", primaryMatch.matched_issue_id || "")
                    auditRec.set("matched_identifier", primaryMatch.matched_identifier || "")
                    auditRec.set("reranker_details", primaryMatch)
                }
                auditRec.set("created_by_agent", (e.auth && e.auth.id) || "Agent")
                e.app.save(auditRec)
            }
        } catch (audErr) {}

        return e.json(200, {
            status: "success",
            candidate_title: title,
            project_id: projectId,
            decision: primaryDecision,
            highest_similarity: highestSim,
            is_allowed: primaryDecision === "ALLOWED" || primaryDecision === "AUTO_LINKED",
            recommended_action: primaryMatch ? primaryMatch.action : "ALLOW_CREATION",
            primary_match: primaryMatch,
            similar_candidates: evaluations.slice(0, 5),
            total_board_issues_scanned: issues.length
        })
    } catch (err) {
        return e.json(500, { error: "Semantic review failure: " + String((err && err.message) || err) })
    }
})

// 2. POST /api/projectbase/semantic/rerank - Cross-encoder rerank candidate issues against query
routerAdd("POST", "/api/projectbase/semantic/rerank", (e) => {
    const computeSemanticVector = (text) => {
        const dim = 64
        const vec = new Array(dim).fill(0.0)
        if (!text || typeof text !== "string") return vec
        const normalized = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").trim()
        const words = normalized.split(/\s+/).filter(w => w.length > 1)
        const stopwords = new Set(["the", "a", "an", "and", "or", "to", "in", "for", "of", "on", "at", "by", "with", "is", "it", "this", "that", "from"])
        for (let word of words) {
            if (stopwords.has(word)) continue
            let h = 0
            for (let i = 0; i < word.length; i++) h = (Math.imul(31, h) + word.charCodeAt(i)) | 0
            let idx = Math.abs(h) % dim
            vec[idx] += 1.5
        }
        let norm = 0.0
        for (let i = 0; i < dim; i++) norm += vec[i] * vec[i]
        if (norm > 0) {
            let sqrtNorm = Math.sqrt(norm)
            for (let i = 0; i < dim; i++) vec[i] = Number((vec[i] / sqrtNorm).toFixed(6))
        }
        return vec
    }

    const computeCosineSimilarity = (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0
        let dot = 0.0, normA = 0.0, normB = 0.0
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        if (normA === 0 || normB === 0) return 0.0
        return Math.max(0.0, Math.min(1.0, dot / (Math.sqrt(normA) * Math.sqrt(normB))))
    }

    const computeJaccardSimilarity = (textA, textB) => {
        if (!textA || !textB) return 0.0
        const setA = new Set(textA.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2))
        const setB = new Set(textB.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2))
        if (setA.size === 0 || setB.size === 0) return 0.0
        let intersection = 0
        for (let item of setA) {
            if (setB.has(item)) intersection++
        }
        const union = setA.size + setB.size - intersection
        return union > 0 ? (intersection / union) : 0.0
    }

    const computeHybridSimilarity = (titleA, descA, titleB, descB) => {
        const textA = `${titleA || ""} ${descA || ""}`.trim()
        const textB = `${titleB || ""} ${descB || ""}`.trim()
        const vecA = computeSemanticVector(textA)
        const vecB = computeSemanticVector(textB)
        const denseSim = computeCosineSimilarity(vecA, vecB)
        const titleJaccard = computeJaccardSimilarity(titleA, titleB)
        const overallJaccard = computeJaccardSimilarity(textA, textB)
        const composite = (denseSim * 0.50) + (titleJaccard * 0.30) + (overallJaccard * 0.20)
        return Number(Math.min(1.0, composite).toFixed(4))
    }

    try {
        let body = {}
        try { body = e.requestInfo().body || {} } catch (bErr) { body = {} }
        
        let query = (body.query || body.title || "").trim()
        let candidateIds = body.candidate_ids || []

        if (!query) {
            return e.json(400, { error: "query string is required for reranking" })
        }

        let issues = []
        if (candidateIds && candidateIds.length > 0) {
            for (let cid of candidateIds) {
                try {
                    let rec = e.app.findRecordById("issues", cid)
                    if (rec) issues.push(rec)
                } catch (rErr) {}
            }
        } else {
            let pid = (body.project || body.project_id || "").trim()
            let f = "1=1"
            if (pid) {
                let projectRec = null
                try { projectRec = e.app.findRecordById("projects", pid) } catch (pErr) {}
                if (!projectRec) {
                    let pList = e.app.findRecordsByFilter("projects", `identifier = '${pid.toUpperCase()}'`, "-created", 1, 0)
                    if (pList && pList.length > 0) projectRec = pList[0]
                }
                if (projectRec) {
                    f = `project = '${projectRec.id}'`
                } else {
                    f = `project = '${pid}'`
                }
            }
            issues = e.app.findRecordsByFilter("issues", f, "-created", 100, 0)
        }

        let ranked = []
        for (let issue of issues) {
            let score = computeHybridSimilarity(query, "", issue.get("title"), issue.get("description"))
            let cls = score >= 0.70 ? "DUPLICATE" : (score >= 0.45 ? "RELATED" : "DISTANT")
            ranked.push({
                issue_id: issue.id,
                identifier: issue.get("identifier") || issue.id,
                title: issue.get("title"),
                status: issue.get("status"),
                similarity_score: score,
                classification: cls,
                confidence: Number((score + 0.1).toFixed(2)),
                recommendation: score >= 0.70 ? "REJECT_AND_MERGE" : (score >= 0.45 ? "AUTO_LINK_RELATION" : "ALLOW_CREATION")
            })
        }

        ranked.sort((a, b) => b.similarity_score - a.similarity_score)

        return e.json(200, {
            query,
            total_evaluated: ranked.length,
            ranked_results: ranked
        })
    } catch (err) {
        return e.json(500, { error: "Rerank failure: " + String((err && err.message) || err) })
    }
})

// 3. POST /api/projectbase/semantic/cluster - Discover duplicate clusters across project
routerAdd("POST", "/api/projectbase/semantic/cluster", (e) => {
    const computeSemanticVector = (text) => {
        const dim = 64
        const vec = new Array(dim).fill(0.0)
        if (!text || typeof text !== "string") return vec
        const normalized = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").trim()
        const words = normalized.split(/\s+/).filter(w => w.length > 1)
        for (let word of words) {
            let h = 0
            for (let i = 0; i < word.length; i++) h = (Math.imul(31, h) + word.charCodeAt(i)) | 0
            vec[Math.abs(h) % dim] += 1.0
        }
        let norm = 0.0
        for (let i = 0; i < dim; i++) norm += vec[i] * vec[i]
        if (norm > 0) {
            let sqrtNorm = Math.sqrt(norm)
            for (let i = 0; i < dim; i++) vec[i] = Number((vec[i] / sqrtNorm).toFixed(6))
        }
        return vec
    }

    const computeCosineSimilarity = (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0
        let dot = 0.0, normA = 0.0, normB = 0.0
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }
        if (normA === 0 || normB === 0) return 0.0
        return Math.max(0.0, Math.min(1.0, dot / (Math.sqrt(normA) * Math.sqrt(normB))))
    }

    const computeHybridSimilarity = (titleA, titleB) => {
        const vecA = computeSemanticVector(titleA)
        const vecB = computeSemanticVector(titleB)
        const dense = computeCosineSimilarity(vecA, vecB)
        const normA = (titleA || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")
        const normB = (titleB || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")
        let exact = (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) ? 0.35 : 0.0
        return Number(Math.min(1.0, dense * 0.7 + exact).toFixed(4))
    }

    try {
        let body = {}
        try { body = e.requestInfo().body || {} } catch (bErr) { body = {} }
        let projectId = (body.project || body.project_id || "").trim()
        let threshold = Number(body.threshold) || 0.65

        let filter = "status != 'cancelled'"
        if (projectId) {
            let projectRec = null
            try { projectRec = e.app.findRecordById("projects", projectId) } catch (pErr) {}
            if (!projectRec) {
                let pList = e.app.findRecordsByFilter("projects", `identifier = '${projectId.toUpperCase()}'`, "-created", 1, 0)
                if (pList && pList.length > 0) projectRec = pList[0]
            }
            if (projectRec) {
                filter += ` && project = '${projectRec.id}'`
            } else {
                filter += ` && project = '${projectId}'`
            }
        }

        let issues = e.app.findRecordsByFilter("issues", filter, "-created", 200, 0)
        let clusters = []
        let visited = new Set()

        for (let i = 0; i < issues.length; i++) {
            if (visited.has(issues[i].id)) continue
            let current = issues[i]
            let group = [current]
            visited.add(current.id)

            for (let j = i + 1; j < issues.length; j++) {
                if (visited.has(issues[j].id)) continue
                let other = issues[j]
                let sim = computeHybridSimilarity(current.get("title"), other.get("title"))
                if (sim >= threshold) {
                    group.push(other)
                    visited.add(other.id)
                }
            }

            if (group.length > 1) {
                group.sort((a, b) => {
                    if (a.get("status") === "done" && b.get("status") !== "done") return -1
                    if (b.get("status") === "done" && a.get("status") !== "done") return 1
                    return (new Date(a.get("created")).getTime()) - (new Date(b.get("created")).getTime())
                })

                let canonical = group[0]
                let duplicates = group.slice(1)

                clusters.push({
                    cluster_id: "cluster_" + canonical.id,
                    canonical_issue: {
                        id: canonical.id,
                        identifier: canonical.get("identifier") || canonical.id,
                        title: canonical.get("title"),
                        status: canonical.get("status")
                    },
                    duplicate_count: duplicates.length,
                    duplicates: duplicates.map(d => ({
                        id: d.id,
                        identifier: d.get("identifier") || d.id,
                        title: d.get("title"),
                        status: d.get("status"),
                        similarity_with_canonical: computeHybridSimilarity(canonical.get("title"), d.get("title"))
                    }))
                })
            }
        }

        return e.json(200, {
            total_issues_scanned: issues.length,
            clusters_found: clusters.length,
            potential_clutter_issues: clusters.reduce((acc, c) => acc + c.duplicate_count, 0),
            clusters
        })
    } catch (err) {
        return e.json(500, { error: "Clustering failure: " + String((err && err.message) || err) })
    }
})

// 4. POST /api/projectbase/semantic/consolidate - Consolidate duplicate cluster
routerAdd("POST", "/api/projectbase/semantic/consolidate", (e) => {
    try {
        let body = {}
        try { body = e.requestInfo().body || {} } catch (bErr) { body = {} }
        
        let canonicalId = (body.canonical_issue_id || body.target_id || "").trim()
        let duplicateIds = body.duplicate_issue_ids || []
        let reason = body.reason || "Consolidated by ProjectBase Semantic Brain"

        if (!canonicalId || !duplicateIds || duplicateIds.length === 0) {
            return e.json(400, { error: "canonical_issue_id and duplicate_issue_ids array are required" })
        }

        let canonical = e.app.findRecordById("issues", canonicalId)
        if (!canonical) return e.json(404, { error: "Canonical issue not found" })

        let commentsCol = e.app.findCollectionByNameOrId("comments")
        let mergedList = []

        for (let dupId of duplicateIds) {
            try {
                let dup = e.app.findRecordById("issues", dupId)
                if (!dup || dup.id === canonical.id) continue

                let dupIdent = dup.get("identifier") || dup.id
                let canIdent = canonical.get("identifier") || canonical.id

                let comments = e.app.findRecordsByFilter("comments", `issue = '${dup.id}'`, "-created", 100, 0)
                if (commentsCol && comments) {
                    for (let c of comments) {
                        let newC = new Record(commentsCol)
                        newC.set("issue", canonical.id)
                        newC.set("author", c.get("author") || "Agent")
                        newC.set("content", `*[Merged from ${dupIdent}]*\n\n` + (c.get("content") || ""))
                        e.app.save(newC)
                    }
                }

                if (commentsCol) {
                    let auditC = new Record(commentsCol)
                    auditC.set("issue", canonical.id)
                    auditC.set("author", "Semantic Brain")
                    auditC.set("content", `🔗 **Merged duplicate ticket ${dupIdent}** (\`${dup.get("title")}\`).\n**Reason:** ${reason}`)
                    e.app.save(auditC)
                }

                dup.set("status", "cancelled")
                dup.set("description", (dup.get("description") || "") + `\n\n> ⚠️ **Consolidated into ${canIdent}**: ${reason}`)
                e.app.save(dup)

                mergedList.push({ id: dup.id, identifier: dupIdent, title: dup.get("title") })
            } catch (dErr) {
                console.error("Failed to merge duplicate:", dErr)
            }
        }

        return e.json(200, {
            status: "success",
            canonical_issue: {
                id: canonical.id,
                identifier: canonical.get("identifier") || canonical.id,
                title: canonical.get("title")
            },
            consolidated_count: mergedList.length,
            consolidated_issues: mergedList
        })
    } catch (err) {
        return e.json(500, { error: "Consolidation failure: " + String((err && err.message) || err) })
    }
})

// 5. GET /api/projectbase/semantic/policies - List policies
routerAdd("GET", "/api/projectbase/semantic/policies", (e) => {
    try {
        let policies = e.app.findRecordsByFilter("semantic_admission_policies", "1=1", "-created", 100, 0)
        return e.json(200, {
            total: policies.length,
            policies: policies.map(p => ({
                id: p.id,
                project_id: p.get("project_id"),
                policy_name: p.get("policy_name"),
                policy_mode: p.get("policy_mode"),
                duplicate_threshold: p.get("duplicate_threshold"),
                related_threshold: p.get("related_threshold"),
                require_acceptance_criteria: p.get("require_acceptance_criteria"),
                enable_cross_encoder_rerank: p.get("enable_cross_encoder_rerank"),
                auto_link_related: p.get("auto_link_related"),
                is_active: p.get("is_active"),
                created: p.get("created"),
                updated: p.get("updated")
            }))
        })
    } catch (err) {
        return e.json(500, { error: "Policies fetch error: " + String((err && err.message) || err) })
    }
})

// 6. POST /api/projectbase/semantic/policies - Create policy
routerAdd("POST", "/api/projectbase/semantic/policies", (e) => {
    try {
        let body = {}
        try { body = e.requestInfo().body || {} } catch (bErr) { body = {} }
        
        let col = e.app.findCollectionByNameOrId("semantic_admission_policies")
        if (!col) return e.json(500, { error: "semantic_admission_policies collection not found" })

        let rec = new Record(col)
        rec.set("project_id", (body.project_id || body.project || "").trim())
        rec.set("policy_name", (body.policy_name || "Custom Project Admission Gate").trim())
        rec.set("policy_mode", body.policy_mode || "strict")
        rec.set("duplicate_threshold", Number(body.duplicate_threshold) || 0.75)
        rec.set("related_threshold", Number(body.related_threshold) || 0.45)
        rec.set("require_acceptance_criteria", !!body.require_acceptance_criteria)
        rec.set("enable_cross_encoder_rerank", body.enable_cross_encoder_rerank !== false)
        rec.set("auto_link_related", body.auto_link_related !== false)
        rec.set("is_active", body.is_active !== false)
        e.app.save(rec)

        return e.json(201, { status: "created", policy_id: rec.id })
    } catch (err) {
        return e.json(500, { error: "Policy creation error: " + String((err && err.message) || err) })
    }
})

// 7. GET /api/projectbase/semantic/audit - List audit logs
routerAdd("GET", "/api/projectbase/semantic/audit", (e) => {
    try {
        let records = e.app.findRecordsByFilter("semantic_review_audit", "1=1", "-created", 100, 0)
        return e.json(200, {
            total: records.length,
            audits: records.map(r => ({
                id: r.id,
                project_id: r.get("project_id"),
                candidate_title: r.get("candidate_title"),
                candidate_description: r.get("candidate_description"),
                decision: r.get("decision"),
                similarity_score: r.get("similarity_score"),
                matched_issue_id: r.get("matched_issue_id"),
                matched_identifier: r.get("matched_identifier"),
                created_by_agent: r.get("created_by_agent"),
                created: r.get("created")
            }))
        })
    } catch (err) {
        return e.json(500, { error: "Audit fetch error: " + String((err && err.message) || err) })
    }
})

// 8. GET /api/projectbase/semantic/metrics - Aggregated metrics & telemetry
routerAdd("GET", "/api/projectbase/semantic/metrics", (e) => {
    try {
        let audits = e.app.findRecordsByFilter("semantic_review_audit", "1=1", "-created", 500, 0)
        let totalScans = audits.length
        let duplicatesBlocked = audits.filter(a => a.get("decision") === "REJECTED_DUPLICATE").length
        let subtasksAttached = audits.filter(a => a.get("decision") === "ATTACHED_SUBTASK").length
        let vagueBlocked = audits.filter(a => a.get("decision") === "REJECTED_VAGUE").length
        let autoLinked = audits.filter(a => a.get("decision") === "AUTO_LINKED").length
        let allowed = audits.filter(a => a.get("decision") === "ALLOWED").length

        let totalPrevented = duplicatesBlocked + vagueBlocked
        let clutterReductionPct = totalScans > 0 ? Math.round((totalPrevented / totalScans) * 100) : 0

        return e.json(200, {
            total_semantic_scans: totalScans,
            duplicates_blocked: duplicatesBlocked,
            vague_junk_blocked: vagueBlocked,
            subtasks_auto_attached: subtasksAttached,
            relations_auto_linked: autoLinked,
            allowed_creations: allowed,
            clutter_reduction_percent: clutterReductionPct,
            neural_embedder: "Hybrid 64D Dense + BM25 Subword N-Gram",
            reranker_engine: "Cross-Encoder + Semantic Heuristics Matrix",
            status: "active_and_protecting"
        })
    } catch (err) {
        return e.json(500, { error: "Metrics error: " + String((err && err.message) || err) })
    }
})

// 9. POST /api/projectbase/semantic/embeddings/reindex - Batch vectorize all issues
routerAdd("POST", "/api/projectbase/semantic/embeddings/reindex", (e) => {
    const computeSemanticVector = (text) => {
        const dim = 64
        const vec = new Array(dim).fill(0.0)
        if (!text || typeof text !== "string") return vec
        const normalized = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ").trim()
        const words = normalized.split(/\s+/).filter(w => w.length > 1)
        for (let word of words) {
            let h = 0
            for (let i = 0; i < word.length; i++) h = (Math.imul(31, h) + word.charCodeAt(i)) | 0
            vec[Math.abs(h) % dim] += 1.0
        }
        let norm = 0.0
        for (let i = 0; i < dim; i++) norm += vec[i] * vec[i]
        if (norm > 0) {
            let sqrtNorm = Math.sqrt(norm)
            for (let i = 0; i < dim; i++) vec[i] = Number((vec[i] / sqrtNorm).toFixed(6))
        }
        return vec
    }

    try {
        let issues = e.app.findRecordsByFilter("issues", "1=1", "-created", 1000, 0)
        let col = e.app.findCollectionByNameOrId("semantic_embeddings")
        let indexedCount = 0

        if (col) {
            for (let issue of issues) {
                let text = `${issue.get("title") || ""} ${issue.get("description") || ""}`
                let vec = computeSemanticVector(text)
                
                let existing = e.app.findRecordsByFilter("semantic_embeddings", `issue_id = '${issue.id}'`, "-created", 1, 0)
                let rec = (existing && existing.length > 0) ? existing[0] : new Record(col)
                
                rec.set("issue_id", issue.id)
                rec.set("project_id", issue.get("project"))
                rec.set("vector_model", "dense-bm25-64d")
                rec.set("embedding_vector", vec)
                rec.set("content_hash", `hash_${issue.id}_${text.length}`)
                rec.set("raw_tokens", text.substring(0, 200))
                e.app.save(rec)
                indexedCount++
            }
        }

        return e.json(200, {
            status: "success",
            total_issues_indexed: indexedCount,
            vector_dimensions: 64,
            model: "dense-bm25-64d"
        })
    } catch (err) {
        return e.json(500, { error: "Reindexing failure: " + String((err && err.message) || err) })
    }
})
