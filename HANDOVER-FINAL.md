# HANDOVER-FINAL.md — Life OS v1

**Owner:** [you] · **Version:** v4 — 2026-08-01 · **Model:** one refined source of truth

---

**FOR THE IMPLEMENTER (spec-kit):** This is the authoritative, self-contained spec — hand it to a fresh agent verbatim. The **philosophy (§0) is non-negotiable**; it is the product, not commentary. Shoot ONLY the v1 scope (§12 deliverables). Explicitly do **NOT** build: cron/daemon, Telegram/Discord bot, calendar-write automation, dream/Goals Epics, "why" doc, animated dashboard. Use spec-kit minimally: treat this doc + §0 as your constitution, run `specify → plan → tasks → implement`, skip `clarify`/`analyze` as ceremony, and iterate with the user on feedback rather than chasing completeness. Where this doc diverges from the three sibling handovers, **this file wins**; siblings are raw reference only (§14). Confirm the pending items (§13) with the user before/during build.

---

## 0. The philosophy (read first — this IS the system)

1. **Fear is your best driver.** Your mind races to de-risk and finds shortcuts. So the system **injects fear deliberately**, *before* execution, via consequence-bearing reminders — not after, as a report of failure.
2. **Anti-invisibility.** Internal commitments (your own diet, health, goals) hide in whatsapp/notes/story-jargon and die. Every commitment becomes a **real Jira issue** and shows up on a dashboard. Making your own stakes *visible* is the core fix. External stakes already stay visible — you don't need help there.
3. **The agent judges, you don't.** You delegate: "assess this." The agent grills and rates every task by **urgency / cost-benefit / how it elevates or adds value to your situation**, and sorts routine vs one-time. Your internal tasks get surfaced, not buried.
4. **Point the direction first.** Stubborn non-negotiables; let the small stuff fall so the big win lands.
5. **Streaks + perfect planning/delivery.** A 50-day "without fail" streak is a proven higher-level commitment. You track **planning-perfection** and **delivery-perfection**. Start light, ramp.

---

## 1. Corrected mental model

- **Jira = the work queue** (and the anti-invisibility record — every commitment is an issue).
- **The agent = always-on sidekick.** Core move: **"what next?"** → it assesses and suggests. Agent is the interface; Jira is the record.
- **Calendar = meetings (FOMO) + the three fear-trigger prep events.** NOT a task-slot planner.
- **Motivation = fear-injection triggers + streaks + plan/deliver scores.**

**Success** = fear-triggers fire before it matters; you ask "what next?"; agent suggests one thing; you do it; streaks grow; plan-vs-deliver ticks green.

---

## 2. Architecture

```
            ┌─────────────────────────────────────────────┐
  CAPTURE   │  "add to backlog: X" / voice → agent files  │
 (anytime)  │  a Jira issue (anti-invisibility). Agent    │
            │  assesses: priority, routine/one-off, stat. │
            └─────────────────────────────────────────────┘
                               │ source of truth
                               ▼
            ┌─────────────────────────────────────────────┐
  JIRA SSOT │  the visible record of ALL commitments +    │
            │  pipeline + long-stuck + streaks dashboard  │
            └─────────────────────────────────────────────┘
                               │ read/write
                               ▼
            ┌─────────────────────────────────────────────┐
  AGENT     │  THE interface. "what next" (assess+grill), │
  (local)   │  prioritize, breakdown, research, streak +  │
            │  plan/deliver tracking. No cron/daemon.     │
            └─────────────────────────────────────────────┘
                               │ read + reminders
                               ▼
            ┌─────────────────────────────────────────────┐
  CALENDAR  │  Meetings + 3 FEAR-TRIGGER events (event    │
            │  reminders inject the consequence).         │
            └─────────────────────────────────────────────┘
```

Telegram deferred to the end. Steering = OpenCode chat. **No cron, no daemon — calendar reminders + you act.**

**Persona:** the agent holds one fixed personality — *your difficult coach* — blunt, anti-drift, moves from *problem → solution → move on*, never softens a hard truth. This keeps every surface (today / what next / stats / grooms) in the same voice. The persona is config; reshape it in feedback if it grates.

---

## 3. The three fear-trigger events (recurring calendar entries)

Recurring events whose **reminder text injects the consequence** (the fear) so you de-risk early.

