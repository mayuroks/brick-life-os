---

description: "Task list for node:24-slim CI speed-up"
---

# Tasks: Speed Up CI Build & Plan

**Input**: Design documents from `/specs/009-speed-up-ci-build/`

**Prerequisites**: plan.md (required), spec.md, research.md, quickstart.md

**Tests**: Not requested in the spec — build-time validation via quickstart.md only.

**Organization**: Two user stories (US1 fast build, US2 fast end-to-end plan). Scope is one Dockerfile swap, so US1 and US2 are largely the same slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (US1, US2)
- Include exact file paths

## Path Conventions

- Infra/config lives at `deploy/discord-agent/Dockerfile` and `.github/workflows/deploy-aws.yml`

---

## Phase 1: Setup

**Purpose**: Pin the base image digest so the cache key is stable (avoids surprise rebuilds when `node:24-slim` tag drifts).

- [ ] T001 Pin `node:24-slim` to a digest: `docker pull node:24-slim` then resolve `@sha256:` and update `FROM --platform=linux/amd64 node:24-slim@sha256:<digest>` in `deploy/discord-agent/Dockerfile`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Apply the core base-image swap (already drafted in plan.md research) so the build drops the two legacy apt-get/NodeSource steps.

**⚠️ CRITICAL**: No story completion without this phase.

- [x] T002 Swap base image in `deploy/discord-agent/Dockerfile` from `ubuntu:26.04` to `node:24-slim` and replace the `apt-get install` line with `git python3` only
- [x] T003 [P] Remove the NodeSource Node 24 install block (`curl .../setup_24.x | bash` + `apt-get install nodejs`) from `deploy/discord-agent/Dockerfile`

**Checkpoint**: `deploy/discord-agent/Dockerfile` now: `node:24-slim` → `apt-get git python3` → uv copy → opencode install → npm ci → copy source. Build steps that consumed ~14.5 min are gone.

---

## Phase 3: User Story 1 - Fast CI build (Priority: P1) 🎯 MVP

**Goal**: Developer triggers the build job and it completes in ≤ 1 min (cold) by reusing the slim base instead of installing OS tooling + Node from scratch.

**Independent Test**: Run the cold `docker buildx build` in quickstart.md §1 and confirm build success, `node`/`uv`/`opencode` present, and total time ≤ 1 min (SC-001/SC-003).

### Implementation for User Story 1

- [x] T004 [US1] Verify `package.json`/`package-lock.json` and `.dockerignore` in `deploy/discord-agent/` correctly exclude `node_modules` and build junk so context stays small
- [ ] T005 [US1] Validate the slim base still runs uv + opencode: run `docker build --progress=plain --file deploy/discord-agent/Dockerfile deploy/discord-agent` and confirm `uv --version`, `opencode --version`, `node --version` succeed (quickstart.md §1)

**Checkpoint**: Cold build ≤ 1 min; image functionally intact.

---

## Phase 4: User Story 2 - Fast end-to-end build + plan (Priority: P2)

**Goal**: Full build + plan (deploy) pipeline completes in ≤ 1 min warm by reusing GHA Docker layer cache.

**Independent Test**: Push a no-op change to `main` and confirm the `deploy-aws.yml` build step reuses cache and the job finishes in ≤ 1 min (SC-001/SC-002/SC-004).

### Implementation for User Story 2

- [x] T006 [US2] Confirm `cache-from: type=gha` / `cache-to: type=gha,mode=max` are present in `.github/workflows/deploy-aws.yml` (keep — do not edit the workflow file; editing it invalidates the cache)
- [ ] T007 [US2] Trigger `deploy-aws.yml` run and verify the ECS Fargate task comes up Healthy with the new image (end-to-end validation, quickstart.md §3)

**Checkpoint**: Warm build+plan ≤ 1 min; deployed task Healthy.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Lock in the win and document the constraint that keeps it.

- [x] T008 [P] Update `specs/009-speed-up-ci-build/quickstart.md` (if needed) with the final pinned digest from T001 so future cold builds reproduce
- [x] T009 Update this feature's `plan.md`/`research.md` to note the GHA cache invalidation constraint: do not edit `.github/workflows/deploy-aws.yml` casually
- [ ] T010 Run quickstart.md end-to-end (cold build, warm build, deploy) and record measured durations against SC-001/SC-002/SC-004

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 — resolve digest before proceeding (optional but recommended)
- **Foundational (Phase 2)**: Depends on T001; blocks both user stories
- **US1 (Phase 3)**: Depends on T002/T003
- **US2 (Phase 4)**: Depends on US1 (T005)
- **Polish (Phase 5)**: Depends on US1 + US2

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 — MVP slice.
- **User Story 2 (P2)**: Depends on US1's working build; independently testable as an end-to-end deploy.

### Parallel Opportunities

- T001 (setup) and T002/T003 (foundational) touch the same `Dockerfile` — do NOT run in parallel (avoid edit conflicts).
- After T004, T005 (US1 build validation) and T006 (workflow cache check) can run in parallel.
- All post-build validations (T007, T010) can run in parallel once the image builds.

---

## Parallel Example: Foundational Phase

```bash
# Do NOT run these in parallel (same file). Sequence:
Task: "T002 base image swap in deploy/discord-agent/Dockerfile"
Task: "T003 remove NodeSource block in deploy/discord-agent/Dockerfile"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (pin digest)
2. Complete Phase 2: T002, T003 (base swap + remove NodeSource)
3. Complete Phase 3: T004, T005 (context check + cold build validation)
4. **STOP and VALIDATE**: cold build ≤ 1 min with uv/opencode/node working
5. Deploy if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → cold build validated → this is the MVP (build time dropped from ~15 min to ~1 min)
3. Add US2 → trigger deploy → confirm Healthy → end-to-end win
4. Polish (T008–T010) pins the digest, documents the cache constraint, records timings

### Parallel Team Strategy

- Single-owner change: one person does T001–T003 sequentially (same file).
- After the build validates (US1), a second person can parallel-check the workflow cache (T006) and run the deploy validation (T007).

---

## Notes

- [P] tasks = different files, no dependencies. T002/T003 conflict on `Dockerfile` — sequential only.
- [Story] label maps to spec user stories US1/US2 for traceability.
- No test tasks generated — no tests were requested; validation is quickstart.md build runs.
- Commit after each logical group (Dockerfile change, then validation).
- Avoid: editing `.github/workflows/deploy-aws.yml` (invalidates GHA Docker cache → re-heats build).
