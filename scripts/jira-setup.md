# Jira Backend Setup Runbook (Phase 2)

**Owned by**: Foundation workstream (US1). **Contract baseline**: FROZEN v1.0.0 —
names below MUST match `contracts/jira-config.md` and `data-model.md` exactly.
**How to run**: Some objects (projects, issues, labels, issue-links) can be
managed via the Jira MCP tools in this repo. Jira *admin* objects (workflow,
custom fields, saved filters, dashboard, automation) cannot be created through
the MCP tools — they are configured by a Jira admin in the UI (or via the Jira
REST admin APIs). This runbook is the single executable spec for that admin
setup and is what Phase 4/5 skills and the doctor verify against.

## 0. Projects (T005 — verified live 2026-08-02)

All 10 canonical domains resolve to real projects via `jira_get_all_projects`,
matching `.jira.project_discovery.required_domains` / `.jira.key_overrides` in
`project-config.json`. No projects need creating.

| Domain | Key | Jira name |
|--------|-----|-----------|
| Career | `BF` | B - Career(+ Self Marketing/Branding) |
| Family | `AT` | B - Family |
| House | `HM` | Important House Work |
| Finance | `FIN` | B - Finance |
| Network | `BR` | B - Relationships/Network |
| Health/Diet | `BH` | B - Health/Diet/Workout |
| LifeOS | `BS` | B - System |
| Docs | `MDP` | Docs |
| Ideas (fallback) | `ART` | Any Idea/Task Dump |
| Nush | `NSH` | Nush |

`BPD` (B - Personal Development) exists but is NOT part of the 10-domain map.
The capture skill must never route to it.

## 1. Workflow (T006)

Create one canonical **Life OS workflow** and assign it to all 9 projects via a
single shared workflow scheme. Status order is strict:

```
Backlog → Ready → Todo-Week → In Progress → Blocked Or FollowUp → Done
```

Transitions (exact edges; no skipping required by the contract, but the scheme
must at least expose these linear steps):

```
Backlog → Ready
Ready → Todo-Week
Todo-Week → In Progress
In Progress → Blocked Or FollowUp
Blocked Or FollowUp → Done
```

Plus the friction-respecting moves used by skills (never delete/re-hide):
- `Todo-Week → Blocked Or FollowUp` (friction re-slot / hold visible)
- `Todo-Week → Ready` (re-slot back)
- `Blocked Or FollowUp → Done`

Mapping to Jira status categories: `Backlog`/`Ready`/`Todo-Week`/`Blocked Or FollowUp`
= To Do; `In Progress` = In Progress; `Done` = Done.

## 2. Labels (T007)

Tick all of these exact labels once in Jira (create-on-demand is fine — Jira
auto-creates labels on first use). Names MUST match `data-model.md`:

| Label | Notes |
|-------|-------|
| `loc:<value>` | constraint = location |
| `time:<value>` | constraint = time |
| `person:<value>` | constraint = person |
| `week:YYYY-Www` | target week, e.g. `week:2026-W32` |
| `needs-research` | research pending |
| `research-done` | research complete |
| `routine:<name>` | routine task type, e.g. `routine:gym` |
| `internal` | antivisible self-commitment (never re-hide) |
| `long-stuck` | auto-flagged when unchanged ≥28d in a non-terminal status |

## 3. Metric Custom Fields (T008)

The 8 metric fields do **not** exist yet — verified via `jira_search_fields`
2026-08-02 (no `*perfection` / `*streak` / `*tier` custom fields present).
Create them global (all 9 projects):

| Field name | Type | Purpose |
|------------|------|---------|
| `planperfection` | Number | weekly plan-perfection % |
| `deliveryperfection` | Number | weekly delivery-perfection % |
| `deliverystreak` | Number | consecutive days with ≥1 Done |
| `practicestreak:<name>` | Number | consecutive-days counter per practice (e.g. `practicestreak:gym`) |
| `cleanweekstreak` | Number | consecutive weeks ≥80% delivery |
| `statustier` | Select (god-mode/elite/good/average/hopeless) | derived tier |
| `maxdelivery` | Number | peak delivery-perfection (for tier basis) |
| `targetsweek` | Text | current `week:` + 🏆 trophies per target hit |

## 4. Saved Filters (T009)

Create 5 shared saved filters. JQL:

| Filter | JQL |
|--------|-----|
| Pipeline | `resolution = Unresolved ORDER BY created ASC` |
| Backlog | `resolution = Unresolved AND status in (Backlog, Ready, Todo-Week, "In Progress", "Blocked Or FollowUp") ORDER BY rank ASC` |
| Todo-Week | `resolution = Unresolved AND status = "Todo-Week" ORDER BY rank ASC` |
| Long-stuck | `status in (Ready, "Todo-Week", "Blocked Or FollowUp") AND updated <= -28d ORDER BY updated ASC` |
| Done-this-week | `status changed to Done during (startOfWeek(), now()) ORDER BY resolved DESC` |

(Adjust `startOfWeek()`/`startOfDay()` to local tz as needed; the semantics —
"this week's Done" — are what scoring depends on.)

## 5. Dashboard (T010)

Create one **Life OS** dashboard with 4 gadgets, ~15-min refresh, low-effort:

1. **Pipeline** — add gadget backed by the Pipeline filter (primary view).
2. **Long-stuck** — gadget backed by the Long-stuck filter (months-forgotten).
3. **Todo-Week** — gadget backed by the Todo-Week filter (this week's picks).
4. **Streak / plan-deliver slip** — one small stat gadget (or a two-value
   "Two Dimensional Statistics" / text gadget) showing: plan-perfection %,
   delivery-perfection %, current streaks, status tier, this-week trophies. The
   agent updates these values weekly (see `wb2-scoring.md`).

## 6. Capture-Routing Rule (T011)

Foundational routing for ambiguous captures. The routing logic lives in the
`capture` skill (Phase 3) but the fallback contract is owned here:

**Rule**: any capture that does not map cleanly to a domain project
(Career/Family/House/Finance/Network/Health-Diet/LifeOS/Docs) is routed to the
**Ideas** project (`ART`) — never an error. The `Ideas` project is the
catch-all for unstructured/unrouted captures.

To harden this at the Jira level (optional, in addition to the skill logic),
create an **automation rule** per capture project: *When an issue is created
with empty summary/domain heuristics, flag it for `Ideas` review* — label
`internal` where applicable. This is defensive; the skill is the primary
router.

## 7. Verification (matches quickstart §1)

- [ ] 9 projects exist (verified).
- [ ] Workflow order matches §1.
- [ ] All labels + metric custom fields exist (§2, §3).
- [ ] 5 saved filters searchable (§4).
- [ ] Dashboard shows 4 gadgets with live data (§5).
- [ ] Capture-routing falls back to `Ideas` (§6).
