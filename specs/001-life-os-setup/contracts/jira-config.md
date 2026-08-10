# Jira Configuration Contract

**Purpose**: Defines the Jira workspace shape that every other workstream
(Jira config agent, skill agents, streak tracker) depends on. This is the
foundation workstream; other agents assume it is in place.

## Projects (9)

| Project | Purpose |
|---------|---------|
| Career | work/job commitments |
| Family | family commitments |
| House | home/household |
| Finance | money commitments |
| Network | relationships/people |
| Health/Diet | gym, diet, health |
| LifeOS | the system itself |
| Docs | documentation |
| Ideas | fallback for unstructured/unrouted captures |

**Routing rule**: any capture that does not map cleanly to a domain project
defaults to `Ideas` rather than erroring.

## Workflow (exact order)

`Backlog → Ready → Todo-Week → In Progress → Waiting → Done`

## Saved Filters

1. Pipeline (all open)
2. Backlog
3. Todo-Week (this week's picks)
4. Long-stuck (`status in (Ready, Todo-Week, Waiting) AND updated <= -28d`)
5. Done-this-week

## Dashboard Gadgets (15-min refresh, low-effort)

1. **Pipeline** — all open (primary)
2. **Long-stuck** — the months-forgotten list
3. **Todo-Week** — this week's picks
4. **Streak / plan-deliver slip** — small stat gadget (agent updates weekly):
   plan-perfection %, delivery-perfection %, current streaks, status tier,
   this-week trophies.

## Labels

See `../data-model.md` → Label Schema. Exact names MUST match.

## Metric Custom Fields

- `planperfection`, `deliveryperfection`, `deliverystreak`,
  `practicestreak:<name>`, `cleanweekstreak`, `statustier`, `maxdelivery`,
  `targetsweek`

## Setup-time Values (user must confirm)

- Jira site URL
- Auth (MCP server connection)
- Actual project keys (may differ from illustrative names)