| Event | Recur | Reminder text (fear-injected) |
|-------|-------|-------------------------------|
| **Night-before mental prep** | daily eve (e.g. 9pm) | "Tomorrow: X, Y. If you don't de-risk now (pack, message, phone call), you'll be scrambling — and it breaks delivery. 10 min." |
| **Morning task-pick** | daily (e.g. 8am) | "Pick today's 1–3 from the week. Drift = carry-over + a broken delivery streak. Choose on purpose." |
| **Fear of the light / unplanned week** | weekly (e.g. Sun) | "The week is empty and unplanned — that's the dangerous state. Groom now or you'll improvise reactively all week. Run weekly." |

These are the **triggers**. Fear is injected *before*, to drive the de-risk + shortcut behavior you want.

**Setup note:** create these as **static recurring events once** during setup (reminder text fixed). No daily calendar automation — the agent does NOT write/rotate calendar events. Ragebait rotation + personalization happens in the agent's chat surfaces (§3A), not in calendar reminders.

---

## 3A. Rage-fuel register (daily one-liners)

Your aversions are the system's fuel. A pinned set of **ragebait one-liners** — the agent rotates **one** into your daily reminder ("what next" or the morning pick) so the charge stays personal. Add more anytime during feedback; prune the ones that stop landing.

```
Drift = living in someone else's frame. Point the direction first.
Falling behind started with one slipped task. It's the streak.
An unclear path is ambiguity you let in. De-risk it now.
Unlogged bets don't pay. Count the bets, know the ROI.
Time you can't account for is time someone else spent.
No template = improvisation when it matters. Template it now.
You can't fix their organization — only yours.
Problem → solution → move on. A story with no next action is noise.
"It's not a big deal" — your cue to get loud, then make it a plan.
A task you can't name a value for is a task you shouldn't be carrying.
If it won't be true in 30 days, it's waste — kill it or schedule it.
Deferring it is a decision, too. Make the decision, don't ghost it.
You don't have a focus problem; you have a *decide now* problem.
The bet you're quietly avoiding is exactly the one to log first.
"Busy" is the most expensive way to describe doing nothing that matters.
Stop polishing the thing nobody asked for. Ship the thing that counts.
A meeting with no next action is a chat you paid for with your day.
The plan you can't explain in two sentences is a plan you don't own.
Fear is a fire; let it burn the excuses before it burns the week.
You didn't oversleep — you out-prepared a clear path. That's it.
Every unclear step is a vote for drift. Make it concrete or drop it.
The ROI question isn't "is it worth it" — it's "which bet loses least if wrong."
Vague feedback from others = you now own the ambiguity. Close it.
You'll never catch up by reacting. You catch up by pointing first.
```

These encode the anti-invisibility + point-direction-first + no-drift rules as daily psychological reminders.

**Where it surfaces:** the rotating line lives in the **agent's chat surfaces** (`today`, `what next`, `stats`) — the calendar reminder text is static (set once), so it can't rotate. The agent picks one line per day, context-aware: `[gym]` when a gym task is up, `[diet]` when diet, else general. Tag any line to target it.

**Context-tagged (gym/diet — your priorities):**
```
[gym]  No external stake for the gym — that's exactly why it's a streak, not a favor.
[gym]  The physique you want lives on the far side of the sessions you keep skipping.
[gym]  You didn't lose body fat to a plan — you lost it to no plan. Point first.
[diet]  You'll prep the maid's recipe but not your own plate. Direction first.
[diet]  One 'cheat' isn't a meal — it's a plan you never set. Set it.
[diet]  The body you want won't be negotiated by a snack. Decide, then eat to the plan.
```

---

## 4. Motivation surface — streaks + plan/deliver (v1 core)

**Two perfection scores, tracking how true you are to your own commitments (anti-invisibility, quantified):**

- **Plan-perfection** — of the tasks you plan for a period, how fully you actually line them up / prep. Weekly %.
- **Delivery-perfection** — of what you planned, how much you delivered. Weekly % (your classic plan-vs-deliver gap).

**Streaks (the 50-day mechanism):**
- **Delivery streak** — consecutive days you completed your picked task(s) without fail. The *fear of breaking it* is what makes you do the task on low-motivation days.
- **Practice streak** — one specific daily practice you commit to (e.g. = a habit): day counter, aim 50. This is your practice-loop unit.
- **Clean-week streak** — consecutive weeks your delivery-perfection held (e.g. ≥80%).

**Ramp rule:** start with 1 practice streak + tracking plan/deliver at a **light workload**; add practice streaks and workload only as delivery-perfection stays green. Don't over-commit to fail.

**Targets (set each week — Sunday):** you pick next week's targets in the groom reply, e.g. *"deliver ≥85%, gym 5×, clear 1 long-stuck."* Agent logs them and scores against them next Sunday.

**Status tiers (win/lose signal):** a rank based on peak weekly delivery-perfection (and target hits). Reaching/keeping a tier is the streak-fear at system level — the fear of *dropping* a tier drives consistency:

