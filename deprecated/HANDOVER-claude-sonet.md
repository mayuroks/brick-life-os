# Life OS — Handover Doc
*For: OpenCode agent setup | Owner: [you] | Version: v1 — 2026-08-01*

---

## 1. Objective

Replace the Jira-as-dumpyard problem with a working personal operating system:
- Jira stays the system of record (free tier, mobile sync, API, webhooks — already works across devices).
- An AI agent (via OpenCode / Claude Code / MCP into Jira) does the grooming, prioritizing, prep, and reporting.
- Calendar is the single interface for "what do I do today" — no browsing Jira day to day.
- Discord/Telegram is the feedback loop — a channel to correct/redirect the agent on the fly, not a dashboard.

Success = each morning you open the calendar, everything needed is already there (task + prep done), and you just execute. No planning at point of execution.

---

## 2. System Components

| Component | Role |
|---|---|
| **Jira** (9 projects: Career, Family, House, Finance, Network, Health/Diet, LifeOS, Docs, Ideas) | Source of truth for tasks, backlog, status pipeline |
| **Jira filoard** | Cross-project pipeline view (Backlog → Ready → Todo → In Progress → Waiting-Confirmation → Follow-up → Done) |
| **Google Calendar** | Daily execution surface — synced from Jira via iCal feed + agent-created events |
| **OpenCode/Claude agent** | Grooms backlog, proposes weekly picks, preps next-day checklist, writes summaries |
| **Discord/Telegram bot** | Notifications out (digests, prep checklists) + feedback in (you reply to redirect agent) |
| **Constraint labels** | `loc:*`, `time:*`, `person:*` on issues — captures location/time/person blockers separate from status |

---

## 3. Status Pipeline (Jira)

```
Backlog → Ready → Todo (Today / Sat) → In Progress → Waiting-Confirmation → Follow-up → Done
```

- **Backlog**: raw dump, ungroomed. Anything goes in here first.
- **Ready**: agent has groomed it — clear title, estimate, project tag, constraint labels applied.
- **Todo**: agent proposed for this week, you approved.
- **In Progress**: actively working.
- **Wain a person (approval, response). Label `person:*`.
- **Follow-up**: needs a nudge/check-in later, not blocked on you.
- **Done**: closed.

**Constraint labels** (apply during grooming, not a status):
- `loc:<place>` — must be done physically somewhere
- `time:<window>` — must happen at a specific time
- `person:<name>` — needs someone else's action

**Dashboard view**: Two Dimensional Filter Statistics gadget, X = Status, Y = Project — gives the cross-project pipeline matrix in one view. Full-page saved filter (not gadget) as daily driver.

---

## 4. Ceremonies

### Daily — 15 min, night before (agent-run, you review)
Agent does, in order:
1. Read tomorrow's calendar events + Jira `Todo` items due tomorrow.
2. Check constraint labels on tomorrow's tasks — flag anything needing physical prep (`loc:*`) or person follow-up (`person:*`).
3. Generate tomorrow's checklist: tasks + physical prep items (e.g. "pack gym bag," "message maid — recipe attached," "leave by 8:15 for loc:X").
4. Push checkli/Discord.
5. You: skim, reply with corrections if needed ("move X to Saturday," "drop Y"). Agent updates Jira.

### Weekly — 30 min, Sunday evening (agent-prepped, you run it as a mini-standup)
1. Agent posts a summary before the session: Done this week / still open / stuck in Waiting-Confirmation / new backlog items it found from your research or dumps.
2. Agent proposes next week's `Ready → Todo` picks, one JQL-filtered list per project, weighted toward what's stale or approaching deadlines.
3. You approve/edit picks (reply in chat or Discord).
4. Agent schedules approved items onto the calendar (creates/updates calendar events, respects your existing time-bucket blocks).
5. Agent updates the pinned "why" doc reference if a pick doesn't obviously serve a goal — flags it for you to confirm intent.

### Ad hoc — anytime
- Voice note or Discord/Telegram message → agent drafts spec/tasks in `Backlog`, tags project, does NOT auto-promote to `Ready` without your nod.
- You can always message the agentom, re-prioritize, or explain a red flag it should have raised.

---

## 5. Grooming Rules (what the agent does, not just logs)

- New backlog item → agent gives it: clear title, one-line context, project, rough size, initial constraint labels if obvious.
- Agent does **not** auto-move items to `Todo` — only proposes; you confirm.
- Agent flags (doesn't silently drop): stale items (30+ days no movement), items with unclear next action, items blocked >1 week in Waiting-Confirmation.
- Agent researches when asked ("find options for X") and writes findings back into the issue as a comment, with sources — not just a vague action.

---

## 6. Calendar Rules

- Time-bucket events (recurring blocks you've already set up) — agent fills these with matched `Todo` items respecting the bucket's theme (e.g. Health bucket gets Health project items).
- `time:*` constrained tasks get their own calendar event at that exact time, not folded into a generic bucket.
- `loc:*` tasks get calendar event with location fieldin (enables travel-time awareness later if you want it).
- Reminders for things outside any bucket (rare/one-off) still get a plain calendar reminder — no need to force everything into the bucket system.

---

## 7. Feedback Loop (Discord/Telegram)

- Bot posts: nightly prep checklist, weekly summary + proposed picks, any red flags (stale items, approaching deadlines, stuck approvals).
- You reply in the channel to: reprioritize, correct a groomed item, approve/reject weekly picks, or just tell it something changed.
- Agent should treat channel replies as authoritative corrections and update Jira accordingly — this is the only place besides direct chat where you steer it.

---

## 8. What's Explicitly Manual (by design, not a gap)

- Routine/habit checklist (gym, pre-workout, etc.) — lives as a simple recurring checklist via the bot, not as Jira issues. Recreated daily, not tracked as task lifecycle.
- The "why"/goals doc (motivation — physique, health, etc.) — a pinned reference doc, read by the ng weekly grooming to sanity-check picks, not a task itself.
- Final approval on weekly picks and any Jira status promotion out of Backlog — always you, never fully automatic.

---

## 9. Build Order (for OpenCode agent to execute)

1. Jira: create/confirm status pipeline + constraint label scheme across all 9 projects.
2. Jira: build the Two Dimensional Filter Statistics gadget dashboard + one full-page saved filter as daily driver.
3. Calendar: set up iCal feed subscription from Jira board for read-only sync baseline.
4. Bot: create Telegram bot (BotFather) and/or Discord bot + webhook; wire basic send capability.
5. Agent script: nightly prep job (cron or manually triggered) — calendar + Jira read → checklist → bot push.
6. Agent script: weekly grooming job — Jira read/write, calendar write, bot push + await reply.
7. Test loop: run one real week manually triggered before trusting it to cron.

---

## 10. Open Items / Decisions Still Needed

- [ ] Confirm Telegram vs Discord (or both) as primar
- [ ] Confirm cron schedule for nightly job (suggest 9pm) and weekly job (suggest Sunday 6pm).
- [ ] Write the "why" doc content (goals/motivation reference).
- [ ] Decide habit-checklist tool (bot-only vs separate app).
