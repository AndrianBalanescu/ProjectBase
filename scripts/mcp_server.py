#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "fastmcp>=0.1.0"
# ]
# ///
"""
ProjectBase FastMCP Server
Model Context Protocol integration for ProjectBase.
Provides AI agents (Cursor, Flomaster, Hermes, Claude) with instant access to projects, kanban boards, issues, cycles, and comments.
"""

import os
import json
import urllib.request
import urllib.parse
from typing import Optional, List, Dict, Any
from fastmcp import FastMCP

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")
AUTH_TOKEN = os.environ.get("PROJECTBASE_TOKEN", "")
AUTH_EMAIL = os.environ.get("PROJECTBASE_EMAIL", "f@flow.com")
AUTH_PASSWORD = os.environ.get("PROJECTBASE_PASSWORD", "superdev123")

mcp = FastMCP("ProjectBase")

def _get_token() -> str:
    global AUTH_TOKEN
    if AUTH_TOKEN:
        return AUTH_TOKEN
    if AUTH_EMAIL and AUTH_PASSWORD:
        try:
            url = f"{BASE_URL}/api/collections/users/auth-with-password"
            data = json.dumps({"identity": AUTH_EMAIL, "password": AUTH_PASSWORD}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                AUTH_TOKEN = res.get("token", "")
                return AUTH_TOKEN
        except Exception:
            try:
                url = f"{BASE_URL}/api/collections/_superusers/auth-with-password"
                data = json.dumps({"identity": AUTH_EMAIL, "password": AUTH_PASSWORD}).encode("utf-8")
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    AUTH_TOKEN = res.get("token", "")
                    return AUTH_TOKEN
            except Exception:
                pass
    return ""

_AUTH_HELP = (
    "ProjectBase is reachable, but the request was rejected due to authentication. "
    "Configure the MCP credentials as follows:\n"
    "  - PROJECTBASE_URL (instance, e.g. {base})\n"
    "  - PROJECTBASE_EMAIL + PROJECTBASE_PASSWORD (user account) OR\n"
    "  - PROJECTBASE_TOKEN (an already-obtained PocketBase token)\n"
    "Verify health:  curl -s {base}/api/projectbase/health  -> should return 200."
)

def _request(endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Any:
    url = f"{BASE_URL}{endpoint}"
    req_data = json.dumps(data).encode("utf-8") if data else None
    headers = {"Content-Type": "application/json"}
    token = _get_token()
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            if not raw or not raw.strip():
                return {"success": True}
            data_res = json.loads(raw)
            # Warn if unauthenticated query returned empty list on a collection endpoint
            if not token and isinstance(data_res, dict) and data_res.get("items") == [] and "/records" in endpoint:
                detail = _AUTH_HELP.format(base=BASE_URL)
                # We raise so agents/callers get the actionable message instead of silently seeing empty lists
                raise RuntimeError(
                    f"UNAUTHENTICATED: the request for {endpoint} returned 0 items "
                    f"because it was made without an authentication token.\n"
                    f"{detail}"
                )
            return data_res
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        if e.code in (401, 403):
            detail = _AUTH_HELP.format(base=BASE_URL)
            raise RuntimeError(
                f"AUTH_REQUIRED (HTTP {e.code}) for {endpoint}.\n"
                f"{detail}\nServer response: {err_body}"
            )
        raise RuntimeError(f"ProjectBase API error ({e.code}): {err_body}")
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", str(e))
        raise RuntimeError(
            f"CONNECTION_FAILED: could not reach ProjectBase at {BASE_URL} "
            f"({reason}).\n"
            f"Verify the instance is running:  curl -s {BASE_URL}/api/projectbase/health\n"
            f"And that PROJECTBASE_URL is set correctly (e.g. http://127.0.0.1:8120)."
        )

def _find_project_id(identifier_or_id: str) -> str:
    # 1. Exact ID match
    if len(identifier_or_id) == 15 and not identifier_or_id.isupper():
        return identifier_or_id
    # 2. Match identifier case-insensitively
    res = _request(f"/api/collections/projects/records?filter=(identifier='{identifier_or_id.upper()}')")
    if res.get("items"):
        return res["items"][0]["id"]
    # 3. Match name case-insensitively
    res_name = _request(f"/api/collections/projects/records?filter=(name~'{identifier_or_id}')")
    if res_name.get("items"):
        return res_name["items"][0]["id"]
    # 4. Return first project if 'default' requested
    if identifier_or_id.lower() in ("default", "main", "primary", "pb"):
        all_p = _request("/api/collections/projects/records?sort=created")
        if all_p.get("items"):
            return all_p["items"][0]["id"]
    raise ValueError(f"Project '{identifier_or_id}' not found")

def _find_issue(identifier_or_id: str) -> Dict:
    if "-" in identifier_or_id or identifier_or_id.isupper():
        res = _request(f"/api/collections/issues/records?filter=(identifier='{identifier_or_id.upper()}')&expand=project,cycle")
        if res.get("items"):
            return res["items"][0]
    return _request(f"/api/collections/issues/records/{identifier_or_id}?expand=project,cycle")

@mcp.tool()
def list_projects() -> List[Dict[str, Any]]:
    """List all projects with identifiers, icons, and metadata."""
    res = _request("/api/collections/projects/records?sort=-is_favorite,-created")
    return res.get("items", [])

@mcp.tool()
def create_project(
    name: str,
    identifier: str,
    description: str = "",
    icon: str = "🚀",
    color: str = "#6366f1",
    repo_url: str = ""
) -> Dict[str, Any]:
    """Create a new project in ProjectBase."""
    data = {
        "name": name,
        "identifier": identifier.upper(),
        "description": description,
        "icon": icon,
        "color": color,
        "repo_url": repo_url,
        "is_favorite": True
    }
    return _request("/api/collections/projects/records", method="POST", data=data)

@mcp.tool()
def list_issues(
    project: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List issues/tasks with optional filtering by project key, status, or priority."""
    filters = []
    if project:
        proj_id = _find_project_id(project)
        filters.append(f"project = '{proj_id}'")
    if status:
        filters.append(f"status = '{status}'")
    if priority:
        filters.append(f"priority = '{priority}'")

    filter_str = " && ".join(filters) if filters else "1=1"
    encoded_filter = urllib.parse.quote(filter_str)
    res = _request(f"/api/collections/issues/records?filter={encoded_filter}&sort=order,-created&expand=project,cycle")
    return res.get("items", [])

@mcp.tool()
def search_issues(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search issues across every project by title, identifier, status, or priority.

    Use this when you need to find an issue by name, phrase, or identifier without
    knowing which project it lives in. Returns a cross-project list of matches,
    each carrying { id, identifier, title, status, priority, project_id,
    project_name, project_identifier, project_color }.
    """
    encoded = urllib.parse.quote(query)
    res = _request(f"/api/projectbase/search?q={encoded}&limit={limit}")
    return res.get("results", [])

@mcp.tool()
def get_issue(identifier_or_id: str) -> Dict[str, Any]:
    """Get full details of an issue including description, subtasks, and comments."""
    issue = _find_issue(identifier_or_id)
    comments = _request(f"/api/collections/comments/records?filter=(issue='{issue['id']}')&sort=created")
    issue["comments"] = comments.get("items", [])
    return issue

@mcp.tool()
def create_issue(
    project: str,
    title: str,
    description: str = "",
    status: str = "todo",
    priority: str = "medium",
    estimate: int = 0,
    assignee: str = "Agent",
    labels: Optional[List[str]] = None,
    custom_fields: Optional[Dict[str, Any]] = None,
    dedup: bool = True
) -> Dict[str, Any]:
    """Create a new issue/work item with automatic ID generation (e.g. PB-1).

    If dedup is True and an open issue with the identical title already exists
    in the project, returns the existing issue to prevent board clutter.
    Optionally pass custom_fields as a dict keyed by the project's custom field
    keys (e.g. {"client": "Acme", "gate": "P1"}). Define fields first via the
    project's custom-fields endpoint (see llms.txt / openapi.json)."""
    proj_id = _find_project_id(project)

    if dedup:
        # Check via semantic review engine first
        try:
            review_res = _request("/api/projectbase/semantic/review", method="POST", data={
                "project": proj_id,
                "title": title,
                "description": description
            })
            if review_res and review_res.get("decision") == "REJECTED_DUPLICATE":
                prim = review_res.get("primary_match") or {}
                matched_id = prim.get("matched_issue_id")
                if matched_id:
                    ext = _find_issue(matched_id)
                    return {
                        **ext,
                        "_deduplicated": True,
                        "_dedup_note": f"Semantic Brain prevented duplicate: matched {prim.get('matched_identifier')} ('{prim.get('matched_title')}') with {round(prim.get('similarity_score', 0)*100)}% similarity.",
                        "_similarity_score": prim.get("similarity_score")
                    }
        except Exception:
            pass

        # Fallback to exact title match
        clean_title = (title or "").strip().replace("'", "\\'")
        filter_str = f"project = '{proj_id}' && title = '{clean_title}'"
        encoded = urllib.parse.quote(filter_str)
        try:
            existing = _request(f"/api/collections/issues/records?filter={encoded}&perPage=1")
            items = existing.get("items", []) if isinstance(existing, dict) else []
            if items:
                ext = items[0]
                if ext.get("status") in ("todo", "in_progress", "in_review", "backlog"):
                    return {
                        **ext,
                        "_deduplicated": True,
                        "_dedup_note": f"Active issue {ext.get('identifier')} with same title already exists; returned existing issue."
                    }
        except Exception:
            pass

    data = {
        "project": proj_id,
        "title": title,
        "description": description,
        "status": status,
        "priority": priority,
        "estimate": estimate,
        "assignee": assignee,
        "labels": labels or []
    }
    if custom_fields is not None:
        data["custom_fields"] = custom_fields
    return _request("/api/collections/issues/records", method="POST", data=data)

@mcp.tool()
def update_issue(
    identifier_or_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    estimate: Optional[int] = None,
    assignee: Optional[str] = None,
    custom_fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Update issue properties such as status (backlog, todo, in_progress, in_review, done, cancelled), priority, or assignee.

    Pass custom_fields as a dict to set custom field values (e.g. {"client": "Acme", "gate": "P1"})."""
    issue = _find_issue(identifier_or_id)
    data = {}
    if status is not None: data["status"] = status
    if priority is not None: data["priority"] = priority
    if title is not None: data["title"] = title
    if description is not None: data["description"] = description
    if estimate is not None: data["estimate"] = estimate
    if assignee is not None: data["assignee"] = assignee
    if custom_fields is not None: data["custom_fields"] = custom_fields

    return _request(f"/api/collections/issues/records/{issue['id']}", method="PATCH", data=data)

@mcp.tool()
def add_comment(
    identifier_or_id: str,
    content: str,
    author: str = "Flomaster Agent",
    author_type: str = "agent"
) -> Dict[str, Any]:
    """Post an execution comment, audit log, or verification summary to an issue."""
    issue = _find_issue(identifier_or_id)
    data = {
        "issue": issue["id"],
        "author": author,
        "author_type": author_type,
        "content": content,
    }
    return _request("/api/collections/comments/records", method="POST", data=data)

@mcp.tool()
def add_issue_relation(
    identifier_or_id: str,
    target_identifier_or_id: str,
    type: str
) -> Dict[str, Any]:
    """Link two issues with a relationship. Type is one of 'blocks', 'blocked_by', or 'related'.

    The reciprocal edge is mirrored automatically (A blocks B <=> B blocked_by A;
    related <=> related)."""
    issue = _find_issue(identifier_or_id)
    target = _find_issue(target_identifier_or_id)
    if type not in ("blocks", "blocked_by", "related"):
        raise ValueError("type must be one of: blocks, blocked_by, related")
    return _request(
        f"/api/projectbase/issues/{issue['id']}/relations",
        method="POST",
        data={"issue": target["id"], "type": type},
    )

@mcp.tool()
def remove_issue_relation(
    identifier_or_id: str,
    target_identifier_or_id: str,
    type: str
) -> Dict[str, Any]:
    """Remove a relationship edge between two issues (and its reciprocal mirror)."""
    issue = _find_issue(identifier_or_id)
    target = _find_issue(target_identifier_or_id)
    if type not in ("blocks", "blocked_by", "related"):
        raise ValueError("type must be one of: blocks, blocked_by, related")
    return _request(
        f"/api/projectbase/issues/{issue['id']}/relations",
        method="DELETE",
        data={"issue": target["id"], "type": type},
    )

@mcp.tool()
def get_stats() -> Dict[str, Any]:
    """Get high-level workspace statistics, completion rates, and status breakdowns."""
    return _request("/api/projectbase/stats")

@mcp.tool()
def list_cycles(project: Optional[str] = None) -> List[Dict[str, Any]]:
    """List sprint cycles, optionally filtered to one project.

    Args:
        project: Optional project key (identifier, e.g. "PB"), name, or id.
            Omit to list cycles across every project.
    Returns each cycle with its name, dates, status, and the project it belongs to.
    """
    params = "sort=-start_date"
    if project:
        proj_id = _find_project_id(project)
        params += f"&filter=(project='{proj_id}')"
    res = _request(f"/api/collections/cycles/records?{params}&expand=project")
    return res.get("items", [])

@mcp.tool()
def get_cycle_progress(identifier_or_id: str) -> Dict[str, Any]:
    """Get a cycle's completion breakdown: total/done/in-progress issues,
    percent complete, and story points (done vs total).

    Args:
        identifier_or_id: Cycle record id (e.g. "admzsfez5xsxyeu"). Cycles do
            not have a friendly public identifier, so pass the record id.
    Returns:
        { cycle, total, done, in_progress, todo, percent, total_pts, done_pts }.
    """
    cycle = _request(f"/api/collections/cycles/records/{identifier_or_id}")
    issues = _request(
        f"/api/collections/issues/records?filter=(cycle='{cycle['id']}')&perPage=500")
    items = issues.get("items", [])
    total = len(items)
    done = [i for i in items if i.get("status") == "done"]
    in_progress = [i for i in items if i.get("status") in ("in_progress", "in_review")]
    todo = [i for i in items if i.get("status") in ("todo", "backlog")]
    total_pts = sum(float(i.get("estimate") or 0) for i in items)
    done_pts = sum(float(i.get("estimate") or 0) for i in done)
    percent = round((len(done) / total) * 100) if total else 0
    return {
        "cycle": cycle,
        "total": total,
        "done": len(done),
        "in_progress": len(in_progress),
        "todo": len(todo),
        "percent": percent,
        "total_pts": total_pts,
        "done_pts": done_pts,
    }

@mcp.tool()
def list_milestones(project: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all milestones, optionally filtered by one project.

    Args:
        project: Optional project key (identifier, e.g. "PB"), name, or id.
    Returns each milestone with its name, description, status, and target date.
    """
    filters = "1=1"
    if project:
        proj_id = _find_project_id(project)
        filters = f"project='{proj_id}'"
    encoded = urllib.parse.quote(filters)
    res = _request(f"/api/collections/milestones/records?filter={encoded}&sort=target_date&expand=project")
    return res.get("items", [])

@mcp.tool()
def get_milestone_progress(identifier_or_id: str) -> Dict[str, Any]:
    """Get a milestone's completion: linked-issue totals, done/in-progress
    counts, and a percent complete.

    Args:
        identifier_or_id: Milestone record id (e.g. "vcqqto5pb6373u8").
    Returns:
        { milestone, total, done, in_progress, percent }.
    """
    milestone = _request(f"/api/collections/milestones/records/{identifier_or_id}")
    issues = _request(
        f"/api/collections/issues/records?filter=(milestone='{milestone['id']}')&perPage=100"
    )
    items = issues.get("items", [])
    total = len(items)
    done = len([i for i in items if i.get("status") == "done"])
    in_progress = len([i for i in items if i.get("status") == "in_progress"])
    percent = round((done / total) * 100) if total else (100 if milestone.get("status") == "achieved" else 0)
    return {
        "milestone": milestone,
        "total": total,
        "done": done,
        "in_progress": in_progress,
        "percent": percent,
    }

@mcp.tool()
def dispatch_agent(
    identifier_or_id: str,
    agent_target: str = "flomaster",
    prompt: str = ""
) -> Dict[str, Any]:
    """Dispatch an issue to an autonomous agent for execution.

    Claims the issue (marks it in_progress, assigns the target agent, posts an
    audit comment) and forwards it to the configured external dispatcher
    (Windmill webhook / agent trigger webhook) when set up.

    Args:
        identifier_or_id: Issue identifier (e.g. "PB-12") or record id.
        agent_target: One of "flomaster" | "hermes" | "windmill" | "custom".
        prompt: Optional custom instructions (max 8000 chars) for the target
            agent. Required for agent_target="custom".

    Returns the claimed issue summary plus whether an external dispatch fired:
    { success, message, issue: {id, identifier, status, assignee},
      dispatched_external }.
    """
    issue = _find_issue(identifier_or_id)
    data = {"issue_id": issue["id"], "agent_target": agent_target, "prompt": prompt}
    return _request("/api/projectbase/dispatch-agent", method="POST", data=data)


@mcp.tool()
def list_notifications(unread_only: bool = True, limit: int = 20) -> List[Dict[str, Any]]:
    """List the current user's in-app notifications (unread first).

    Args:
        unread_only: If True (default), only return unread notifications.
        limit: Maximum number of notifications to return (default 20).
    """
    res = _request(f"/api/collections/notifications/records?perPage={limit}&sort=-created")
    items = res.get("items", [])
    if unread_only:
        items = [n for n in items if not n.get("read")]
    return items

@mcp.tool()
def mark_notification_read(notification_id: str) -> Dict[str, Any]:
    """Mark a single in-app notification as read by its id."""
    return _request(f"/api/collections/notifications/records/{notification_id}",
                    method="PATCH", data={"read": True})

@mcp.tool()
def mark_all_notifications_read() -> Dict[str, Any]:
    """Mark every unread in-app notification of the current user as read."""
    return _request("/api/projectbase/notifications/read-all", method="POST", data={})

@mcp.tool()
def get_notification_settings() -> Dict[str, Any]:
    """Read the current Discord/Telegram/generic-webhook notification channel config.

    Values come from the notification_settings collection, falling back to the
    process environment. Admin/manager/superuser only. Returns
    { discord_webhook_url, telegram_token, telegram_chat_id, generic_webhook_url }.
    """
    return _request("/api/projectbase/notification-settings")

@mcp.tool()
def update_notification_settings(
    discord_webhook_url: str = "",
    telegram_token: str = "",
    telegram_chat_id: str = "",
    generic_webhook_url: str = "",
) -> Dict[str, Any]:
    """Persist the notification channel config so it applies without a process restart.

    Admin/superuser only. Blank fields fall back to the process environment (or
    disable that channel entirely). Returns the updated values.
    """
    return _request("/api/projectbase/notification-settings", method="PUT", data={
        "discord_webhook_url": discord_webhook_url,
        "telegram_token": telegram_token,
        "telegram_chat_id": telegram_chat_id,
        "generic_webhook_url": generic_webhook_url,
    })

@mcp.tool()
def acquire_task_lease(
    issue: str,
    agent_name: str = "agent",
    ttl_seconds: int = 900,
    reason: str = "",
    force: bool = False,
) -> Dict[str, Any]:
    """Acquire an exclusive execution lease on an issue to prevent multi-agent collision.

    Args:
        issue: Issue identifier (e.g. "PB-12") or record ID.
        agent_name: Name of the agent claiming the task.
        ttl_seconds: Lease duration in seconds (default 900 = 15m).
        reason: Optional description of the work being performed.
        force: Override an existing lease if held by another agent.
    """
    iss = _find_issue(issue)
    return _request("/api/projectbase/leases/acquire", method="POST", data={
        "issue_id": iss["id"],
        "agent_name": agent_name,
        "ttl_seconds": ttl_seconds,
        "reason": reason,
        "force": force,
    })

@mcp.tool()
def release_task_lease(
    issue: str,
    agent_name: str = "",
    force: bool = False,
) -> Dict[str, Any]:
    """Release an active task lease on an issue.

    Args:
        issue: Issue identifier (e.g. "PB-12") or record ID.
        agent_name: Agent name releasing the lease.
        force: Force release regardless of holder.
    """
    iss = _find_issue(issue)
    return _request("/api/projectbase/leases/release", method="POST", data={
        "issue_id": iss["id"],
        "agent_name": agent_name,
        "force": force,
    })

@mcp.tool()
def renew_task_lease(
    issue: str,
    agent_name: str = "",
    ttl_seconds: int = 900,
) -> Dict[str, Any]:
    """Renew the expiration TTL and heartbeat for an active task lease.

    Args:
        issue: Issue identifier (e.g. "PB-12") or record ID.
        agent_name: Agent name holding the lease.
        ttl_seconds: Extension in seconds (default 900).
    """
    iss = _find_issue(issue)
    return _request("/api/projectbase/leases/renew", method="POST", data={
        "issue_id": iss["id"],
        "agent_name": agent_name,
        "ttl_seconds": ttl_seconds,
    })

@mcp.tool()
def get_task_lease(issue: str) -> Dict[str, Any]:
    """Check the active lease status of an issue."""
    iss = _find_issue(issue)
    leases = _request(f"/api/collections/task_leases/records?filter=(issue='{iss['id']}')&sort=-created")
    items = leases.get("items", [])
    if not items:
        return {"active": False, "lease": None}
    return {"active": True, "lease": items[0]}

@mcp.tool()
def log_agent_telemetry(
    agent_name: str,
    event_type: str,
    issue: Optional[str] = None,
    step: int = 0,
    summary: str = "",
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Log an agent reasoning trace, tool invocation, checkpoint, or collision alert.

    Args:
        agent_name: Name of the agent emitting telemetry.
        event_type: "reasoning" | "tool_call" | "checkpoint" | "collision" | "status"
        issue: Optional issue identifier (e.g. "PB-12") or ID.
        step: Workflow step number.
        summary: Short summary of the event or reasoning step.
        payload: Optional structured JSON metadata.
    """
    data: Dict[str, Any] = {
        "agent_name": agent_name,
        "event_type": event_type,
        "step": step,
        "summary": summary,
    }
    if issue:
        iss = _find_issue(issue)
        data["issue_id"] = iss["id"]
    if payload:
        data["payload"] = payload
    return _request("/api/projectbase/telemetry", method="POST", data=data)

@mcp.tool()
def register_webhook(
    url: str,
    name: str = "External Orchestrator",
    events: Optional[List[str]] = None,
    secret: str = "",
    project: Optional[str] = None,
) -> Dict[str, Any]:
    """Register an outbound webhook URL for external orchestrators.

    Args:
        url: Webhook target URL.
        name: Subscription name.
        events: List of subscribed events (default: ["*"]).
        secret: Optional HMAC secret for signature verification.
        project: Optional project key (e.g. "PB") to limit scope.
    """
    proj_id = _find_project_id(project) if project else None
    return _request("/api/projectbase/webhooks", method="POST", data={
        "url": url,
        "name": name,
        "events": events or ["*"],
        "secret": secret,
        "project_id": proj_id,
    })

@mcp.tool()
def list_webhooks(project: Optional[str] = None) -> List[Dict[str, Any]]:
    """List registered outbound webhooks."""
    proj_id = _find_project_id(project) if project else None
    params = f"?project_id={proj_id}" if proj_id else ""
    res = _request(f"/api/projectbase/webhooks{params}")
    return res.get("webhooks", [])

@mcp.tool()
def delete_webhook(webhook_id: str) -> Dict[str, Any]:
    """Delete a registered webhook subscription by ID."""
    return _request(f"/api/projectbase/webhooks/{webhook_id}", method="DELETE")

@mcp.tool()
def decompose_task_graph(
    parent_issue: str,
    nodes: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Decompose a parent issue into a DAG of child tasks with personas and dependency edges.

    Args:
        parent_issue: Parent issue identifier (e.g. "PB-42") or record ID.
        nodes: List of task nodes: [{ key, title, description, persona, priority, estimate, depends_on }]
    """
    iss = _find_issue(parent_issue)
    return _request("/api/projectbase/dag/decompose", method="POST", data={
        "parent_issue": iss["id"],
        "nodes": nodes
    })

@mcp.tool()
def get_dag_status(issue: str) -> Dict[str, Any]:
    """Retrieve DAG execution status, topological states, ready/blocked nodes, and active leases.

    Args:
        issue: Parent or child issue identifier (e.g. "PB-42") or record ID.
    """
    iss = _find_issue(issue)
    return _request(f"/api/projectbase/dag/status?issue_id={iss['id']}")

@mcp.tool()
def execute_dag_step(
    parent_issue: str,
    agent_name: str = "Swarm Worker",
    persona: str = ""
) -> Dict[str, Any]:
    """Advance DAG execution by selecting the next ready unblocked task and claiming a lease.

    Args:
        parent_issue: Parent issue identifier (e.g. "PB-42") or record ID.
        agent_name: Name of executing agent (default: "Swarm Worker").
        persona: Optional persona filter for ready nodes (e.g. "coder", "reviewer", "qa").
    """
    iss = _find_issue(parent_issue)
    return _request("/api/projectbase/dag/step", method="POST", data={
        "parent_issue": iss["id"],
        "agent_name": agent_name,
        "persona": persona
    })

@mcp.tool()
def split_subtasks(
    issue: str,
    subtasks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Dynamically split an issue's subtasks checklist with persona assignments and story points.

    Args:
        issue: Issue identifier (e.g. "PB-42") or record ID.
        subtasks: Array of subtasks: [{ title, persona, estimate, done }]
    """
    iss = _find_issue(issue)
    return _request("/api/projectbase/tasks/split", method="POST", data={
        "issue_id": iss["id"],
        "subtasks": subtasks
    })

@mcp.tool()
def submit_validation_checkpoint(
    issue: str,
    agent_name: str,
    checkpoint_type: str,
    status: str,
    persona: str = "reviewer",
    notes: str = "",
    artifacts: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Submit a peer-review verdict, QA verification, or test checkpoint for an issue.

    Args:
        issue: Issue identifier (e.g. "PB-42") or record ID.
        agent_name: Agent name performing review/verification.
        checkpoint_type: "peer_review" | "unit_test" | "qa_e2e" | "security_scan" | "schema_validation" | "acceptance"
        status: "passed" | "failed" | "changes_requested" | "pending"
        persona: Reviewer persona (e.g. "reviewer", "qa", "security", "architect").
        notes: Detailed review comments or verification logs.
        artifacts: Optional structured artifacts (diffs, reports, logs).
    """
    iss = _find_issue(issue)
    data: Dict[str, Any] = {
        "issue_id": iss["id"],
        "agent_name": agent_name,
        "persona": persona,
        "checkpoint_type": checkpoint_type,
        "status": status,
        "notes": notes,
    }
    if artifacts:
        data["artifacts"] = artifacts
    return _request("/api/projectbase/checkpoints/submit", method="POST", data=data)

@mcp.tool()
def get_validation_checkpoints(issue: str) -> Dict[str, Any]:
    """Get all validation checkpoints and quality gate status for an issue.

    Args:
        issue: Issue identifier (e.g. "PB-42") or record ID.
    """
    iss = _find_issue(issue)
    return _request(f"/api/projectbase/checkpoints?issue_id={iss['id']}")

@mcp.tool()
def link_git_commit(
    issue: str,
    commit_sha: str,
    message: str = "",
    branch: str = "",
    author: str = "Agent"
) -> Dict[str, Any]:
    """Link a git commit SHA to an issue with optional commit message and branch."""
    iss = _find_issue(issue)
    return _request("/api/projectbase/git/artifacts", method="POST", data={
        "issue_id": iss["id"],
        "artifact_type": "commit",
        "identifier": commit_sha,
        "title": message,
        "branch": branch,
        "author": author
    })

@mcp.tool()
def link_git_pr(
    issue: str,
    pr_url: str,
    pr_number: str = "",
    title: str = "",
    status: str = "open"
) -> Dict[str, Any]:
    """Link a pull request URL to an issue and synchronize issue review status."""
    iss = _find_issue(issue)
    return _request("/api/projectbase/git/artifacts", method="POST", data={
        "issue_id": iss["id"],
        "artifact_type": "pull_request",
        "identifier": pr_number or pr_url,
        "url": pr_url,
        "title": title,
        "status": status
    })

@mcp.tool()
def get_project_git_status(project: Optional[str] = None) -> Dict[str, Any]:
    """Get aggregated git workspace metrics: active branches, open/merged PRs, staged patches, CI pass rate."""
    proj_id = _find_project_id(project) if project else None
    params = f"?project_id={proj_id}" if proj_id else ""
    return _request(f"/api/projectbase/git/status{params}")

@mcp.tool()
def get_agent_workload_status(project: Optional[str] = None) -> Dict[str, Any]:
    """Get real-time agent queue saturation, persona backlogs, active leases, and capacity metrics."""
    proj_id = _find_project_id(project) if project else None
    params = f"?project_id={proj_id}" if proj_id else ""
    return _request(f"/api/projectbase/agents/workload{params}")

@mcp.tool()
def calculate_autoscale_recommendations(
    project: Optional[str] = None,
    min_workers: int = 1,
    max_workers: int = 10,
    target_saturation_pct: int = 70,
    apply: bool = False
) -> Dict[str, Any]:
    """Calculate optimal autonomous agent worker pool allocations per persona based on backlog pressure."""
    proj_id = _find_project_id(project) if project else None
    return _request("/api/projectbase/agents/autoscale", method="POST", data={
        "project_id": proj_id,
        "min_workers": min_workers,
        "max_workers": max_workers,
        "target_saturation_pct": target_saturation_pct,
        "apply": apply
    })

@mcp.tool()
def reserve_agent_capacity(
    persona: str,
    worker_id: str,
    slots: int = 1,
    ttl_seconds: int = 1800,
    project: Optional[str] = None
) -> Dict[str, Any]:
    """Reserve worker slot concurrency capacity with TTL expiration."""
    proj_id = _find_project_id(project) if project else None
    return _request("/api/projectbase/agents/capacity/reserve", method="POST", data={
        "persona": persona,
        "worker_id": worker_id,
        "slots": slots,
        "ttl_seconds": ttl_seconds,
        "project_id": proj_id
    })

@mcp.tool()
def release_agent_capacity(
    reservation_id: str = "",
    worker_id: str = "",
    persona: str = ""
) -> Dict[str, Any]:
    """Release an active agent worker capacity reservation."""
    return _request("/api/projectbase/agents/capacity/release", method="POST", data={
        "reservation_id": reservation_id,
        "worker_id": worker_id,
        "persona": persona
    })

@mcp.tool()
def run_workflow_self_heal(
    project: Optional[str] = None,
    auto_fix: bool = True
) -> Dict[str, Any]:
    """Autonomous self-healing scan to detect and auto-repair expired leases and stalled DAG subtasks."""
    proj_id = _find_project_id(project) if project else None
    return _request("/api/projectbase/workflow/self-heal", method="POST", data={
        "project_id": proj_id,
        "auto_fix": auto_fix,
        "trigger": "fastmcp"
    })

@mcp.tool()
def get_live_benchmarks(iterations: int = 10) -> Dict[str, Any]:
    """Execute live database query latency probes and concurrency health metrics."""
    return _request("/api/projectbase/benchmarks/run", method="POST", data={
        "iterations": iterations
    })

@mcp.tool()
def list_auto_heal_policies(trigger_type: Optional[str] = None) -> Dict[str, Any]:
    """List all autonomous AI agent auto-healing policies, triggers, and action strategies."""
    params = {}
    if trigger_type:
        params["trigger_type"] = trigger_type
    return _request("/api/projectbase/auto-heal/policies", method="GET", params=params)

@mcp.tool()
def create_auto_heal_policy(
    name: str,
    trigger_type: str,
    action_strategy: str,
    severity: str = "medium",
    max_retries: int = 3,
    cool_down_seconds: int = 60,
    description: str = ""
) -> Dict[str, Any]:
    """Create or register a new agent auto-healing remediation policy."""
    return _request("/api/projectbase/auto-heal/policies", method="POST", data={
        "name": name,
        "trigger_type": trigger_type,
        "action_strategy": action_strategy,
        "severity": severity,
        "max_retries": max_retries,
        "cool_down_seconds": cool_down_seconds,
        "description": description
    })

@mcp.tool()
def list_auto_heal_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    agent: Optional[str] = None
) -> Dict[str, Any]:
    """List auto-remediation incidents, failure traces, and resolution status."""
    params = {}
    if status:
        params["status"] = status
    if severity:
        params["severity"] = severity
    if agent:
        params["agent"] = agent
    return _request("/api/projectbase/auto-heal/incidents", method="GET", params=params)

@mcp.tool()
def get_auto_heal_incident_details(incident_id: str) -> Dict[str, Any]:
    """Get detailed incident diagnostic trace, error log, and execution timeline."""
    return _request(f"/api/projectbase/auto-heal/incidents/{incident_id}", method="GET")

@mcp.tool()
def trigger_auto_healing(
    agent: str,
    issue: str = "PB-100",
    trigger_type: str = "crash_loop",
    action_strategy: Optional[str] = None
) -> Dict[str, Any]:
    """Trigger dynamic auto-healing diagnosis and self-remediation for an agent or issue."""
    data = {
        "agent": agent,
        "issue": issue,
        "trigger_type": trigger_type
    }
    if action_strategy:
        data["action_strategy"] = action_strategy
    return _request("/api/projectbase/auto-heal/trigger", method="POST", data=data)

@mcp.tool()
def resolve_auto_heal_incident(
    incident_id: str,
    resolution_notes: str = "Manually verified and resolved via MCP",
    resolved_by: str = "Admin"
) -> Dict[str, Any]:
    """Resolve an active auto-healing incident with resolution notes."""
    return _request(f"/api/projectbase/auto-heal/incidents/{incident_id}/resolve", method="POST", data={
        "resolution_notes": resolution_notes,
        "resolved_by": resolved_by
    })

@mcp.tool()
def run_crash_recovery_sweep() -> Dict[str, Any]:
    """Run workspace-wide crash recovery sweep to clear dead leases, reset stuck tasks, and restore agent health."""
    return _request("/api/projectbase/auto-heal/crash-recovery", method="POST")

@mcp.tool()
def get_auto_heal_metrics() -> Dict[str, Any]:
    """Retrieve aggregated auto-healing KPIs, MTTR (Mean Time to Remediation), and recovery success rate."""
    return _request("/api/projectbase/auto-heal/metrics", method="GET")

@mcp.tool()
def merge_issues(
    source_issue: str,
    target_issue: str,
    reason: str = "Duplicate or consolidated work item"
) -> Dict[str, Any]:
    """Merge a duplicate or redundant issue into a canonical target issue, transferring comments and closing the source."""
    src = _find_issue(source_issue)
    tgt = _find_issue(target_issue)
    src_id = src["id"]
    tgt_id = tgt["id"]
    src_ident = src.get("identifier", src_id)
    tgt_ident = tgt.get("identifier", tgt_id)

    # Transfer comments from source to target
    try:
        comments_res = _request(f"/api/collections/comments/records?filter=(issue='{src_id}')&sort=created")
        comments = comments_res.get("items", []) if isinstance(comments_res, dict) else []
        for c in comments:
            content = f"*[Merged from {src_ident}]*\n\n" + c.get("content", "")
            _request("/api/collections/comments/records", method="POST", data={
                "issue": tgt_id,
                "author": c.get("author", "Agent"),
                "content": content
            })
    except Exception:
        pass

    # Add audit comment to target
    try:
        _request("/api/collections/comments/records", method="POST", data={
            "issue": tgt_id,
            "author": "Board Janitor",
            "content": f"🔗 **Merged issue {src_ident}** (`{src.get('title')}`) into this ticket.\n**Reason:** {reason}"
        })
    except Exception:
        pass

    # Mark source issue as cancelled / closed with note
    _request(f"/api/collections/issues/records/{src_id}", method="PATCH", data={
        "status": "cancelled",
        "description": (src.get("description") or "") + f"\n\n> ⚠️ **Merged into {tgt_ident}**: {reason}"
    })

    return {
        "success": True,
        "merged_into": tgt_ident,
        "closed_issue": src_ident,
        "reason": reason
    }

@mcp.tool()
def sweep_board_pollution(
    project: Optional[str] = None,
    dry_run: bool = True
) -> Dict[str, Any]:
    """Audit the board for junk probe records, duplicate titles, and orphaned test artifacts. Optionally sweep them."""
    filter_q = f"?filter=(project='{_find_project_id(project)}')&perPage=200" if project else "?perPage=200"
    issues_res = _request(f"/api/collections/issues/records{filter_q}")
    issues = issues_res.get("items", []) if isinstance(issues_res, dict) else []
    junk_exact = {"123", "123123", "test", "Test issue", "Probe5 test", "SSE-A", "SSE-B"}
    junk_prefixes = ("Live QA probe ", "Search Identifier Probe ", "Export CustomFields ", "Export Fixture ")
    swept = []
    for it in issues:
        title = (it.get("title") or "").strip()
        iid = it.get("id")
        ident = it.get("identifier", iid)
        if title in junk_exact or any(title.startswith(p) for p in junk_prefixes):
            swept.append({"id": iid, "identifier": ident, "title": title, "action": "delete_junk"})
            if not dry_run:
                try:
                    _request(f"/api/collections/issues/records/{iid}", method="DELETE")
                except Exception:
                    pass
    return {"dry_run": dry_run, "scanned_issues": len(issues), "actions_count": len(swept), "actions": swept}

@mcp.tool()
def semantic_review_issue(
    title: str,
    description: str = "",
    project: Optional[str] = None
) -> Dict[str, Any]:
    """Review a candidate issue against active board issues using neural embeddings & cross-encoder reranker.

    Classifies the candidate as ALLOWED, REJECTED_DUPLICATE, ATTACHED_SUBTASK, AUTO_LINKED, or REJECTED_VAGUE.
    """
    proj_id = _find_project_id(project) if project else None
    data = {"title": title, "description": description}
    if proj_id:
        data["project"] = proj_id
    return _request("/api/projectbase/semantic/review", method="POST", data=data)

@mcp.tool()
def rerank_issues(
    query: str,
    project: Optional[str] = None,
    candidate_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Score and rerank candidate issues against a query using hybrid dense + n-gram cross-encoder scoring."""
    proj_id = _find_project_id(project) if project else None
    data = {"query": query}
    if proj_id:
        data["project"] = proj_id
    if candidate_ids:
        data["candidate_ids"] = candidate_ids
    return _request("/api/projectbase/semantic/rerank", method="POST", data=data)

@mcp.tool()
def cluster_duplicates(
    project: Optional[str] = None,
    threshold: float = 0.65
) -> Dict[str, Any]:
    """Cluster project issues by semantic similarity to identify duplicate groups and clutter."""
    proj_id = _find_project_id(project) if project else None
    data = {"threshold": threshold}
    if proj_id:
        data["project"] = proj_id
    return _request("/api/projectbase/semantic/cluster", method="POST", data=data)

@mcp.tool()
def consolidate_duplicates(
    canonical_issue: str,
    duplicate_issues: List[str],
    reason: str = "Consolidated by ProjectBase Semantic Brain"
) -> Dict[str, Any]:
    """Consolidate multiple duplicate issues into a single canonical issue, transferring comments and marking duplicates cancelled."""
    can = _find_issue(canonical_issue)
    dup_ids = [_find_issue(d)["id"] for d in duplicate_issues]
    return _request("/api/projectbase/semantic/consolidate", method="POST", data={
        "canonical_issue_id": can["id"],
        "duplicate_issue_ids": dup_ids,
        "reason": reason
    })

@mcp.tool()
def get_semantic_metrics() -> Dict[str, Any]:
    """Get real-time clutter reduction metrics, blocked duplicate counters, and reranker telemetry."""
    return _request("/api/projectbase/semantic/metrics")

@mcp.tool()
def reindex_semantic_embeddings() -> Dict[str, Any]:
    """Batch vectorize and index all workspace issues into dense embeddings."""
    return _request("/api/projectbase/semantic/embeddings/reindex", method="POST")

if __name__ == "__main__":
    mcp.run()
