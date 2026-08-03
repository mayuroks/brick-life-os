# Life OS — Agent Handover Document

**Version:** 1.0  
**Date:** 2026-08-01  
**Owner:** MacBook 14" Pro  
**Purpose:** Instructions for an OpenCode/Claude agent to implement and maintain a personal Life Operating System.

---

## 1. Objectives

### What this system solves

| Problem | Solution |
|---------|----------|
| Backlog dump across 8+ life areas with no visibility | Single cross-project pipeline in JIRA |
| No connection between dreams and daily tasks | Goals project with Epics linked to work items |
| Manual grooming, research, environment prep | AI agents handle groom / research / night-before prep |
| Calendar disconnected from task backlog | Night-before ceremony slots tasks into calendar buckets |
| No measure of what got done | Weekly scoreboard + agent summary via Telegram/Discord |

### What success looks like

- **Morning:** Open calendar only. Do what's there. No JIRA browsing.
- **Anytime:** Voice/text dump to Telegram or Discord → lands in JIRA Backlog.
- **Sunday 20 min:** Agent grooms backlog, proposes weekly picks, you approve.
- **Every night 15 min:** Agent preps tomorrow (calendar slots, prep subtasks, maid/meal messages).
- **Feedback loop:** Tell the agent in chat what to change. It updates JIRA + config.

### Non-goals (do not build in v1)

