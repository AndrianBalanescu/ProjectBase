// pb_hooks/93_swarm_choreography_dag.pb.js
// Autonomous Agent Swarm Choreography, Task Graph DAG Execution & Validation Checkpoints (Epic 10).
//
// Endpoints:
// 1. POST /api/projectbase/dag/decompose - Decompose parent issue into task DAG with dependency edges & persona roles
// 2. GET  /api/projectbase/dag/status    - Retrieve DAG progress, topological state, ready/blocked nodes, and leases
// 3. POST /api/projectbase/dag/step      - Advance DAG execution: acquire next ready task for agent persona
// 4. POST /api/projectbase/tasks/split   - Dynamically split issue subtasks with persona assignments
// 5. POST /api/projectbase/checkpoints/submit - Submit peer-review, test run, or QA validation checkpoint
// 6. GET  /api/projectbase/checkpoints   - Query validation checkpoints and quality gate status for an issue

// 1. POST /api/projectbase/dag/decompose
routerAdd("POST", "/api/projectbase/dag/decompose", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    const resolveIssue = (issueRef) => {
        if (!issueRef) return null
        let ref = String(issueRef).trim()
        let issue = null
        if (ref.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(ref)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + ref.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", ref) } catch (err) {}
        }
        return issue
    }

    const toArr = (value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (typeof value[0] === "object" && value[0] !== null) return value
            try { let a = JSON.parse(String(value)); return Array.isArray(a) ? a : [] } catch (err) { return [] }
        } else if (typeof value === "string" && value.trim()) {
            try { let a = JSON.parse(value); return Array.isArray(a) ? a : [] } catch (err) { return [] }
        }
        return []
    }

    const hasCycle = (nodes) => {
        let adj = {}
        let inDegree = {}
        let keys = []

        for (let i = 0; i < nodes.length; i++) {
            let k = nodes[i].key || ("node_" + i)
            keys.push(k)
            adj[k] = []
            inDegree[k] = 0
        }

        for (let i = 0; i < nodes.length; i++) {
            let k = nodes[i].key || ("node_" + i)
            let deps = nodes[i].depends_on || []
            for (let j = 0; j < deps.length; j++) {
                let dep = deps[j]
                if (adj[dep] !== undefined) {
                    adj[dep].push(k)
                    inDegree[k]++
                }
            }
        }

        let queue = []
        for (let i = 0; i < keys.length; i++) {
            if (inDegree[keys[i]] === 0) {
                queue.push(keys[i])
            }
        }

        let visited = 0
        while (queue.length > 0) {
            let u = queue.shift()
            visited++
            let neighbors = adj[u] || []
            for (let i = 0; i < neighbors.length; i++) {
                let v = neighbors[i]
                inDegree[v]--
                if (inDegree[v] === 0) {
                    queue.push(v)
                }
            }
        }

        return visited !== keys.length
    }

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (err) { return e.json(400, { error: "Invalid JSON body" }) }

        let parentRef = (body.parent_issue || body.issue_id || body.issue || "").trim()
        if (!parentRef) {
            return e.json(400, { error: "Missing required parameter 'parent_issue'" })
        }

        let parent = resolveIssue(parentRef)
        if (!parent) {
            return e.json(404, { error: "Parent issue not found: " + parentRef })
        }

        let nodes = body.nodes || []
        if (!Array.isArray(nodes) || nodes.length === 0) {
            return e.json(400, { error: "Missing or empty 'nodes' list for DAG decomposition" })
        }

        let nodeKeys = {}
        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i]
            if (!n.title) {
                return e.json(400, { error: "Node at index " + i + " is missing 'title'" })
            }
            let key = n.key || ("node_" + (i + 1))
            n.key = key
            if (nodeKeys[key]) {
                return e.json(400, { error: "Duplicate node key in DAG: " + key })
            }
            nodeKeys[key] = true
        }

        if (hasCycle(nodes)) {
            return e.json(400, { error: "Cyclic dependency detected in task graph; DAG must be acyclic" })
        }

        let issuesCol = e.app.findCollectionByNameOrId("issues")
        let projectId = parent.get("project")
        let cycleId = parent.get("cycle")
        let milestoneId = parent.get("milestone")

        let createdMap = {}
        let createdList = []

        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i]
            let rec = new Record(issuesCol)
            rec.set("project", projectId)
            rec.set("title", n.title)
            rec.set("description", n.description || "")
            rec.set("status", "todo")
            rec.set("priority", n.priority || "medium")
            rec.set("task_persona", n.persona || "coder")
            rec.set("parent_issue", parent.id)
            if (n.estimate) { rec.set("estimate", parseInt(n.estimate, 10) || 0) }
            if (cycleId) { rec.set("cycle", cycleId) }
            if (milestoneId) { rec.set("milestone", milestoneId) }
            rec.set("relations", [])
            rec.set("subtasks", [])

            e.app.save(rec)
            rec = e.app.findRecordById("issues", rec.id)
            createdMap[n.key] = rec
            createdList.push({
                key: n.key,
                id: rec.id,
                identifier: rec.getString("identifier"),
                title: rec.getString("title"),
                persona: rec.getString("task_persona"),
                priority: rec.getString("priority"),
                status: rec.getString("status"),
                depends_on: n.depends_on || []
            })
        }

        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i]
            let bRec = createdMap[n.key]
            let deps = n.depends_on || []

            for (let j = 0; j < deps.length; j++) {
                let depKey = deps[j]
                let aRec = createdMap[depKey]
                if (!aRec) continue

                let bRels = toArr(bRec.get("relations"))
                bRels.push({ issue: aRec.id, type: "blocked_by" })
                bRec.set("relations", bRels)
                e.app.save(bRec)

                let aRels = toArr(aRec.get("relations"))
                aRels.push({ issue: bRec.id, type: "blocks" })
                aRec.set("relations", aRels)
                e.app.save(aRec)
            }
        }

        try {
            let commentsCol = e.app.findCollectionByNameOrId("comments")
            let commentRec = new Record(commentsCol)
            commentRec.set("issue", parent.id)
            commentRec.set("author", "Swarm Coordinator")
            commentRec.set("author_type", "agent")
            commentRec.set("content", "Decomposed task into " + createdList.length + " DAG nodes with persona roles:\n" +
                createdList.map(function(c) {
                    let depStr = c.depends_on.length > 0 ? " (depends on: " + c.depends_on.join(", ") + ")" : ""
                    return "- [" + c.identifier + "] @" + c.persona + ": " + c.title + depStr
                }).join("\n"))
            e.app.save(commentRec)
        } catch (cErr) {}

        return e.json(200, {
            success: true,
            parent_id: parent.id,
            parent_identifier: parent.getString("identifier"),
            total_nodes: createdList.length,
            nodes: createdList
        })
    } catch (err) {
        return e.json(500, { error: "Failed to decompose DAG: " + String((err && err.message) || err) })
    }
})

