#!/usr/bin/env python3
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
from mcp.server.fastmcp import FastMCP

BASE_URL = os.environ.get("PROJECTBASE_URL", "http://127.0.0.1:8120")

mcp = FastMCP(
    "ProjectBase",
    description="Lightweight Plane & Linear alternative for multi-project Kanban and sprint management"
)

def _request(endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Any:
    url = f"{BASE_URL}{endpoint}"
    req_data = json.dumps(data).encode("utf-8") if data else None
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        raise RuntimeError(f"ProjectBase API error ({e.code}): {err_body}")

def _find_project_id(identifier_or_id: str) -> str:
    if len(identifier_or_id) == 15 and not identifier_or_id.isupper():
        return identifier_or_id
    res = _request(f"/api/collections/projects/records?filter=(identifier='{identifier_or_id.upper()}')")
    if res.get("items"):
        return res["items"][0]["id"]
    res_name = _request(f"/api/collections/projects/records?filter=(name~'{identifier_or_id}')")
    if res_name.get("items"):
        return res_name["items"][0]["id"]
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
    labels: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Create a new issue/work item with automatic ID generation (e.g. PB-1)."""
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
    return _request("/api/collections/issues/records", method="POST", data=data)

@mcp.tool()
def update_issue(
    identifier_or_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    estimate: Optional[int] = None,
    assignee: Optional[str] = None
) -> Dict[str, Any]:
    """Update issue properties such as status (backlog, todo, in_progress, in_review, done, cancelled), priority, or assignee."""
    issue = _find_issue(identifier_or_id)
    data = {}
    if status is not None: data["status"] = status
    if priority is not None: data["priority"] = priority
    if title is not None: data["title"] = title
    if description is not None: data["description"] = description
    if estimate is not None: data["estimate"] = estimate
    if assignee is not None: data["assignee"] = assignee

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
        "content": content
    }
    return _request("/api/collections/comments/records", method="POST", data=data)

@mcp.tool()
def get_stats() -> Dict[str, Any]:
    """Get high-level workspace statistics, completion rates, and status breakdowns."""
    return _request("/api/projectbase/stats")

if __name__ == "__main__":
    mcp.run()