```
hopeless < average < good < elite < god-mode
```

- Hitting a target = a **🏆 micro-trophy** that week.
- Tier is derived from your best sustained delivery over recent weeks (e.g. ≥90% elite, ≥75% good, ≥50% average, else hopeless; god-mode = ≥95% + all targets).
- You start at **average**; celebrate the upward moves, let the fear of down-shift keep you disciplined.

*(The earlier 6 life-domain red→green bars are dropped as core in v1 — fear+streak is the driver. Can return as a secondary "where" view in v2.)*

---

## 5. Terminology

- **Backlog / Ready / Todo-Week / In Progress / Waiting / Follow-up / Done** — pipeline.
- **Fear-trigger** — calendar event injecting a consequence before execution (§3).
- **Antivisible commitment** — an internal stake you've made into a real Jira issue (the fix for your hiding-self-goals problem).
- **Assess / grill** — agent judges a task: urgency, cost-benefit, elevation, routine-vs-once (§7).
- **Long-stuck** — issue untouched for weeks/months across multiple statuses; needs surfacing.
- **Plan-perfection / Delivery-perfection / streaks** — the motivation metrics (§4).
- **Routine** vs **one-off** — the agent-classified task type.

---

## 6. Jira backbone + dashboard

**Projects (9):** Career, Family, House, Finance, Network, Health/Diet, LifeOS, Docs, Ideas.

**Workflow:** `Backlog → Ready → Todo-Week → In Progress → Waiting → Follow-up → Done`

**Labels:** constraints `loc/time/person` · `week:YYYY-Www` · `needs-research`/`research-done` · `routine:*` · `internal` (antivisible self-commitment) · `long-stuck` (auto-flagged)

**Low-effort dashboard (v1) — Filter Results gadgets, 15-min refresh:**
1. **Pipeline** — all open (primary)
2. **Long-stuck** — `status in (Ready, "Todo-Week", Waiting) AND updated <= -28d` — the months-forgotten list you keep losing track of
3. **Todo-Week** — this week's picks
4. **Streak / plan-deliver slip** — a small text/stat gadget (agent updates weekly) with your two percentages + current streaks

Save filters: Pipeline · Backlog · Todo-Week · **Long-stuck** · Done-this-week.

---

## 7. Weekly ceremony — GROOM + review (~25 min, you choose when / the Sun fear-trigger)

**You ask:** `run weekly` (or the Sun event reminds you)
**Agent does:**
1. **Anti-visibility sweep** — pull internal commitments from whatsapp/notes/links you've shared and file them as real issues (this is the core discipline). Flag anything long-stuck.
2. **Groom Backlog → Ready** — assess each: urgency, cost-benefit, elevation, **routine vs one-off**; add description, constraints, size.
3. Propose ≤7 picks → `Todo-Week` + `week:` label; surface your 1–2 **convictions**.
4. **Post the scoreboard:** plan-perfection, delivery-perfection, current streaks, long-stuck list, **status tier**, and whether this week's **targets** were hit (🏆 for each hit).

**You:** approve / swap / drop, and reply with **next week's targets**. Agent applies and logs them.

**Weekly scoreboard — the win/lose signal:**
```
Week 31 — scoreboard
Plan-perfection       90%
Delivery-perfection   75%
Delivery streak        4 days (lost Wed)
Practice streak   gym  6/7
Long-stuck        3 resolved · 2 left
Max delivery 82% → status: GOOD
🏆 Health target 3/3 hit
```

---

## 8. Daily experience

*(Morning task-pick calendar event = the nagging reminder when you're not looking; `what next`/`today` in chat = the actual interaction when you act. They're the same pick moment — calendar nags, agent decides with you.)*

- **"what next?"** → agent **assesses** (not just lists): reads today's meetings + Todo-Week, then grills/rates and suggests *one* thing, plus today's fear-trigger already fired. Surfaces internal antivisible tasks so they don't hide. Leads with **one daily rage-fuel one-liner** (§3A).
- **Do it** → **"done KEY-42"** → agent marks Done, ticks delivery.
- **Log practice** → **"practice <X> done"** → agent increments the streak.
- **Friction** → *"can't do X because Y"* → agent re-slots / moves to Waiting / keeps it visible (never re-hides it), suggests next.
- **Capture** → **"add to backlog: X"** / voice → agent files + assesses (priority, routine/once, internal?) — **making your own stakes as visible as external ones.**

---

## 9. Command reference (entire v1 surface)