// 2. GET /api/projectbase/dag/status
routerAdd("GET", "/api/projectbase/dag/status", (e) => {
    const resolveIssue = (issueRef) => {
        if (!issueRef) return null
        let ref = String(issueRef).trim()
        let issue = null
        if (ref.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(ref)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + ref.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", ref) } catch (err) {}
        }
        return issue
    }

    const toArr = (value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (typeof value[0] === "object" && value[0] !== null) return value
            try { let a = JSON.parse(String(value)); return Array.isArray(a) ? a : [] } catch (err) { return [] }
        } else if (typeof value === "string" && value.trim()) {
            try { let a = JSON.parse(value); return Array.isArray(a) ? a : [] } catch (err) { return [] }
        }
        return []
    }

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let issueRef = (e.request.url.query().get("issue_id") || e.request.url.query().get("issue") || e.request.url.query().get("parent_issue") || "").trim()
        if (!issueRef) {
            return e.json(400, { error: "Missing required query parameter 'issue_id'" })
        }

        let issue = resolveIssue(issueRef)
        if (!issue) {
            return e.json(404, { error: "Issue not found: " + issueRef })
        }

        let parentId = issue.getString("parent_issue") || issue.id
        let parent = (parentId === issue.id) ? issue : resolveIssue(parentId)

        let children = e.app.findRecordsByFilter("issues", "parent_issue = '" + parent.id + "'", "created", 200, 0)
        let nowIso = new Date().toISOString()

        let totalNodes = children.length
        let completedNodes = 0
        let inProgressNodes = 0
        let readyNodes = []
        let blockedNodes = []
        let nodesSummary = []

        let childMap = {}
        for (let i = 0; i < children.length; i++) {
            childMap[children[i].id] = children[i]
        }

        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            let cId = child.id
            let ident = child.getString("identifier")
            let status = child.getString("status")
            let persona = child.getString("task_persona")
            let title = child.getString("title")
            let rels = toArr(child.get("relations"))

            let blockedByRefs = []
            let isBlocked = false

            for (let r = 0; r < rels.length; r++) {
                if (rels[r].type === "blocked_by") {
                    let depId = rels[r].issue
                    blockedByRefs.push(depId)
                    let depRec = childMap[depId]
                    if (!depRec) {
                        try { depRec = e.app.findRecordById("issues", depId) } catch (dErr) {}
                    }
                    if (depRec && depRec.getString("status") !== "done") {
                        isBlocked = true
                    }
                }
            }

            let leaseList = e.app.findRecordsByFilter("task_leases", "issue = '" + cId + "' && expires_at > '" + nowIso + "'", "-created", 1, 0)
            let activeLease = leaseList.length > 0 ? {
                agent_name: leaseList[0].getString("agent_name"),
                expires_at: leaseList[0].getString("expires_at"),
                reason: leaseList[0].getString("reason")
            } : null

            let cpList = e.app.findRecordsByFilter("task_checkpoints", "issue = '" + cId + "'", "-created", 10, 0)
            let checkpoints = []
            let allCheckpointsPassed = true
            for (let cp = 0; cp < cpList.length; cp++) {
                let cpRec = cpList[cp]
                let cpSt = cpRec.getString("status")
                if (cpSt !== "passed") { allCheckpointsPassed = false }
                checkpoints.push({
                    id: cpRec.id,
                    agent_name: cpRec.getString("agent_name"),
                    persona: cpRec.getString("persona"),
                    type: cpRec.getString("checkpoint_type"),
                    status: cpSt,
                    notes: cpRec.getString("notes")
                })
            }

            if (status === "done") {
                completedNodes++
            } else if (status === "in_progress") {
                inProgressNodes++
            }

            let isReady = (status !== "done" && status !== "cancelled" && !isBlocked)
            if (isReady) {
                readyNodes.push(ident)
            } else if (isBlocked && status !== "done" && status !== "cancelled") {
                blockedNodes.push(ident)
            }

            nodesSummary.push({
                id: cId,
                identifier: ident,
                title: title,
                status: status,
                persona: persona,
                is_ready: isReady,
                is_blocked: isBlocked,
                blocked_by: blockedByRefs,
                active_lease: activeLease,
                checkpoints: checkpoints,
                all_checkpoints_passed: cpList.length > 0 ? allCheckpointsPassed : null
            })
        }

        let progressPercent = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

        return e.json(200, {
            success: true,
            parent_id: parent.id,
            parent_identifier: parent.getString("identifier"),
            parent_title: parent.getString("title"),
            total_nodes: totalNodes,
            completed_nodes: completedNodes,
            in_progress_nodes: inProgressNodes,
            progress_percent: progressPercent,
            is_dag_completed: totalNodes > 0 && completedNodes === totalNodes,
            ready_to_execute: readyNodes,
            blocked: blockedNodes,
            nodes: nodesSummary
        })
    } catch (err) {
        return e.json(500, { error: "Failed to fetch DAG status: " + String((err && err.message) || err) })
    }
})

