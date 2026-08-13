# Data Model: Jira-Powered Life Map Dashboard

Phase 1 output for `012-jira-dashboard`. Covers the domain entities the dashboard renders and
the server runtime config the app owns. Jira is the single source of truth (constitution §I) —
the app holds no durable store.

## Entities

### 1. Project

A Jira project (one of the 9 life domains). Rendered as a "project vector" row.

| Field | Type | Notes |
|-------|------|-------|
| key | string | unique (BF, FAM, HM, FIN, BR, BH, BS, MDP, ART) |
| name | string | display name |
| epicCount | int | derived count of open Epics (FR-002) |
| deepLink | url | Jira project page URL (FR-014/FR-012) |

### 2. Epic

A Jira Epic issue. Rendered as a timeline Gantt bar positioned/sized by dates.

| Field | Type | Notes |
|-------|------|-------|
| id | int | Jira issue id |
| key | string | unique (e.g. PROJ-42) |
| title | string | summary |
| startDate / endDate | date | timeline band placement; missing → default band (FR-003/FR-009) |
| progress | float 0–1 | Done/total ratio of its Stories (FR-004) |
| deepLink | url | Jira issue page URL (FR-014/FR-011) |
| projectKey | string | FK → Project.key |
| stories | list<Story> | for the Epic detail modal (FR-005) |

### 3. Story

A Jira Story/issue under an Epic; drives Epic progress by status.

| Field | Type | Notes |
|-------|------|-------|
| key | string | Jira issue key |
| summary | string | display text |
| status | enum | e.g. Done / not Done (FR-004) |

### 4. Server Runtime Config

Config read by the local dev server from the environment (dotenv `.env`). The app owns it;
Feature 2 supplies the same values as Render env vars.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| PORT | number | no (default 3000) | local bind port |
| JIRA_URL | url | yes | e.g. https://mayurzenith.atlassian.net |
| JIRA_USERNAME | email | yes | Jira account |
| JIRA_API_TOKEN | string | yes | secret; never tracked/served (FR-008) |

## State transitions (proxy auth)

```
env missing/invalid → 400/500 readable "Jira credentials not configured", no crash, page still renders with error
env present, token valid → 200 JSON (projects/epics/stories)
env present, token expired/401 → remove: 401/502 readable auth error, retain last-known data (FR-007)
Jira unreachable → connection error surfaced, retain last-known data (FR-007)
```

## Relationships

- **Project 1—N Epic**: each project contains its Epics (FR-002/FR-003).
- **Epic 1—N Story**: each Epic contains its Stories; Story.status drives Epic.progress (FR-004/FR-005).
- **Server Runtime Config → Jira (SSOT)**: fetch via server-side proxy; no local copy.
- **Server Runtime Config → public/index.html**: serves the static omni-compass dashboard fed by the proxy.
