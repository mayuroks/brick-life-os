---

description: "Task list for the Life OS Agent on Discord feature (Render deploy)"
---

# Tasks: Life OS Agent on Discord (Render Deploy)

**Input**: Design documents from `/specs/002-discord-bot-deploy/`

**Prerequisites**: plan.md (required), spec.md (user stories), research.md, data-model.md, contracts/discord-surface.md, quickstart.md

**Tests**: Manual acceptance checks only — per the prototype constitution (IV), no automated suite is generated unless requested.

**Organization**: Tasks are grouped by user story so each story is independently testable. Source lives in a NEW deployable `deploy/discord-agent/` that bundles the `001` agent (opencode + skills + Jira MCP) headless, plus a thin Discord bridge. The old `brick/` OpenRouter experiment is out of scope.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US1–US2)
- Include exact file paths in descriptions.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the deployable package.

- [x] T001 [P] Create `deploy/discord-agent/` with `package.json` (`type: module`, `start: node src/index.js`) and `.env.example`
- [x] T002 Add `discord.js`, `express`, `dotenv` to `deploy/discord-agent/package.json` and run `npm install`
- [x] T003 [P] Create `deploy/discord-agent/.env.example` documenting `DISCORD_BOT_TOKEN`, `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, LLM provider key (e.g., `ANTHROPIC_API_KEY`), and `PORT` (no values)
- [x] T004 [P] Create `deploy/discord-agent/.dockerignore` excluding `node_modules`, `.env`, `*.pem`, `.git`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infra that MUST be complete before any user story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [x] T005 Bundle the `001` agent: copy `.opencode/skill/` (capture, daily, weekly-groom, research) and `opencode.json` into `deploy/discord-agent/agent/` so the headless agent loads the real skills
- [x] T006 Create `deploy/discord-agent/agent/opencode.json` referencing `skill/` paths and the `atlassian` MCP entry (`uvx mcp-atlassian`) with `JIRA_URL`/`JIRA_USERNAME`/`JIRA_API_TOKEN` read from env
- [x] T007 Implement `deploy/discord-agent/src/health.js` — an express `GET /health` returning `{"status":"ok","agent":"up","bridge":"up"}` based on agent/bridge readiness
- [x] T008 Create `deploy/discord-agent/run.sh` — supervisor that starts `opencode serve` (headless agent, warm port) and the Node bridge

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Run the Full Agent From Discord While Away (Priority: P1) 🎯 MVP

**Goal**: A user sends any `001` agent command as a plain Discord message and receives the agent's Jira-backed reply in the same chat.

**Independent Test**: Send "today" (or "add to backlog: X") over Discord → the agent replies in the same channel with a Jira-backed response, matching local behavior.

### Implementation for User Story 1

- [x] T009 [P] [US1] Create `deploy/discord-agent/src/bridge/client.js` — a `discord.js` `Client` with intents `Guilds`, `GuildMessages`, `MessageContent`, logging in with `DISCORD_BOT_TOKEN` (privileged intent)
- [x] T010 [P] [US1] Create `deploy/discord-agent/src/bridge/queue.js` — per-channel FIFO queue that processes one message at a time (serial replies, no interleaving)
- [x] T011 [US1] Implement `deploy/discord-agent/src/agent/client.js` — sends a message to the headless `opencode serve` (via `opencode run --attach <url>`/serve API) and returns the agent's reply
- [x] T012 [US1] Create `deploy/discord-agent/src/index.js` — boot: validate required secrets (fail-fast), start `health.js`, start the bridge, wire `messageCreate`
- [x] T013 [US1] Implement the `messageCreate` handler in `deploy/discord-agent/src/bridge/client.js`: ignore bot's own + other bots, ignore empty content, enqueue → agent → `message.reply` in the same channel (FR-001, FR-005)
- [ ] T014 [US1] Verify locally with `./run.sh` + real secrets: send "today" and "add to backlog: X" over Discord → Jira-backed replies; bot ignores its own messages

**Checkpoint**: US1 fully functional and testable independently (this is the MVP).

---

## Phase 4: User Story 2 - Secure, Reproducible Render Deploy (Priority: P2)

**Goal**: The agent deploys reproducibly from GitHub to Render with secrets only in host env.

**Independent Test**: A fresh checkout builds (Docker) and boots on Render with only env vars set; no secret committed.

### Implementation for User Story 2

- [x] T015 [US2] Create `deploy/discord-agent/Dockerfile` — `node:20-alpine` + install `opencode` and `python3`/`uv` (for `uvx mcp-atlassian`), `npm ci --omit=dev`, copy `src/` + `agent/`, `CMD ./run.sh`
- [x] T016 [US2] Create `deploy/discord-agent/render.yaml` — `type: web`, `runtime: docker`, `plan: free`, `healthCheckPath: /health`, all secrets declared with `sync: false`
- [x] T017 [US2] Ensure all secrets are env-only and boot fails fast with exact next steps in `deploy/discord-agent/src/config.js` (validate `DISCORD_BOT_TOKEN`, `JIRA_*`, LLM key)
- [x] T018 [US2] Materialize the LLM provider auth at boot from env (write `deploy/discord-agent/agent/auth.json` from the provider key secret, never baked into the image) so headless `opencode serve` starts authenticated
- [ ] T019 [US2] Verify a fresh checkout builds (`docker build`) and boots with only env vars set — no manual step omitted (SC-003)

**Checkpoint**: US1 and US2 both independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation.

- [x] T020 [P] Write `deploy/discord-agent/README.md`: Discord portal `MESSAGE_CONTENT` intent + bot setup, Render deploy steps, env secret list, and the deferred-items note (cold-start/keep-alive/observability)
- [ ] T021 Run `specs/002-discord-bot-deploy/quickstart.md` end-to-end and record results (health, "today"/"add to backlog"/"research KEY-42" replies, Jira backup, offline error, missing-secret fail-fast)
- [x] T022 Confirm no `.env` or secret text is trackable via `git status` / `git check-ignore` for `deploy/discord-agent/` deploy files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; **blocks all user stories**.
- **User Stories (Phase 3+)**: Depend on Foundational. US2 can start after US1 (different files: `Dockerfile`/`render.yaml`/`config.js`).
- **Polish (Phase 5)**: Depends on US1 and US2.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P2)**: After Foundational. Independently testable (build + boot).

### Within Each User Story

- US1: bridge client → queue → agent client → index/boot → handler → verification.
- US2: Dockerfile → render.yaml → config fail-fast → auth materialization → build verify.

### Parallel Opportunities

- Phase 1 T001/T003/T004 can run in parallel.
- Phase 2 T005/T006/T007/T008 are independent files — parallelizable.
- Within US1: T009 (client) and T010 (queue) are parallel; T011/T012 depend on them; T013 depends on all; T014 is last.
- US2 T015/T016/T017/T018 are distinct files — largely parallel.

### Parallel Example: User Story 1

```text
# Parallelizable:
- T009 (bridge/client.js)  and  T010 (bridge/queue.js)   -> parallel
- T011 (agent/client.js)   -> after those contracts exist
- T012 (index.js boot)     -> after T011
- T013 (messageCreate)     -> after T012
- T014 (verification)      -> last
```

---

## Implementation Strategy

- **MVP first**: Ship **US1** — a plain Discord message running any `001` agent command through the real headless agent with Jira MCP — the entire point of the feature.
- **Then US2** — Docker + Render so it's actually deployed from GitHub with secrets in host env.
- Do **not** reimplement the agent: it bundles and runs the existing `001` agent (skills + Jira MCP) headless.
- Register/validate secrets and the `MESSAGE_CONTENT` intent in the Discord portal before end-to-end verification.