// 3. POST /api/projectbase/dag/step
routerAdd("POST", "/api/projectbase/dag/step", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    const resolveIssue = (issueRef) => {
        if (!issueRef) return null
        let ref = String(issueRef).trim()
        let issue = null
        if (ref.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(ref)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + ref.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", ref) } catch (err) {}
        }
        return issue
    }

    const toArr = (value) => {
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (typeof value[0] === "object" && value[0] !== null) return value
            try { let a = JSON.parse(String(value)); return Array.isArray(a) ? a : [] } catch (err) { return [] }
        } else if (typeof value === "string" && value.trim()) {
            try { let a = JSON.parse(value); return Array.isArray(a) ? a : [] } catch (err) { return [] }
        }
        return []
    }

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (err) { return e.json(400, { error: "Invalid JSON body" }) }

        let parentRef = (body.parent_issue || body.issue_id || body.issue || "").trim()
        let agentName = (body.agent_name || "Swarm Worker").trim()
        let targetPersona = (body.persona || "").trim()

        if (!parentRef) {
            return e.json(400, { error: "Missing required parameter 'parent_issue'" })
        }

        let parent = resolveIssue(parentRef)
        if (!parent) {
            return e.json(404, { error: "Parent issue not found: " + parentRef })
        }

        let parentId = parent.getString("parent_issue") || parent.id
        let children = e.app.findRecordsByFilter("issues", "parent_issue = '" + parentId + "'", "created", 200, 0)
        let nowIso = new Date().toISOString()

        let childMap = {}
        for (let i = 0; i < children.length; i++) {
            childMap[children[i].id] = children[i]
        }

        let readyCandidates = []
        for (let i = 0; i < children.length; i++) {
            let child = children[i]
            let status = child.getString("status")
            if (status === "done" || status === "cancelled" || status === "in_progress") {
                continue
            }

            let rels = toArr(child.get("relations"))
            let isBlocked = false
            for (let r = 0; r < rels.length; r++) {
                if (rels[r].type === "blocked_by") {
                    let depRec = childMap[rels[r].issue]
                    if (!depRec) {
                        try { depRec = e.app.findRecordById("issues", rels[r].issue) } catch (dErr) {}
                    }
                    if (depRec && depRec.getString("status") !== "done") {
                        isBlocked = true
                        break
                    }
                }
            }

            if (!isBlocked) {
                let activeLeases = e.app.findRecordsByFilter("task_leases", "issue = '" + child.id + "' && expires_at > '" + nowIso + "'", "", 1, 0)
                if (activeLeases.length === 0) {
                    readyCandidates.push(child)
                }
            }
        }

        if (readyCandidates.length === 0) {
            return e.json(200, {
                success: true,
                message: "No ready unblocked and unleased nodes available",
                node: null,
                remaining_ready: 0
            })
        }

        let selectedNode = null
        if (targetPersona) {
            for (let i = 0; i < readyCandidates.length; i++) {
                if (readyCandidates[i].getString("task_persona").toLowerCase() === targetPersona.toLowerCase()) {
                    selectedNode = readyCandidates[i]
                    break
                }
            }
        }
        if (!selectedNode) {
            selectedNode = readyCandidates[0]
        }

        selectedNode.set("status", "in_progress")
        if (agentName) {
            selectedNode.set("assignee", agentName)
        }
        e.app.save(selectedNode)

        let leaseCol = e.app.findCollectionByNameOrId("task_leases")
        let leaseRec = new Record(leaseCol)
        let ttl = 900
        let expiresAt = new Date(Date.now() + (ttl * 1000)).toISOString()

        leaseRec.set("issue", selectedNode.id)
        leaseRec.set("agent_name", agentName)
        leaseRec.set("acquired_at", nowIso)
        leaseRec.set("expires_at", expiresAt)
        leaseRec.set("reason", "DAG step execution by " + agentName + " (" + selectedNode.getString("task_persona") + ")")
        e.app.save(leaseRec)

        try {
            let telCol = e.app.findCollectionByNameOrId("agent_telemetry")
            let telRec = new Record(telCol)
            telRec.set("issue", selectedNode.id)
            telRec.set("agent_name", agentName)
            telRec.set("event_type", "dag_step_dispatched")
            telRec.set("summary", "Claimed and started task: " + selectedNode.getString("identifier") + " - " + selectedNode.getString("title"))
            telRec.set("timestamp", nowIso)
            e.app.save(telRec)
        } catch (tErr) {}

        return e.json(200, {
            success: true,
            node: {
                id: selectedNode.id,
                identifier: selectedNode.getString("identifier"),
                title: selectedNode.getString("title"),
                status: selectedNode.getString("status"),
                persona: selectedNode.getString("task_persona"),
                assignee: selectedNode.getString("assignee")
            },
            lease_expires_at: expiresAt,
            remaining_ready: readyCandidates.length - 1
        })
    } catch (err) {
        return e.json(500, { error: "Failed to advance DAG step: " + String((err && err.message) || err) })
    }
})

