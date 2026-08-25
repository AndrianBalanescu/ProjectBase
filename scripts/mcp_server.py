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
            data_res = json.loads(resp.read().decode("utf-8"))
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
    custom_fields: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a new issue/work item with automatic ID generation (e.g. PB-1).

    Optionally pass custom_fields as a dict keyed by the project's custom field
    keys (e.g. {"client": "Acme", "gate": "P1"}). Define fields first via the
    project's custom-fields endpoint (see llms.txt / openapi.json)."""
    proj_id = _find_project_id(project)
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

if __name__ == "__main__":
    mcp.run()