- Obsidian sync (optional later for research dumps only)
- Mission Control dashboard (optional later)
- Replacing JIRA (JIRA stays — sync, mobile, family sharing)
- Perfect automation on day one — iterate via chat feedback

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CAPTURE (anytime)                                          │
│  Telegram / Discord voice or text → OpenClaw → JIRA Backlog │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  JIRA (source of truth for tasks)                           │
│  8 life projects + 1 Goals project                          │
│  Pipeline statuses + constraint labels                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE CODE (deep work sessions)                           │
│  Skills: weekly-groom, night-prep, research                 │
│  Reads/writes JIRA via API or MCP                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CALENDAR (execution surface — only UI for daily work)      │
│  Apple Calendar or Google Calendar                            │
│  Time buckets + task events placed night before             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  NOTIFY                                                     │
│  OpenClaw cron → Telegram/Discord morning brief + EOD recap │
└─────────────────────────────────────────────────────────────┘
```

### Tool roles

| Tool | Role |
|------|------|
| **JIRA Cloud (free)** | Tasks, pipeline, dreams (Epics), dashboards, mobile sync |
| **OpenClaw** | 24/7 agent, Telegram + Discord, voice capture, cron notifications |
| **Claude Code** | Weekly groom, night prep, research with evidence, JIRA bulk ops |
| **Calendar** | Daily execution — the only screen used on work days |

---

## 3. JIRA Setup (agent must implement)

### 3.1 Projects (life buckets)

Create or map these projects (keys are examples — adjust to available keys):

| Project | Key (example) | Scope |
|---------|---------------|-------|
| Career | `CAR` | Job, skills, interviews |
| Family | `FAM` | Family obligations |
| House Work | `HSE` | Home maintenance, chores |
| Finance | `FIN` | Money, taxes, investments |
| Relations / Network | `NET` | Friends, networking |
| Health / Diet | `HLT` | Gym, diet, medical |
| Life OS | `LOS` | System maintenance, tooling |
| Docs | `DOC` | Documents, admin paperwork |
| Random Ideas | `IDE` | Unsorted captures |
| **Goals** | `GOL` | Dream Epics only — no daily tasks here |

### 3.2 Pipeline statuses (workflow)

Apply one shared workflow across all task projects:

```
Backlog → Ready → Todo-Week → In Progress → Waiting → Follow-up → Done
```

| Status | Meaning | Who moves it |
|--------|---------|--------------|
| **Backlog** | Raw dump, ungroomed | Auto on capture; user voice dump |
| **Ready** | Groomed, estimated, constraints tagged | Agent during weekly groom |
| **Todo-Week** | Picked for this week (`week:YYYY-Www` label) | Agent proposes; user approves Sunday |
| **In Progress** | Actively doing today | User or agent when calendar block starts |
| **Waiting** | Blocked on person / external confirmation | User or agent |
| **Follow-up** | Done for now, needs revisit | User or agent |
| **Done** | Complete | User marks after doing |

### 3.3 Labels

**Pipeline week tag (set every Sunday):**
```
week:2026-W31
```

**Constraint labels (apply during groom):**
```
constraint:location    — must physically go somewhere
constraint:time        — fixed time window (also set duedate)
constraint:person      — needs someone's approval/confirmation
constraint:prep        — environment prep task (duffel, meal, recipe)
```

**Dream link (set during groom):**
```
dream:physique
dream:wealth
dream:family
dream:presence
```
(Or link via Epic parent — preferred.)

**Routine:**
```
routine
routine:gym
routine:pre-workout
```

**Agent markers:**
```
needs-research       — agent should research before Ready
research-done        — research attached in description
agent-groomed        — agent touched this item
```

### 3.4 Goals project — Dreams as Epics

In project `GOL`, create Epics (examples — user will customize):

| Epic | Dream statement |
|------|-----------------|
| Physique | High metabolism, visible muscle, impress physically |
| Wealth | Financial freedom, no money stress |
| Presence | Mentally present with family, not distracted |
| Craft | Mastery in career, respected expertise |
| Home | Calm, organized living space |

**Rule:** Every non-trivial task in Ready or Todo-Week must link to a Goal Epic (via Epic Link or parent). Agent flags unlinked items during groom.

### 3.5 Issue types

| Type | Use |
|------|-----|
| **Epic** | Dreams (Goals project only) |
| **Story** | Actionable work item |
| **Sub-task** | Prep tasks, research steps, environment setup |
| **Task** | Simple one-off (routines, reminders) |

### 3.6 Custom fields (optional but recommended)

| Field | Type | Use |
|-------|------|-----|
| `Constraint Summary` | Short text | e.g. "Must be at gym by 7am" |
| `Prep For` | Issue link | Sub-task links to parent |
| `Research Due` | Date | When research must be done (1 week before parent) |
| `Environment Note` | Text | e.g. "Recipe for maid: link or text" |

If custom fields are not available on free tier, use labels + description.

---

## 4. JIRA Filters (JQL)

Save these as filters and star them.

### Pipeline — all open across projects
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status != Done
ORDER BY status ASC, priority DESC, updated DESC
```
**View:** List, grouped by Status. **Bookmark this** — primary pipeline view.

### Backlog (ungroomed)
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status = Backlog
ORDER BY created DESC
```

### Ready (groomed, not yet picked)
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status = Ready
ORDER BY priority DESC, updated DESC
```

### Todo-Week (current week picks)
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status = "Todo-Week"
AND labels = week:2026-W31
ORDER BY duedate ASC
```
> Agent updates `week:YYYY-Www` label every Sunday.

### In Progress + Waiting + Follow-up
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status in ("In Progress", Waiting, Follow-up)
ORDER BY status ASC, updated DESC
```