// 4. POST /api/projectbase/tasks/split
routerAdd("POST", "/api/projectbase/tasks/split", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    const resolveIssue = (issueRef) => {
        if (!issueRef) return null
        let ref = String(issueRef).trim()
        let issue = null
        if (ref.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(ref)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + ref.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", ref) } catch (err) {}
        }
        return issue
    }

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (err) { return e.json(400, { error: "Invalid JSON body" }) }

        let issueRef = (body.issue_id || body.issue || "").trim()
        if (!issueRef) {
            return e.json(400, { error: "Missing required parameter 'issue_id'" })
        }

        let issue = resolveIssue(issueRef)
        if (!issue) {
            return e.json(404, { error: "Issue not found: " + issueRef })
        }

        let subtasks = body.subtasks || []
        if (!Array.isArray(subtasks)) {
            return e.json(400, { error: "'subtasks' must be an array" })
        }

        let formattedSubtasks = []
        for (let i = 0; i < subtasks.length; i++) {
            let st = subtasks[i]
            let title = (typeof st === "string") ? st : (st.title || "")
            if (!title) continue
            formattedSubtasks.push({
                id: st.id || ("st_" + (i + 1) + "_" + Math.random().toString(36).substring(2, 7)),
                title: title,
                persona: st.persona || "coder",
                estimate: parseInt(st.estimate || "0", 10) || 0,
                done: !!st.done,
                order: i + 1
            })
        }

        issue.set("subtasks", formattedSubtasks)
        e.app.save(issue)

        return e.json(200, {
            success: true,
            issue_id: issue.id,
            identifier: issue.getString("identifier"),
            subtasks_count: formattedSubtasks.length,
            subtasks: formattedSubtasks
        })
    } catch (err) {
        return e.json(500, { error: "Failed to split subtasks: " + String((err && err.message) || err) })
    }
})

