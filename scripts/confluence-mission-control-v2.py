#!/usr/bin/env python3
"""Mission Control v2 — HTML-mockup-style layout for Confluence Cloud, native-rendered.

Builds a NEW Confluence page (default child of the v1 dashboard) with:
- Colored Quick Stats panels (jirachart bar/pie per status -> LIVE counts)
- Status Distribution pie (live jirachart)
- Two-column Ready-to-Pick / Blocked (live jira macros)
- Weekly Delivery snapshot (static counts + WB2 metrics)
- By Domain matrix (static counts at publish time)
- Long-Stuck (live jira macro)
- Per-domain live macro list

Verified macro formats (2026-08-10):
- jira issues:  <ac:structured-macro ac:name="jira"> (server/serverId/jqlQuery/columns)
- jira chart:   <ac:structured-macro ac:name="jirachart"> (server/serverId/jql/chartType/statType)

Usage:
  export JIRA_API_TOKEN=...
  python3 scripts/confluence-mission-control-v2.py            # create the page
  python3 scripts/confluence-mission-control-v2.py --page <id> # update existing
  python3 scripts/confluence-mission-control-v2.py --dry-run   # preview body
"""
import argparse
import base64
import html
import json
import os
import sys
import urllib.request
import urllib.parse

SITE = "https://mayurzenith.atlassian.net"
DEPLOY_BASE = f"{SITE}/wiki"

SERVER = "System Jira"
SERVER_ID = "1c979962-873c-3fbb-ad9e-7066ed9bed18"
PROJECTS = "BF, FAM, HM, FIN, BR, BH, BS, MDP, ART"
COLUMNS = "key,summary,type,status,assignee,priority,updated"

# Wait: this new page lives under the same personal space as the v1 page.
SPACE = "~55705868920512ba474f8f83034ff405a73691"
# Parent = the existing v1 dashboard (page 98311). Creates the v2 as a child.
PARENT_ID = "98311"

DOMAINS = [
    ("Career", "BF"), ("Family", "FAM"), ("House", "HM"), ("Finance", "FIN"),
    ("Network", "BR"), ("Health/Diet", "BH"), ("LifeOS", "BS"),
    ("Docs", "MDP"), ("Next Ideas", "ART"),
]

# Statuses in dashboard order with panel colors (Confluence panel macro names).
STATUS_OUT = [
    ("Backlog", "note", "📋"),
    ("Ready", "tip", "🏁"),
    ("Todo-Week", "info", "📝"),
    ("In Progress", "warning", "🔨"),
    ("Blocked Or FollowUp", "warning", "⛔"),
    ("Done · this week", "success", "✅"),
]


def jira(jql: str, limit: int = 15) -> str:
    return (
        f'<ac:structured-macro ac:name="jira" ac:schema-version="1">'
        f'<ac:parameter ac:name="server">{SERVER}</ac:parameter>'
        f'<ac:parameter ac:name="serverId">{SERVER_ID}</ac:parameter>'
        f'<ac:parameter ac:name="jqlQuery">{html.escape(jql, quote=True)}</ac:parameter>'
        f'<ac:parameter ac:name="maximumIssues">{limit}</ac:parameter>'
        f'<ac:parameter ac:name="columns">{COLUMNS}</ac:parameter>'
        f"</ac:structured-macro>"
    )


def jirachart(jql: str, chart_type: str = "pie", stat_type: str = "issuetype",
              width: int = 0) -> str:
    """LIVE Jira chart. chartType: pie|column|bar. statType: statuses|assignees|issuetype...
    NOTE: only 'pie' is supported in this Confluence Cloud instance —
    chartType=column/bar renders "The chart is not supported." (verified 2026-08-10)."""
    w = f'<ac:parameter ac:name="width">{width}</ac:parameter>' if width else ""
    return (
        f'<ac:structured-macro ac:name="jirachart" ac:schema-version="1">'
        f'<ac:parameter ac:name="server">{SERVER}</ac:parameter>'
        f'<ac:parameter ac:name="serverId">{SERVER_ID}</ac:parameter>'
        f'<ac:parameter ac:name="jql">{html.escape(jql, quote=True)}</ac:parameter>'
        f'<ac:parameter ac:name="chartType">{chart_type}</ac:parameter>'
        f'<ac:parameter ac:name="statType">{stat_type}</ac:parameter>{w}'
        f"</ac:structured-macro>"
    )