### Done this week (scoreboard)
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status changed to Done during (startOfWeek(), endOfWeek())
ORDER BY updated DESC
```

### Stale (>30 days untouched)
```jql
project in (CAR, FAM, HSE, FIN, NET, HLT, LOS, DOC, IDE)
AND status != Done
AND updated <= -30d
ORDER BY updated ASC
```

### Routines today
```jql
labels = routine
AND (duedate = now() OR duedate is EMPTY)
AND status != Done
ORDER BY priority DESC
```

### Needs research
```jql
labels = needs-research
AND labels != research-done
AND status in (Backlog, Ready)
ORDER BY "Research Due" ASC
```

### Waiting on person
```jql
labels = constraint:person
AND status = Waiting
ORDER BY updated ASC
```

---

## 5. JIRA Dashboards

JIRA dashboards max 3 columns. Use 2 dashboards.

### Dashboard 1: "Today"

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Filter: Todo-Week + In Progress (list, 15 rows) | Filter: Waiting + Follow-up (list, 10 rows) | Filter: Routines today (list, 10 rows) |

Gadget: **Filter Results** for each. Display: List. Refresh: 15 min.

### Dashboard 2: "Weekly Scoreboard"

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Filter: Done this week (list, 20 rows) | Filter: Stale >30d (list, 10 rows) | **Issue Statistics** — group by project |

Review every Sunday after groom.

---

## 6. Ceremonies

### 6.1 Capture (anytime — zero ceremony)

**You do:** Send voice note or text to Telegram or Discord.

**Examples:**
- "Add to backlog: call insurance about policy, needs research on coverage options"
- "Idea: automate monthly expense report, finance project"
- "Family: book pediatrician, constraint person — need wife's availability"

**Agent does:**
1. Transcribe (if voice)
2. Create JIRA issue in correct project
3. Status = Backlog
4. Apply labels (constraint:*, needs-research if mentioned)
5. Reply with issue key: `Created IDE-42 in Backlog`

**You do not:** Open JIRA. Ever, for capture.

---

### 6.2 Weekly Groom (Sunday — 20 minutes)

**When:** Sunday, fixed time (suggest 10:00 AM).  
**Where:** Discord/Telegram thread or Claude Code session.  
**Trigger phrase:** `"Run weekly groom"` or cron auto-start.

#### Agent checklist (execute in order)

**Step 1 — Hygiene (5 min)**
- [ ] Run Stale filter. Flag or close items >60d with no activity.
- [ ] Run Needs Research filter. Complete or schedule research tasks.
- [ ] Move any wrongly-projected items to correct project.

**Step 2 — Groom Backlog → Ready (5 min)**
For each Backlog item:
- [ ] Add clear title + 2-line description
- [ ] Tag constraints (`constraint:location|time|person|prep`)
- [ ] Link to Goal Epic (or ask user which dream it serves)
- [ ] Set priority (Highest / High / Medium / Low)
- [ ] Estimate effort (S / M / L in description)
- [ ] If research needed: create sub-task, `labels = needs-research`, Research Due = 7 days before parent due
- [ ] Move to **Ready**
- [ ] Add label `agent-groomed`

**Step 3 — Propose weekly picks (5 min)**
- [ ] From Ready, select **7 items max** (user may override count)
- [ ] Balance across projects — no more than 2 from same project unless user says so
- [ ] Prefer items linked to active Goal Epics
- [ ] Move selected to **Todo-Week**
- [ ] Apply label `week:YYYY-Www` (current ISO week)
- [ ] Send summary to Telegram/Discord:

```
📋 Weekly Pick — Week 31

1. [CAR-12] Update resume — dream:craft — Tue
2. [HLT-8]  Gym 4x — dream:physique — recurring
3. [FIN-3]  Review insurance — dream:wealth — needs research first
...

⚠️ Stale: 3 items flagged
🔬 Research due this week: FIN-3 sub-task
❓ Unlinked to dream: IDE-19 (suggest: archive?)