// 5. POST /api/projectbase/checkpoints/submit
routerAdd("POST", "/api/projectbase/checkpoints/submit", (e) => {
    if (!e.auth || !e.auth.id) {
        return e.unauthorizedError("Authentication required")
    }
    const resolveIssue = (issueRef) => {
        if (!issueRef) return null
        let ref = String(issueRef).trim()
        let issue = null
        if (ref.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(ref)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + ref.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", ref) } catch (err) {}
        }
        return issue
    }

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let body
        try { body = e.requestInfo().body || {} } catch (err) { return e.json(400, { error: "Invalid JSON body" }) }

        let issueRef = (body.issue_id || body.issue || "").trim()
        let agentName = (body.agent_name || "Verifier").trim()
        let persona = (body.persona || "reviewer").trim()
        let checkpointType = (body.checkpoint_type || "peer_review").trim()
        let status = (body.status || "passed").trim().toLowerCase()
        let notes = (body.notes || "").trim()
        let artifacts = body.artifacts || {}

        if (!issueRef) {
            return e.json(400, { error: "Missing required parameter 'issue_id'" })
        }

        let issue = resolveIssue(issueRef)
        if (!issue) {
            return e.json(404, { error: "Issue not found: " + issueRef })
        }

        if (["passed", "failed", "changes_requested", "pending"].indexOf(status) === -1) {
            return e.json(400, { error: "Invalid status; must be one of: passed, failed, changes_requested, pending" })
        }

        let cpCol = e.app.findCollectionByNameOrId("task_checkpoints")
        let cpRec = new Record(cpCol)
        cpRec.set("issue", issue.id)
        cpRec.set("agent_name", agentName)
        cpRec.set("persona", persona)
        cpRec.set("checkpoint_type", checkpointType)
        cpRec.set("status", status)
        cpRec.set("notes", notes)
        cpRec.set("artifacts", artifacts)
        e.app.save(cpRec)

        if (status === "failed" || status === "changes_requested") {
            try {
                let commentsCol = e.app.findCollectionByNameOrId("comments")
                let commentRec = new Record(commentsCol)
                commentRec.set("issue", issue.id)
                commentRec.set("author", agentName)
                commentRec.set("author_type", "agent")
                commentRec.set("content", "⚠️ [Validation Checkpoint: " + checkpointType + "] Verdict: " + status.toUpperCase() + "\n" + (notes || "No notes provided."))
                e.app.save(commentRec)
            } catch (cErr) {}
        }

        try {
            let telCol = e.app.findCollectionByNameOrId("agent_telemetry")
            let telRec = new Record(telCol)
            telRec.set("issue", issue.id)
            telRec.set("agent_name", agentName)
            telRec.set("event_type", "checkpoint")
            telRec.set("summary", "Checkpoint " + checkpointType + " (" + status + ") recorded by " + agentName)
            telRec.set("payload", { checkpoint_type: checkpointType, status: status, notes: notes })
            telRec.set("timestamp", new Date().toISOString())
            e.app.save(telRec)
        } catch (tErr) {}

        return e.json(200, {
            success: true,
            checkpoint: {
                id: cpRec.id,
                issue_id: issue.id,
                identifier: issue.getString("identifier"),
                agent_name: agentName,
                persona: persona,
                checkpoint_type: checkpointType,
                status: status,
                notes: notes,
                created: cpRec.getString("created")
            },
            gate_passed: (status === "passed")
        })
    } catch (err) {
        return e.json(500, { error: "Failed to submit checkpoint: " + String((err && err.message) || err) })
    }
})