def panel(color: str, content: str) -> str:
    return (f'<ac:structured-macro ac:name="{color}" ac:schema-version="1">'
            f'<ac:rich-text-body>{content}</ac:rich-text-body>'
            f"</ac:structured-macro>")


def col(content: str) -> str:
    return f'<ac:layout-cell><ac:parameter ac:name="width">{8}</ac:parameter>{content}</ac:layout-cell>'


def build_body(counts: dict) -> str:
    if not counts:
        counts = {"by_status": {}, "done_week": 0, "total_open": 0,
                  "open_per_domain": {}}
    bs = counts.get("by_status", {})
    dweek = counts.get("done_week", 0)
    blocks = []

    # --- Header ---
    blocks.append("<h1>&nbsp;</h1>")
    blocks.append(f"<p>Jira workflow across all Life OS domains — live charts + macros. "
                  f"{counts.get('total_open', 0)} open issues. "
                  f"Updated {os.environ.get('BUILD_DATE', 'on publish')}.</p>")

    # --- Quick Stats: one horizontal row (table), counts only, no charts ---
    blocks.append("<h2>📊 Quick Stats</h2>")
    ths = "".join(f'<th style="text-align:center;">{emoji} {label}</th>'
                  for label, _, emoji in STATUS_OUT)
    tds = "".join(f'<td style="text-align:center;"><p style="font-size:1.6em;"><strong>{bs.get(label.split(" ·")[0], 0)}</strong></p></td>'
                  for label, _, _ in STATUS_OUT)
    blocks.append('<table>'
                  '<colgroup>'
                  + "".join('<col style="width:16.6%;" />' for _ in STATUS_OUT)
                  + '</colgroup>'
                  f'<thead><tr>{ths}</tr></thead>'
                  f'<tbody><tr>{tds}</tr></tbody>'
                  '</table>')

    # --- Status Distribution removed (2026-08-11): ugly pie not wanted ---

    # --- Focus: combined — In Progress on top, Ready/Todo-Week below, priority High-first ---
    blocks.append("<h2>🧭 Focus</h2>")
    blocks.append("<h3>🎯 In Progress first, then Todo-Week</h3>"
                  + jira(f'project in ({PROJECTS}) AND status in ("In Progress","Todo-Week") ORDER BY status ASC, priority DESC', 20))

    # --- Blocked / FollowUp (below Focus, above Delivery) ---
    blocks.append("<h3>⛔ Blocked / FollowUp</h3>"
                  "<p>Blocked or awaiting something.</p>"
                  + jira(f'project in ({PROJECTS}) AND status = "Blocked Or FollowUp" ORDER BY priority DESC, updated ASC', 20))

    # --- Next Ideas (ART) standalone, below Blocked/FollowUp ---
    blocks.append("<h2>💡 Next Ideas (ART)</h2>")
    blocks.append(jira('project = "ART" AND statusCategory != Done ORDER BY updated ASC', 15))

    # --- Weekly Delivery snapshot (static) ---
    blocks.append("<h2>📅 Weekly Delivery Snapshot</h2>")
    blocks.append(f"<p>✅ <strong>Done this week:</strong> {dweek} &nbsp;·&nbsp; "
                  f"📝 <strong>Todo-Week:</strong> {bs.get('Todo-Week', 0)}</p>")

    # --- By Domain matrix (static, at publish time) ---
    blocks.append("<h2>🏢 By Domain</h2>")
    rows = []
    headers = (["<th>Domain</th>"]
               + [f"<th>{h}</th>" for h in ["Backlog", "Ready", "Todo", "InProg", "Wait", "Done"]])
    rows.append("<tr>" + "".join(headers) + "</tr>")
    for name, key in DOMAINS:
        d = counts["open_per_domain"].get(key, {})
        tds = (f"<td>{name} ({key})</td>"
               + "".join(f"<td>{d.get(s, 0)}</td>"
                         for s in ["Backlog", "Ready", "Todo-Week",
                                   "In Progress", "Blocked Or FollowUp", "Done"]))
        rows.append(f"<tr>{tds}</tr>")
    blocks.append("<table>"
                  + "<tbody>" + "".join(rows) + "</tbody>"
                  + "</table>")

    # --- Per-domain live list ---
    blocks.append("<h2>🗂️ Open by Domain (live)</h2>")
    for name, key in DOMAINS:
        if key == "ART":
            continue
        blocks.append(f"<h3>{name} ({key})</h3>")
        blocks.append(jira(f'project = "{key}" AND statusCategory != Done ORDER BY updated ASC', 8))

    # --- Long-Stuck (live) ---
    blocks.append("<h2>🔥 Long-Stuck (&gt;28 days)</h2>")
    blocks.append(jira(
        f'project in ({PROJECTS}) AND statusCategory != Done AND updated <= -28d ORDER BY updated ASC', 20))

    return "\n".join(blocks)


