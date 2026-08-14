#!/usr/bin/env python3
"""Publish the Mission Control dashboard as a Confluence page with live Jira macros.

Reads Jira/Confluence auth from env (never hardcode secrets). Builds Storage-Format
HTML with embedded <ac:structured-macro ac:name="jira"> per status/domain and POSTs
it to the target Confluence page.

Usage:
  export JIRA_API_TOKEN=...            # required
  export JIRA_USER=...                 # default mayurzenith@gmail.com
  python3 scripts/confluence-mission-control.py [--page 98311] [--title "..."] [--dry-run]

Verified 2026-08-10: macro params server=System Jira + serverId=... render live rows
in Confluence Cloud (org 81e3c52d-02c5-45e0-9ae4-5bd587c86df4).
"""
import argparse
import base64
import html
import json
import os
import sys
import urllib.request

SITE = "https://mayurzenith.atlassian.net"
DEPLOY_BASE = f"{SITE}/wiki"

# Verified Confluence app-link for the Jira macro (org 81e3c52d-...).
MAY_SERVER = "System Jira"
MAY_SERVER_ID = "1c979962-873c-3fbb-ad9e-7066ed9bed18"

PROJECTS = "BF, FAM, HM, FIN, BR, BH, BS, MDP, ART"
COLUMNS = "key,summary,type,status,assignee,priority,updated"
MAX_ISSUES = 15

DOMAINS = [
    ("Career", "BF"), ("Family", "FAM"), ("House", "HM"), ("Finance", "FIN"),
    ("Network", "BR"), ("Health/Diet", "BH"), ("LifeOS", "BS"),
    ("Docs", "MDP"), ("Ideas", "ART"),
]


def jira(jql: str, limit: int = MAX_ISSUES) -> str:
    esc = html.escape(jql, quote=True)
    return (
        f'<ac:structured-macro ac:name="jira" ac:schema-version="1">'
        f'<ac:parameter ac:name="server">{MAY_SERVER}</ac:parameter>'
        f'<ac:parameter ac:name="serverId">{MAY_SERVER_ID}</ac:parameter>'
        f'<ac:parameter ac:name="jqlQuery">{esc}</ac:parameter>'
        f'<ac:parameter ac:name="maximumIssues">{limit}</ac:parameter>'
        f'<ac:parameter ac:name="columns">{COLUMNS}</ac:parameter>'
        f"</ac:structured-macro>"
    )


def build_body() -> str:
    blocks = []
    blocks.append("<h1>Mission Control 🔥🔥</h1>")
    blocks.append("<p>Jira workflow across all Life OS domains — live via Jira macros (auto-updates).</p>")

    blocks.append("<h2>📊 Blocked / FollowUp</h2>")
    blocks.append(jira(f'project in ({PROJECTS}) AND status = "Blocked Or FollowUp" ORDER BY updated ASC'))

    blocks.append("<h2>✅ Done · this week</h2>")
    blocks.append(jira(f'project in ({PROJECTS}) AND status = "Done" AND updated >= startOfWeek() ORDER BY updated DESC'))

    blocks.append("<h2>🔴 Ready to Pick Up</h2>")
    blocks.append("<p>Items in Ready or Todo-Week, oldest first.</p>")
    blocks.append(jira(f'project in ({PROJECTS}) AND status in ("Ready", "Todo-Week") ORDER BY updated ASC', 20))

    blocks.append("<h2>🔨 In Progress</h2>")
    blocks.append(jira(f'project in ({PROJECTS}) AND status = "In Progress" ORDER BY updated ASC', 20))

    blocks.append("<h2>📅 Todo-Week</h2>")
    blocks.append(jira(f'project in ({PROJECTS}) AND status = "Todo-Week" ORDER BY updated ASC', 20))

    blocks.append("<h2>🏢 By Domain</h2>")
    for name, key in DOMAINS:
        blocks.append(f"<h3>{name} ({key})</h3>")
        blocks.append(jira(f'project = "{key}" AND statusCategory != Done ORDER BY updated ASC', 10))

    blocks.append("<h2>🔥 Long-Stuck (&gt;28 days)</h2>")
    blocks.append(jira(f'project in ({PROJECTS}) AND statusCategory != Done AND updated <= -28d ORDER BY updated ASC', 20))

    return "\n".join(blocks)


def auth_header() -> dict:
    user = os.environ.get("JIRA_USER", "mayurzenith@gmail.com")
    token = os.environ.get("JIRA_API_TOKEN")
    if not token:
        sys.exit("error: JIRA_API_TOKEN not set")
    raw = f"{user}:{token}".encode()
    return {"Authorization": "Basic " + base64.b64encode(raw).decode(), "Content-Type": "application/json"}


def get_page(page_id: str, headers: dict) -> dict:
    url = f"{DEPLOY_BASE}/rest/api/content/{page_id}?expand=version"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers)) as r:
        return json.loads(r.read())


def put_page(page_id: str, title: str, body: str, headers: dict) -> dict:
    current = get_page(page_id, headers)
    version = current["version"]["number"] + 1
    payload = {
        "id": page_id,
        "type": "page",
        "title": title,
        "version": {"number": version},
        "body": {"storage": {"value": body, "representation": "storage"}},
    }
    req = urllib.request.Request(
        f"{DEPLOY_BASE}/rest/api/content/{page_id}",
        data=json.dumps(payload).encode(),
        headers=headers,
        method="PUT",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", default="98311")
    ap.add_argument("--title", default="Mission Control 🔥🔥")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    body = build_body()
    macro_count = body.count('ac:name="jira"')
    print(f"built body: {len(body)} bytes, {macro_count} jira macros")

    if args.dry_run:
        print("dry-run: not publishing")
        return

    headers = auth_header()
    result = put_page(args.page, args.title, body, headers)
    print(f"published: id={result.get('id')} title={result.get('title')} "
          f"version={result.get('version', {}).get('number')}")


if __name__ == "__main__":
    main()