Reply: approve / swap #3 for CAR-15 / add more
```

**Step 4 — User approves (2 min)**
- [ ] User replies in chat: approve, swap, add, drop
- [ ] Agent applies changes
- [ ] Agent creates research sub-tasks due this week for next week's work

**Step 5 — Scoreboard (3 min)**
- [ ] Run Done this week filter
- [ ] Send recap:

```
📊 Week 30 Scoreboard
Done: 5 items (CAR-9, HLT-4, FAM-2, FIN-1, LOS-1)
Carried over: 2 (still in Todo-Week)
Stale closed: 1
Dream progress: physique +2 gym sessions, wealth +1 finance task
```

---

### 6.3 Night-Before Prep (daily — 15 minutes)

**When:** Every evening, fixed time (suggest 9:00 PM).  
**Trigger phrase:** `"Prep tomorrow"` or cron auto-start.

#### Agent checklist

**Step 1 — Read tomorrow's calendar (2 min)**
- [ ] Fetch all calendar events for tomorrow
- [ ] Identify **time buckets** (e.g. "Morning deep work 9-11", "Gym 7-8am", "Family 6-8pm")
- [ ] Note fixed events that cannot move

**Step 2 — Slot Todo-Week items into buckets (5 min)**
- [ ] Match tasks to buckets by constraint:
  - `constraint:time` → exact slot
  - `constraint:location` → bucket near location (gym task → gym bucket)
  - `constraint:person` → bucket when person is available
  - No constraint → best-fit bucket by priority
- [ ] Create or update **calendar events** for each slotted task
  - Title: `[KEY-42] Task title`
  - Description: JIRA link + constraint summary
- [ ] If task doesn't fit tomorrow, leave in Todo-Week (do not force)

**Step 3 — Environment prep subtasks (5 min)**
For each tomorrow task, check if prep is needed:

| Tomorrow task | Prep subtask (due tonight) |
|---------------|---------------------------|
| Gym session | Pack duffel (`constraint:prep`, due 9 PM tonight) |
| Gym session | Pre-workout meal — send recipe to maid (due 6 PM tonight) |
| Meeting with person | Review notes, print docs (due night before) |
| Travel / location task | Check route, charge devices, pack bag |
| Cooking / diet task | Grocery list to maid or shopping reminder |

- [ ] Create sub-tasks in JIRA with `constraint:prep`, due tonight
- [ ] Send maid/meal messages if configured (or draft for user approval)

**Step 4 — Send tomorrow agenda (3 min)**
```
🌅 Tomorrow — Saturday Aug 2

07:00  Gym legs day [HLT-8] — duffel prep due tonight ⚠️
09:00  Deep work bucket → [CAR-12] Update resume
12:00  Lunch
14:00  [FIN-3] Insurance research (1hr)
18:00  Family time (fixed)

Prep tonight:
☐ Pack gym duffel (HLT-8-sub-1)
☐ Send maid dinner recipe (HLT-8-sub-2)