```
today / brief            → THE day-dashboard: one rage-fuel line + streak/status header + today's tasks (from Todo-Week) + today's meetings + lowest/weak stat callout. The whole picture in one answer.
what next                → agent assesses + suggests ONE thing now (meetings → stakes/fear → weak stat → priority)
add to backlog: X        → capture + assess (voice OK)
run weekly               → groom + anti-visibility sweep + scoreboard
done KEY-42              → Done + tick delivery
practice <X>             → log the daily practice / bump streak
rage <one-liner>         → add a new rage-fuel line to the register (tag it [gym]/[diet] to target context)
stuck                    → show long-stuck list (months-old)
assess KEY-42            → agent grills/rates a task (urgency / value / routine-or-once)
set targets <...>        → record next week's targets + tiers
stats                    → plan-perfection, delivery-perfection, streaks, status tier
can't do KEY-42 because Y  → friction; agent reacts, keeps it visible
research KEY-42            → agent researches + writes findings back
recap                      → where the week stands
```

---

## 10. Build order

1. Jira backbone — 9 projects, workflow, labels (constraints · week · internal · routine).
2. Dashboard + filters (esp. **Long-stuck**) + streak slip (§6).
3. **Calendar fear-trigger events** (§3) — nightly mental prep, morning pick, weekly.
4. Core skills — capture / weekly-groom / research + a `daily` skill (next · done · practice · assess).
5. Start **light**: 1 practice streak + plan/deliver tracking; run one real week manually.
6. *(Deferred)* Telegram, fancier dashboard/v2, dreams/"why", cron, more streaks as delivery stays green.

---

## 11. Explicitly NOT in v1 (by design)

Telegram bot · cron/daemon · calendar as task-slot planner / calendar-write automation · 6-domain-bar system (v2 secondary) · Dream/Goals Epics · "why" doc · animated dashboard. **The v1 engine = fear-triggers + streaks + plan/deliver + anti-invisibility.**

---

## 12. Deliverables — what v1 actually builds

1. **Jira config** — 9 projects, the workflow (§6), all labels, the 5 saved filters, and the low-effort dashboard (Pipeline · Long-stuck · Todo-Week · streak/plan-deliver slip).
2. **Calendar setup** — the 3 static recurring **fear-trigger** events with the §3 reminder text (created once, not automated).
3. **Four skills** (`.opencode/skill/`):
   - `capture` — parse voice/text → Jira issue, project, labels (constraint · week · internal · routine), then **assess** (priority / routine-or-once).
   - `weekly-groom` — §7 ceremony: anti-visibility sweep, groom, ≤7 picks, convictions, scoreboard + status tier + target scoring.
   - `daily` — the glue: `today/brief`, `what next` (assess+grill), `done`, `practice`, `can't do because` (friction), `rage`, `stuck`, `assess`, `set targets`, `stats`, `recap`.
   - `research` — background-agent research → cited findings written back into the Jira issue.
4. **Streak + plan/deliver + tier tracker** — computes delivery/plan-perfection, delivery/practice/clean-week streaks, status tier, target hits (data source = Todo-Week vs Done-this-week filters; storage = pending, §13).
5. **Persona prompt** — *your difficult coach* (blunt, anti-drift, problem→solution→move-on) applied consistently across all skills and surfaces.

## 13. Pending — confirm with the user during build

- [ ] Jira site URL + actual project keys (examples differ from real).
- [ ] Agent→Jira transport: REST API (token in macOS Keychain, never repo) vs Jira MCP server.
- [ ] Calendar provider confirmed: **Google** (assumed) vs Apple.
- [ ] Timezone + exact trigger times (draft: night 9pm, morning 8am, Sunday; user may change).
- [ ] Status-tier thresholds (draft: god-mode ≥95%+all targets, elite ≥90%, good ≥75%, average ≥50%, else hopeless).
- [ ] Where streak/plan-deliver data lives: Jira custom field/labels vs a local file the agent maintains.
- [ ] Ragebait tone calibration — confirm the harshness is right (default: hard).
- [ ] Weekly pick cap (default ≤7) and the 1–2 default practice streaks to start.
- [ ] Which routines/habits become recurring calendar events for v1.

## 14. Sibling references (raw detail only — NOT authoritative)

- **HANDOVER-cursor.md** — richest technical reference: exact JQL for every filter, full label set, dashboards, workflow config, ceremony checklists. Mine it for concrete Jira mechanics.
- **HANDOVER-claude-sonet.md** — earlier framing; historical context only.

Use siblings for Jira specifics. **HANDOVER-FINAL.md wins on every decision and on scope.**

---

*Stop — fear fires before it matters, your own goals stay visible, streaks keep delivery honest, and the agent does the judging so you just execute.*