// 6. GET /api/projectbase/checkpoints
routerAdd("GET", "/api/projectbase/checkpoints", (e) => {
    const resolveIssue = (issueRef) => {
        if (!issueRef) return null
        let ref = String(issueRef).trim()
        let issue = null
        if (ref.indexOf("-") !== -1 || /^[A-Z0-9_]+-\d+$/i.test(ref)) {
            let matches = e.app.findRecordsByFilter("issues", "identifier = '" + ref.toUpperCase() + "'", "", 1, 0)
            if (matches.length > 0) { issue = matches[0] }
        }
        if (!issue) {
            try { issue = e.app.findRecordById("issues", ref) } catch (err) {}
        }
        return issue
    }

    try {
        if (!e.auth || !e.auth.id) {
            return e.unauthorizedError("Authentication required")
        }

        let issueRef = (e.request.url.query().get("issue_id") || e.request.url.query().get("issue") || "").trim()
        if (!issueRef) {
            return e.json(400, { error: "Missing required query parameter 'issue_id'" })
        }

        let issue = resolveIssue(issueRef)
        if (!issue) {
            return e.json(404, { error: "Issue not found: " + issueRef })
        }

        let cpList = e.app.findRecordsByFilter("task_checkpoints", "issue = '" + issue.id + "'", "-created", 100, 0)
        let results = []
        let passedCount = 0
        let failedCount = 0
        let pendingCount = 0

        for (let i = 0; i < cpList.length; i++) {
            let cp = cpList[i]
            let st = cp.getString("status")
            if (st === "passed") passedCount++
            else if (st === "failed" || st === "changes_requested") failedCount++
            else pendingCount++

            results.push({
                id: cp.id,
                agent_name: cp.getString("agent_name"),
                persona: cp.getString("persona"),
                checkpoint_type: cp.getString("checkpoint_type"),
                status: st,
                notes: cp.getString("notes"),
                artifacts: cp.get("artifacts"),
                created: cp.getString("created")
            })
        }

        return e.json(200, {
            success: true,
            issue_id: issue.id,
            identifier: issue.getString("identifier"),
            total_checkpoints: results.length,
            all_passed: results.length > 0 && failedCount === 0 && pendingCount === 0,
            passed_count: passedCount,
            failed_count: failedCount,
            pending_count: pendingCount,
            checkpoints: results
        })
    } catch (err) {
        return e.json(500, { error: "Failed to get checkpoints: " + String((err && err.message) || err) })
    }
})
