---
description: "Task list template for feature implementation"
---

# Tasks: Local Runnable (Brick Bot Dev Mode)

**Input**: Design documents from `/specs/003-local-runnable/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/cli-core.md

**Tests**: Not requested in the spec. Per the prototype constitution (IV), tests are optional/minimal — manual acceptance checks from `quickstart.md` suffice. No test tasks are generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Node package under `brick/` (per plan.md). Source: `brick/src/`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the `brick/` project directory tree (`brick/src/core`, `brick/src/providers`, `brick/src/cli`) and a `brick/.gitignore` that excludes `.env` and `node_modules`
- [X] T002 Initialize `brick/package.json` (name `brick`, `"type": "module"`, Node LTS, `"cli": "node src/cli/cli.js"` script, `dotenv` dependency for env loading)
- [X] T003 [P] Create `brick/.env.example` documenting `OPENROUTER_API_KEY` (required), optional `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`) and `BRICK_MODEL` (no real values)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement `brick/src/config.js` — loads env (dotenv), reads `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `BRICK_MODEL`, fails fast at boot with exact next steps when `OPENROUTER_API_KEY` is missing, applies defaults for url/model (FR-005, FR-007, contract/env). No key/url/model hardcoded in code.
- [X] T005 [P] Implement `brick/src/core/persona.js` — the single fixed Brick system prompt + reply formatting (blunt coach, brick-red theme, emoji-prefixed `🔴 **Brick says:**`) shared by all surfaces
- [X] T006 [P] Implement `brick/src/providers/openrouter.js` — queries the provider using the URL/model/key from `config.js`; on unreachable/offline returns a clear one-line friendly error, never hangs (FR-006)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run the Bot on My Own Machine (Priority: P1) 🎯 MVP

**Goal**: The user boots the bot locally and gets a Brick persona reply to a typed message via the CLI, reusing the same shared core the deployed bot uses.

**Independent Test**: `node brick/src/cli/cli.js "message"` returns a Brick-formatted reply (SC-001, FR-001/FR-001a).

### Implementation for User Story 1

- [X] T007 [US1] Implement `brick/src/core/bot.js` — `handleMessage(text)` applies the persona, calls the provider, and returns the Brick reply or a friendly error (depends on T004, T005, T006)
- [X] T008 [US1] Implement `brick/src/cli/cli.js` — reads a message from argv (or stdin), calls `handleMessage`, prints the reply, exits non-zero on error

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (MVP complete)

---

## Phase 4: User Story 2 - Add Features and Debug Without Breaking Cloud (Priority: P1)

**Goal**: Local iteration reflects changes after restart while the deployed instance is untouched (FR-002, FR-003).

**Independent Test**: Change core logic, restart the CLI, confirm new behavior locally; deployed instance unaffected (SC-002).

### Implementation for User Story 2

- [X] T009 [US2] Keep `brick/src/core/bot.js` side-effect-free and Discord-agnostic so the deployed `002-discord-bot-deploy` surface can import the same module — verify no HTTP/Discord coupling in `src/core/` or `src/providers/`
- [X] T010 [US2] Write `brick/docs/dev-workflow.md` — the add-and-debug loop: edit `src/core`, restart CLI, verify; confirm local reads `.env` only and never touches production state

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Safe Local Setup With No Secret Leaks (Priority: P2)

**Goal**: Reproducible local setup with no secrets committed (FR-004, FR-005).

**Independent Test**: Fresh checkout → follow setup → boots and responds; repo contains no secret (SC-003).

### Implementation for User Story 3

- [X] T011 [US3] Write `brick/README.md` — setup (copy `.env.example` → `.env`, fill key), run CLI, and the offline + missing-secret cases (link `quickstart.md` and `contracts/cli-core.md`)
- [X] T012 [US3] Run a secret-leak check: confirm `.env` is git-ignored and no literal key/token appears anywhere in the repo

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T013 Run `specs/003-local-runnable/quickstart.md` validation end-to-end (setup → run → offline → missing-secret → secret check)
- [X] T014 [P] Final lint/cleanup and `.gitignore` sanity across `brick/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - MVP
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (reuses core)
- **User Story 3 (Phase 5)**: Depends on Foundational (documentation-focused, can start after core exists)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (verifies the shared-core isolation property)
- **User Story 3 (P2)**: Can start after Foundational - independent (docs + secret hygiene)

### Within Each User Story

- Core implementation before CLI
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] (T005, T006) can run in parallel
- Once Foundational phase completes, US1 and US3 can start in parallel (if staffed)

---

## Parallel Example: Foundational Phase

```bash
Task: "T005 Implement persona.js in brick/src/core/persona.js"
Task: "T006 Implement openrouter.js in brick/src/providers/openrouter.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `node brick/src/cli/cli.js "test message"` returns a Brick reply
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP!)
3. Add User Story 2 → Verify isolation property → Demo
4. Add User Story 3 → Docs + secret hygiene → Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- The shared core (`src/core`, `src/providers`) is the anti-drift guarantee — future work on the deployed `002` bot must reuse it, not copy it
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