def auth_header() -> dict:
    user = os.environ.get("JIRA_USER", "mayurzenith@gmail.com")
    token = os.environ.get("JIRA_API_TOKEN")
    if not token:
        sys.exit("error: JIRA_API_TOKEN not set")
    raw = f"{user}:{token}".encode()
    return {"Authorization": "Basic " + base64.b64encode(raw).decode(),
            "Content-Type": "application/json"}


def jira_count(jql: str, headers: dict) -> int:
    base = f"{SITE}/rest/api/3/search/jql"
    total, token = 0, None
    while True:
        q = [("jql", jql), ("maxResults", "50")]
        if token:
            q.append(("nextPageToken", token))
        url = base + "?" + "&".join(f"{k}={urllib.parse.quote(v)}" for k, v in q)
        d = json.loads(urllib.request.urlopen(
            urllib.request.Request(url, headers=headers)).read())
        total += len(d.get("issues", []))
        token = d.get("nextPageToken")
        if not token:
            break
    return total


def build_counts(headers: dict) -> dict:
    statuses = ["Backlog", "Ready", "Todo-Week", "In Progress", "Blocked Or FollowUp", "Done"]
    counts = {
        "PROJECTS": PROJECTS,
        "total_open": jira_count(f'project in ({PROJECTS}) AND statusCategory != Done', headers),
        "by_status": {s: jira_count(f'project in ({PROJECTS}) AND status = "{s}"', headers)
                      for s in statuses},
        "done_week": jira_count(
            f'project in ({PROJECTS}) AND status = "Done" AND updated >= startOfWeek()', headers),
        "open_per_domain": {},
    }
    for name, key in DOMAINS:
        counts["open_per_domain"][key] = {
            s: jira_count(f'project = "{key}" AND status = "{s}"', headers) for s in statuses}
    return counts


def get_ancestor(headers: dict) -> str:
    return PARENT_ID


def create_or_update(page_id: str, parent_id: str, title: str, body: str,
                     headers: dict) -> dict:
    if page_id:
        url = f"{DEPLOY_BASE}/rest/api/content/{page_id}?expand=version"
        cur = json.loads(urllib.request.urlopen(
            urllib.request.Request(url, headers=headers)).read())
        version = cur["version"]["number"] + 1
        payload = {"id": page_id, "type": "page", "title": title,
                   "version": {"number": version},
                   "body": {"storage": {"value": body, "representation": "storage"}}}
        req = urllib.request.Request(
            f"{DEPLOY_BASE}/rest/api/content/{page_id}",
            data=json.dumps(payload).encode(), headers=headers, method="PUT")
    else:
        payload = {"type": "page", "title": title,
                   "space": {"key": SPACE},
                   "ancestors": [{"id": parent_id}],
                   "body": {"storage": {"value": body, "representation": "storage"}}}
        req = urllib.request.Request(
            f"{DEPLOY_BASE}/rest/api/content",
            data=json.dumps(payload).encode(), headers=headers, method="POST")
    return json.loads(urllib.request.urlopen(req).read())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", default="", help="existing page id to update; blank = create new")
    ap.add_argument("--title", default="Mission Control v2 🔥🔥")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-counts", action="store_true",
                    help="skip live counting (uses zeros) for faster dry-run")
    args = ap.parse_args()

    headers = auth_header()
    counts = {} if args.no_counts else build_counts(headers)
    body = build_body(counts)
    nm = body.count('ac:name="jira"') + body.count('ac:name="jirachart"')
    print(f"built body: {len(body)} bytes, {nm} jira(+chart) macros")

    if args.dry_run:
        print("dry-run: not publishing")
        open("/tmp/mc-v2-body.html", "w").write(body)
        print("body written to /tmp/mc-v2-body.html")
        return

    res = create_or_update(args.page, get_ancestor(headers), args.title, body, headers)
    print(f"published: id={res.get('id')} title={res.get('title')} "
          f"version={res.get('version', {}).get('number')}")
    print(f"view: https://mayurzenith.atlassian.net/wiki/spaces/~/"
          f"{res.get('id')}")


if __name__ == "__main__":
    main()