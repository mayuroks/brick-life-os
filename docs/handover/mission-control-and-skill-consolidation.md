# Mission Control + Skill Consolidation — Handover

Date: 2026-08-10 · Commits: `d9de990` → `c0d6014` → `6899f58` (pushed to `origin/main`)

## What shipped

### 1. Single source of truth for agent skills

All agent skills now live **only** in repo-root `.opencode/skill/`:

```
.opencode/skill/
  _shared/wb2-scoring.md
  capture/SKILL.md
  daily/SKILL.md
  research/SKILL.md
  search-online/SKILL.md
  weekly-groom/SKILL.md
```

- The old duplicate at `deploy/discord-agent/agent/skill/` is **deleted**.
- `search-online` (previously deploy-only) was merged into the canonical set.
- `deploy/ec2-single-box/deploy.sh` step **`[2/5]`** now rsyncs
  `.opencode/skill/` → `agent/skill/` on the box at deploy time.
- Box confirmed running all 6 skills post-deploy (verified by `find` on the box).

**Edit skills in `.opencode/skill/` only. Deploy pushes them.** No double maintenance.

### 2. Deploy truth (Brick EC2 box)

- Compute: 1× `t3.micro`, native (no Docker), `ap-south-1`.
- Box IP `15.252.6.196`, instance `lifeos-box` / `i-06885b4aaddfd1b1e`.
- Full deploy: `./deploy/ec2-single-box/deploy.sh` (code + secrets + skills).
- Secrets-only: `./deploy/ec2-single-box/update-secrets.sh`.
- Verify: `systemctl is-active discord-agent; curl -s localhost:3000/health`.
- Post-deploy status: service **active**, health `{"status":"ok","agent":"up","bridge":"up"}`, bridge ready `Brick#4254`.

### 3. Token / credential fix

- `opencode.json` had a **stale/revoked** Jira API token. The **working token**
  used to live in `scripts/mission-control-live.sh`.
- `opencode.json` updated to the working token (gitignored — never committed).
- `scripts/mission-control-live.sh` refactored to read `JIRA_API_TOKEN` from
  **env** (`:?` guard) instead of a hardcoded secret. **Repo is public** — never
  commit a token.

## Mission Control dashboard — state

- `scripts/mission-control-live.sh` — generates dashboard **markdown** from live
  Jira counts (env-based token). Runs: `JIRA_API_TOKEN=... ./scripts/mission-control-live.sh > dash.md`.
- `scripts/mission-control-jql.sh` — emits the JQL per domain/status.
- `deploy/../agent` skills reference the same workflow statuses.
- Tooling note: Jira `/rest/api/3/search` is **removed** — the search endpoint is
  now `/rest/api/3/search/jql` (matters for any script hitting the API).

## PENDING — Confluence-native mission-control page

Goal: publish the mission-control content as a **Confluence page** with live
**Jira macros** (renders/updates as tickets move, readable on mobile).

- Working Confluence token confirmed (same as Jira) against
  `https://mayurzenith.atlassian.net/wiki`.
- Target page: **ID `98311`** — "Mission Control 🔥🔥", tinyui `/x/B4AB`
  (currently version 4, placeholder macros only — JQL incomplete).
- Credentials in `opencode.json` (gitignored) — JIRA site + token.
- Plan: **Approach A** — test-render one Jira macro section first, screenshot to
  confirm live render, then build the full page with embedded `jira` macros per
  status/domain via Storage-Format POST to page `98311`.

Status: **DONE (2026-08-10).**
- Verified the macro Storage Format against a throwaway page: Confluence Cloud's
  Jira macro needs `server=System Jira` + `serverId=1c979962-873c-3fbb-ad9e-7066ed9bed18`
  (the org's app link; wrong refs → "Unable to locate Jira server").
- Published to page `98311` "Mission Control 🔥🔥" (version 6) with 15 embedded
  `jira` macros: Blocked/Waiting, Done-this-week, Ready-to-Pick, In-Progress,
  Todo-Week, one per domain (×9), Long-Stuck. All resolve (0 `jim-error`,
  0 "Unable to locate"); rows hydrate client-side on view.
- Reproducible builder: `scripts/confluence-mission-control.py` (reads
  `JIRA_API_TOKEN` env; `--dry-run` previews; bumps page version). Run anytime:
  `JIRA_API_TOKEN=... python3 scripts/confluence-mission-control.py`.
- Live data exists (old script's "zero issues" was the removed
  `/rest/api/3/search` endpoint; use `/search/jql`). Counts 2026-08-10:
  133 total, 20 Backlog, 6 Ready, 5 In-Progress, 6 Done this week.

## MISSION CONTROL v2 (2026-08-10) — HTML-mockup-style native layout

Built a NEW page (does NOT touch v1 page 98311, still v6):
**id `66161`** — "Mission Control v2 🔥🔥", child of v1. View:
`https://mayurzenith.atlassian.net/wiki/spaces/~/66161`

Layout follows `.lavish/mission-control-dashboard.html` using Confluence-native
building blocks (Confluence CANNOT render Tailwind cards/grids):

- **📊 Quick Stats** — colored panels grid (note/tip/info/warning/success), one per
  status, each with a **live `jirachart` column** (count). Confirmed the chart macro
  is `ac:name="jirachart"` (NOT `jira-chart`) with params `chartType`, `statType=statuses`,
  `jql`, `server`, `serverId` — `jira-chart` + `statField` render unknown-macro.
- **🧁 Status Distribution** — live `jirachart` pie by status.
- **🔴/⛔ two-column** — Ready-to-Pick | Blocked/Waiting via `ac:layout` cells + live
  `jira` macros.
- **📅 Weekly Delivery Snapshot** — static counts (Done-this-week, Todo-Week).
- **🏢 By Domain** — static matrix table (9 domains × 6 statuses), counts at publish.
- **🗂️ Open by Domain** — per-domain live `jira` macro lists.
- **🔥 Long-Stuck** — live `jira` macro.

Builder: `scripts/confluence-mission-control-v2.py` (reproducible).
Run `JIRA_API_TOKEN=... python3 scripts/confluence-mission-control-v2.py` to
re-publish (live-counts the static tables each run; no page id = creates fresh —
pass `--page 66161` to update in place). `--dry-run` previews body.

Stat counts in the static tables snapshot at publish; all charts/lists are live
Jira data. User selected: colored panels for Quick Stats + live-chart counts +
full layout in one pass.

## Open items

- Local `.opencode/skill/` and the box now share one set. Confirm the
  `research` skill's fetch-budget language is coherent with `search-online`
  (both exist; box runs both).