Open calendar. Execute. Ignore everything else.
```

**Step 5 — User approves or adjusts (user)**
- Reply in chat: `"move FIN-3 to Sunday"`, `"add call mom at 6pm"`, `"skip gym"`
- Agent updates calendar + JIRA

---

### 6.4 Morning (zero ceremony)

**You do:**
1. Open **calendar only**
2. Do what's there
3. Mark JIRA Done when complete (or tell agent: `"done CAR-12"`)

**Agent does (optional cron 8:30 AM):**
- Send morning brief if not sent night before
- No grooming. No backlog. No dashboard.

---

### 6.5 End of Day (optional — 5 min or automated)

**Trigger:** Cron 9:00 PM or after night-prep.

**Agent sends:**
```
🌙 Day recap — Aug 1
✅ Done: CAR-12, HLT-8
⏳ Carried: FIN-3 (moved to tomorrow)
⏸️ Waiting: NET-5 (blocked on John's reply)

Score: 2/3 planned (67%)
Prep for tomorrow sent ↑
```

---

## 7. Constraint Reference

When grooming or capturing, agent applies constraints:

| Constraint | Label | JIRA field | Calendar behavior | Prep examples |
|------------|-------|------------|-------------------|---------------|
| Location | `constraint:location` | Constraint Summary text | Block must be at/near location | Pack bag, check route |
| Time | `constraint:time` | duedate + time | Fixed calendar slot | Set alarm reminder |
| Person | `constraint:person` | Constraint Summary: who | Slot when person free; status=Waiting until confirmed | Draft message to person |
| Prep | `constraint:prep` | Sub-task of parent | Due night before parent | Duffel, meal, documents |
| Research | `needs-research` | Research Due date | Research block 1 week before | Agent writes evidence in description |

**Reminders outside buckets:** Create JIRA Task with duedate, no calendar block. OpenClaw sends Telegram reminder at due time.

---

## 8. Research Workflow

Research is not same-day. Agent does it **1 week before** the parent task.

1. During groom: if item is complex, add `needs-research` label
2. Create sub-task: `"Research: [parent title]"`
3. Set Research Due = parent duedate minus 7 days
4. Agent research session (Claude Code):
   - Web search, summarize
   - Write findings in sub-task description with **sources/links**
   - Mark sub-task Done, add `research-done` to parent
5. Parent moves to Ready only after `research-done`

**Research output format in JIRA description:**
```markdown
## Research: [topic]
**Date:** 2026-08-01
**For:** CAR-12

### Summary
2-3 sentences.

### Key findings
- Finding 1 [source](url)
- Finding 2 [source](url)

### Recommendation
What to do.

### Open questions
- ?
```

---

## 9. OpenClaw + Telegram/Discord Setup

Agent implementing this system must:

### 9.1 Install OpenClaw
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

### 9.2 Telegram
1. Create bot via @BotFather → save token
2. Configure in OpenClaw wizard or `~/.openclaw/openclaw.json`
3. DM bot → pairing code → `openclaw pairing approve`
4. Set allowlist to owner's Telegram user ID only

### 9.3 Discord
1. Create bot at discord.com/developers
2. Enable Message Content Intent
3. Invite to personal server, note channel ID
4. Configure in OpenClaw
5. Pairing + allowlist same as Telegram

### 9.4 Cron jobs (configure in OpenClaw)
| Cron | Time | Action |
|------|------|--------|
| `weekly-groom` | Sun 10:00 | Trigger weekly groom skill |
| `night-prep` | Daily 21:00 | Trigger night-prep skill |
| `morning-brief` | Daily 08:30 | Send today's calendar summary (backup if night-prep missed) |
| `eod-recap` | Daily 21:30 | Send day scoreboard |

### 9.5 Voice capture
- OpenClaw transcribes voice notes automatically (Whisper/ElevenLabs per config)
- Route to capture handler → JIRA Backlog

---

## 10. Claude Code Skills (create in project)

Create `.claude/skills/` in this repo:

### `weekly-groom/SKILL.md`
- Reads JIRA via API/MCP
- Executes Section 6.2 checklist
- Posts to Telegram/Discord

### `night-prep/SKILL.md`
- Reads JIRA + Calendar via MCP
- Executes Section 6.3 checklist
- Creates calendar events + prep subtasks

### `capture/SKILL.md`
- Parses natural language dump
- Creates JIRA issue in correct project/status

### `research/SKILL.md`
- Takes issue key
- Researches, writes evidence to description
- Marks research-done

### JIRA connection
```bash
# Option A: JIRA MCP server (if available)
claude mcp add jira -- <jira-mcp-command>

# Option B: REST API via skill with JIRA_API_TOKEN env var
# Store token in macOS Keychain, never in repo
```

Required env vars (Keychain or `.env` gitignored):
```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=...
CALENDAR_PROVIDER=apple|google
```

---

## 11. Calendar Rules

- **Calendar is the only daily UI.** Tasks appear as events.
- Event title format: `[KEY-42] Task title`
- Event description: JIRA URL + constraint summary + prep status
- **Time buckets** are recurring calendar blocks (e.g. "Deep Work", "Gym", "Admin"). Agent slots tasks into buckets, not random times.
- Fixed events (meetings, family) are immovable — agent works around them.

---

## 12. Feedback Loop

When something isn't working, message the agent in Telegram or Discord:

| You say | Agent does |
|---------|------------|
| `"too many picks this week, max 5"` | Updates groom skill config |
| `"always prep gym bag night before"` | Adds rule to night-prep skill |
| `"FIN-3 is wrong project, move to DOC"` | Moves issue, learns pattern |
| `"skip morning brief, night prep is enough"` | Disables morning cron |
| `"add dream:energy epic"` | Creates Epic in GOL, links items |
| `"done CAR-12"` | Marks Done in JIRA |
| `"what's waiting on people?"` | Runs Waiting filter, replies |

Agent updates `AGENTS.md` or skill files when rules change. User never edits config manually unless preferred.

---

## 13. Implementation Checklist (for setup agent)

Execute in order. Check off each item.

### Phase 1 — JIRA (Day 1 morning)
- [ ] Verify all 9 projects exist (8 life + Goals)
- [ ] Configure shared workflow statuses
- [ ] Create all labels (Section 3.3)
- [ ] Create Goal Epics in GOL project (ask user for dream statements)
- [ ] Save all JQL filters (Section 4)
- [ ] Build Dashboard 1 (Today) and Dashboard 2 (Scoreboard)
- [ ] Migrate/export any existing JIRA items to Backlog status

### Phase 2 — OpenClaw (Day 1 afternoon)
- [ ] Install OpenClaw on MacBook
- [ ] Configure Telegram bot + pairing
- [ ] Configure Discord bot + pairing (if user uses Discord)
- [ ] Test voice capture → confirm receipt
- [ ] Configure cron jobs (Section 9.4)

### Phase 3 — Claude Code skills (Day 1 evening)
- [ ] Init git repo in this project folder
- [ ] Create `.claude/skills/` with 4 skills (Section 10)
- [ ] Connect JIRA API (token in Keychain)
- [ ] Connect Calendar MCP
- [ ] Test: `"capture idea: test item"` → JIRA Backlog
- [ ] Test: `"weekly groom"` → summary in Telegram
- [ ] Test: `"prep tomorrow"` → calendar events created

### Phase 4 — First real run (Day 2)
- [ ] User does voice dumps for real backlog items
- [ ] Run first weekly groom (or mini-groom if mid-week)
- [ ] Run first night-prep
- [ ] User executes from calendar only on Day 2
- [ ] Collect feedback, adjust skills

---

## 14. File Structure (this repo)

```
life-os-project/
├── HANDOVER-cursor.md       ← this file
├── AGENTS.md                ← agent behavior rules (create during setup)
├── README.md                ← quick start for human
├── .claude/
│   └── skills/
│       ├── weekly-groom/
│       │   └── SKILL.md
│       ├── night-prep/
│       │   └── SKILL.md
│       ├── capture/
│       │   └── SKILL.md
│       └── research/
│           └── SKILL.md
├── config/
│   ├── jira-projects.json   ← project keys + mappings
│   ├── dreams.json          ← epic definitions
│   ├── routines.json        ← recurring routine definitions
│   └── cron.json              ← OpenClaw cron schedule
└── .env.example             ← template, never commit real tokens
```

---

## 15. Daily Quick Reference (print or pin)

```
ANYTIME     → Voice/text Telegram/Discord → Backlog
SUNDAY 10am → "weekly groom" → approve picks → 20 min
EVERY 9pm   → "prep tomorrow" → approve agenda → 15 min
MORNING     → Open calendar → do → "done KEY-42"
FEEDBACK    → Tell agent in chat → it updates rules
NEVER       → Browse backlog during work hours
```

---

## 16. Open Questions for User (setup agent must ask)

1. JIRA site URL and project keys (actual keys may differ from examples)
2. Telegram only, Discord only, or both?
3. Calendar: Apple or Google?
4. Dream Epic statements (personalize Section 3.4)
5. Weekly pick count default (7? 5?)
6. Night prep time (9 PM default OK?)
7. Sunday groom time (10 AM default OK?)
8. Maid/meal integration: auto-send or draft for approval?
9. Family members on JIRA? (read-only access?)

---

*End of handover. Setup agent: read this fully, ask Section 16 questions, then execute Section 13 checklist.*
