# Agent Round-Trip Optimization — Work Unit Plans

**Owner:** any implementing agent (pick one work unit, finish it end-to-end)
**Repo root:** `/Users/macbook/Documents/Prac/life-os-project` (all paths relative to it)
**Deployed code root:** `deploy/discord-agent/`
**Local reference container:** `lifeos-agent` (docker), opencode **v1.18.14**
**Live box:** EC2 `t3.micro` `ap-south-1` (Native, systemd `discord-agent.service`), 1GB RAM + 2GB swap, 8GB disk

---

## The problem (context — read once, then pick a work unit)

Every Discord message currently spawns a **fresh `opencode run` child** that re-does
cold boot (config, skills, Jira MCP `uvx` start) ≈ **4.5–7.4s before the first model
call**, even though a warm `opencode serve :4096` is started at boot and **never
attached to** (`src/agent/client.js:8-10, 80-88`). Long runs are additionally LLM-
bound (~1.4s/model step) and burn seconds on **webfetch waste** (14 `SchemaError`
missing-`url` calls + 32 dangling 404/DNS fetches ≈ 30s of a 107s run).

Each work unit below is **independent**: pick one, follow it start-to-finish, verify
with its commands, and report. Do **not** do cross-unit analysis beyond what the unit
states.

---

## Work units & dependency map

There is exactly **one hard dependency**: WU-01 (attach) must only ship after WU-02
(serve supervisor) so a serve crash cannot take the reply path down. Every other unit
is standalone and may be built in any order / parallel.

```
WU-01 (attach, flag-gated)
  depends-on ──▶ WU-02 (serve supervisor, run.sh respawn)
WU-03 (webfetch guard)        ── parallel, standalone
WU-04 (step/tool budget)      ── parallel, standalone
WU-05 (observability)         ── parallel, standalone
```

| WU# | Title | Change size | Savings | File(s) touched |
|---|---|---|---|---|
| **01** | Warm-serve attach (`AGENT_ATTACH` flag + `--attach`) | medium | ~7s/message (13s→6s) | `deploy/discord-agent/src/agent/client.js` |
| **02** | Serve-crash supervisor (run.sh respawn) | medium | availability (unblocks 01) | `deploy/discord-agent/run.sh` |
| **03** | webfetch schema + URL-validity guard | minor | ~30s / research run | `deploy/discord-agent/agent/AGENTS.md`, `agent/skill/research/SKILL.md` |
| **04** | Step/tool budget for freeform + research + weekly | minor–medium | bounds long runs | `deploy/discord-agent/agent/AGENTS.md`, `agent/skill/*/SKILL.md` |
| **05** | Boot-time + webfetch-fail observability | minor | measurements | `deploy/discord-agent/agent/ops.js`, `src/agent/client.js` |

---

## How to consume a work unit

1. Read only the **one** work-unit doc for the task you own.
2. It contains: scope → exact file paths → exact edit instructions → verify commands → rollback.
3. Do the edits. Run the verify commands. Fix until they pass.
4. Where a unit ships to the live EC2 box, it includes the deploy command.

## Deploy helpers (shared)

- Build/lint Node file: `node --check deploy/discord-agent/src/<file>.js`
- Local docker rebuild: `docker build -t lifeos-agent:latest deploy/discord-agent`
- Restart live unit: `ssh -i deploy/ec2-single-box/lifeos-box.pem ubuntu@15.252.6.196 'sudo systemctl restart discord-agent'`
