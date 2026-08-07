# WU-04 — Step/tool budget for freeform + research + weekly

> ✅ **COMPLETED (2026-08-08).** Work budgets added to AGENTS.md + weekly/daily/research
> skill docs (commits `a52a283`). Ships as docs; behavioral bound pending live
> weekly/stats-turn observation.

**Change size:** minor–medium · **Savings:** bounds long runs (weekly 15+ RTTs, research 30+ steps)
**Depends on:** nothing · **Standalone:** yes
**Rollback:** revert the SKILL/AGENTS edits

## Goal

Long runs are LLM-bound (~1.4s/model step). The surfaces with **no work cap** are the ones
that run away: freeform/joke (no skill guard), `research` (unbounded fetch loop), and
`run weekly` (O(backlog) groom; the existing `weekly-pick-cap:7` caps *picks*, not *work*).
This unit adds explicit budgets in the skill instructions the agent reads — no code changes
to the bridge needed.

## Current behaviour / code

- `deploy/discord-agent/agent/AGENTS.md:46` — routes input to "ONE surface"; a non-matching
  input falls to **no budget** freeform.
- `deploy/discord-agent/agent/skill/research/SKILL.md:28` — unbounded research loop.
- `deploy/discord-agent/agent/skill/weekly-groom/SKILL.md:62,71,85` — "For each issue" work
  loop, O(backlog), no work cap.
- `deploy/discord-agent/agent/skill/daily/SKILL.md:111-117` — `stats`/`recap`/`stuck` read
  unbounded paged filters.

## Edits (exact)

**File 1:** `deploy/discord-agent/agent/AGENTS.md` — add a global budget block:

```md
## Work budget (always)
- Keep the whole turn to **≤ 8 tool calls and ≤ 12 model steps**. If you would exceed this,
  stop early, summarise what you have, and give the user the best next action.
- For anything that would scan a large list, bound it (e.g. top 10) instead of all of it.
```

**File 2:** `deploy/discord-agent/agent/skill/research/SKILL.md` — if not already applied by
WU-03, ensure the fetch budget line (`max 5 web fetches`) is present (WU-03 and this unit
overlap on research; apply whichever budget text is missing — they do not conflict).

**File 3:** `deploy/discord-agent/agent/skill/weekly-groom/SKILL.md` — add a work cap next to
the existing pick cap (`:85`):

```md
Work budget: groom at most the top 10 issues across Backlog+Pipeline in this run. Keep total
model steps for the whole weekly run under 15; if the backlog is larger, do the highest-impact
10 and note the remainder for next week.
```

**File 4:** `deploy/discord-agent/agent/skill/daily/SKILL.md` — add a bound to the
`stats`/`recap`/`stuck` filter reads (`:111-117`):

```md
For filter scans (stats/recap/stuck), cap to the most recent 10 results per query.
```

## Verify

```sh
cd deploy/discord-agent
grep -n "8 tool calls" agent/AGENTS.md
grep -n "top 10" agent/skill/weekly-groom/SKILL.md
grep -n "most recent 10" agent/skill/daily/SKILL.md
docker build -t lifeos-agent:latest .
# Functional: send "run weekly" and "stats" — assert their runs stay under the stated
# step/tool caps in `run.op` / agent logs (steps <=15 for weekly).
```

## Deploy

`./deploy/ec2-single-box/deploy.sh`, then `sudo systemctl restart discord-agent`.

## Accepted edge cases (keep simple)

- Budgets are prompt-level guidance, not hard enforcement — the model may occasionally
  exceed them; acceptable.
- Truncating scans to top-10 may omit a low-priority-but-relevant item; acceptable (the
  remainder is noted for next week).
