> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Tasks: AWS App Runner Deployment (Text-First)

**Input**: Design documents from `/specs/007-aws-apprunner-deploy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Manual acceptance per the constitution (prototype pragmatism); no automated test suite requested.

**Organization**: Tasks grouped by user story. Several runtime pieces already exist from
earlier work — the `DISABLE_VOICE` toggle (`src/config.js`, `src/bridge/client.js`,
`.env.example`) and a `deploy-aws.yml` scaffold. The scaffold currently targets App
Runner CLI and **must be reworked** for the chosen host (ECS Express Mode primary, or
EC2 free tier fallback).

## Format: `[ID] [P?] [Story] Description` — `[P]` parallel, `[Story]` = US1/US2/US3, exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm project readiness and resolve the deferred decisions that block AWS provisioning.

- [X] T001 Confirm the AWS account is fully activated (free-plan limitations cleared, billing verified; may take up to 24h) before any provisioning — see `research.md`
- [X] T002 Confirm final host choice (ECS Express Mode primary vs EC2 t2.micro free tier fallback) — see `research.md` Decision: Host
- [X] T003 [P] Install + authorize AWS CLI locally for the one-time infra setup
- [X] T004 [P] Confirm the `deploy/discord-agent` image still builds clean for `linux/amd64` (`docker build --platform linux/amd64 deploy/discord-agent`)

**Checkpoint**: Host chosen and account ready; local tooling works.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the AWS-side plumbing every user story depends on. MUST complete before any story.

⚠️ **CRITICAL**: No user story can be tested live until infrastructure exists.

- [X] T005 Create the private ECR repository `discord-agent` in the chosen region (`aws ecr create-repository`)
- [X] T006 Create the IAM **OIDC CI role** (trust: GitHub Actions `token.actions.githubusercontent.com`, `aud=sts.amazonaws.com`, `sub` scoped to `repo:mayuroks/brick-life-os:ref:refs/heads/main`) with minimal ECR push + host-deploy permissions — see `contracts/deploy-contract.md`
- [X] T007 Create the **host image-pull access role** (separate from CI role; permits the host to pull the image from ECR) — see `contracts/deploy-contract.md`
- [ ] T008 Register CI role ARN as GitHub Actions repo secret `AWS_ROLE_ARN`
- [X] T009 Provision the host service (ECS Express Mode service, or EC2 instance + security group + reverse proxy if using the free-tier fallback), min-instance=1, health path `/health`, port mapped to the service's public port
- [X] T010 Load secrets onto the host (Discord bot token, Jira URL/user/token, OpenRouter key) from the host secret store; set `DISABLE_VOICE=1` and `PORT` — see `data-model.md` Runtime configuration
- [ ] T011 Set up the keep-alive/liveness probe on `/health` (platform health check and/or external uptime pinger) — FR-009

**Checkpoint**: Infrastructure ready — user stories can be implemented/tested in parallel.

## Phase 3: User Story 1 - Get Text Replies Working on AWS (Priority: P1) 🎯 MVP

**Goal**: Plain text messages get a substantive agent reply from the live AWS host, reliably, with no voice overhead.

**Independent Test**: Deploy to AWS; send text messages from Discord and confirm every message draws a useful reply; restart/redeploy and confirm text still works.

### Implementation for User Story 1

- [X] T012 [P] [US1] Confirm `DISABLE_VOICE` flag is honored in `deploy/discord-agent/src/config.js` (field present, parsed from env)
- [X] T013 [P] [US1] Confirm `deploy/discord-agent/src/bridge/client.js` routes voice notes to the friendly notice when `disableVoice` and leaves text path untouched
- [X] T014 [US1] Rework `.github/workflows/deploy-aws.yml` to build `deploy/discord-agent/Dockerfile` for `linux/amd64`, push to the ECR repo, and deploy to the chosen host (replace the App Runner CLI calls with the ECS Express or EC2 deploy steps) — see `contracts/deploy-contract.md`
- [X] T015 [US1] Wire deployed host runtime env: `DISABLE_VOICE=1`, `PORT`, `OPENCODE_SERVE_URL` default, plus required secrets — see `data-model.md`
- [ ] T016 [US1] Trigger the workflow (push to `main` touching `deploy/discord-agent/**`, or `workflow_dispatch`) and verify text reply end-to-end on the live host
- [ ] T017 [US1] Confirm restart/redeploy does not break text messaging (no manual intervention) — FR-001 acceptance scenarios 1–2
- [ ] T018 [US1] Confirm text reply latency is acceptable (a few seconds under normal load) — SC-002; confirm 100% of plain text messages answered — SC-001

**Checkpoint**: User Story 1 fully functional and testable independently.

## Phase 4: User Story 2 - Deploy Automatically from the Code Repository (Priority: P2)

**Goal**: Merged changes deploy automatically; failures are surfaced and never take down the running version.

**Independent Test**: Merge a trivial change to `deploy/discord-agent/`; confirm the host auto-runs the new build without manual action.

### Implementation for User Story 2

- [ ] T019 [US2] Ensure workflow triggers on push to `main` for `deploy/discord-agent/**` and the workflow file — see `contracts/deploy-contract.md` trigger contract
- [ ] T020 [US2] Add workflow failure surfacing: fail the Actions run on any step error (build/push/deploy) — FR-007
- [ ] T021 [US2] Confirm failed deploy keeps the previous healthy version serving (host revision retention) — FR-007
- [ ] T022 [US2] Verify the deploy step 404/401-free by asserting ECR tag = commit SHA (`${{ github.sha }}`) — see `data-model.md` Deployment input
- [ ] T023 [US2] Merge a trivial change and confirm auto-rollout succeeds — FR-002 / SC-003

**Checkpoint**: User Stories 1 AND 2 both work independently.

## Phase 5: User Story 3 - Voice Notes Handled Gracefully (Priority: P2)

**Goal**: In text-only mode, voice notes get a clear notice; further text works.

**Independent Test**: Send a voice note → clear "transcription off" notice; then a text message → normal reply.

### Implementation for User Story 3

- [X] T024 [US3] Confirm the voice-notice reply text exists in `deploy/discord-agent/src/bridge/client.js` (currently "Voice transcription is off…") and fires when `cfg.disableVoice` is true — FR-004
- [X] T025 [US3] Confirm the whisper path is never invoked in text-only mode (no `transcribeVoiceMessage` call when `disableVoice`) — FR-004 / SC-004
- [ ] T026 [US3] On the live host, send a voice note then immediately a text message; confirm text still replies (0 voice-related outages) — SC-004

**Checkpoint**: All user stories independently functional.

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and hygiene across the deployment.

- [X] T027 [P] Update `deploy/discord-agent/README.md` to reflect the AWS host + text-first flow (retire Render instructions or mark them historical)
- [X] T028 [P] Retire/mark `deploy/discord-agent/render.yaml` as legacy (reference only) so it is not mistaken for the active config
^- [X] T029 [P] Remove or rotate the committed Jira API token found in `deploy/discord-agent/agent/opencode.json` (a live secret was detected there; `bootstrap.js` regenerates this file from env at boot, so the file should not be committed)
^- [X] T030 Add `.github/workflows/deploy-aws.yml` + `agent/opencode.json` to the ignore/gitignore rules to prevent secret leakage
- [ ] T031 Run `quickstart.md` end-to-end and confirm all sections pass
- [X] T032 [P] Update `specs/007-aws-apprunner-deploy/` handover notes with final host + account status

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (infra must exist to test live)
- **User Stories (Phase 3+)**: Depend on Foundational; USC1 blocks inline but US2/US3 are largely independent once infra exists
- **Polish (Final Phase)**: Depends on desired stories complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3 — the MVP slice
- **User Story 2 (P2)**: Depends on US1's deploy step (T014) being in place for auto-deploy; otherwise independent
- **User Story 3 (P2)**: Depends only on the `DISABLE_VOICE` flag (already present); independent of US2

### Within Each User Story

- Config/flag confirmation before host wiring; verify fail-fast at boot (FR-006) per `data-model.md` validation rules

### Parallel Opportunities

- Phase 1 tasks marked [P] can run in parallel
- Phase 2 infra tasks (ECR, roles, secrets) are largely independent and can run in parallel
- T012/T013 (code confirmations) parallel; T026 only after live host exists
- Polish tasks all parallel

## Parallel Example: User Story 1

```bash
# Launch code-confirmation tasks together:
Task: "Confirm DISABLE_VOICE parsed in deploy/discord-agent/src/config.js"
Task: "Confirm voice-notice routing in deploy/discord-agent/src/bridge/client.js"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (account + host decision)
2. Complete Phase 2: Foundational (ECR, roles, host service, secrets, health probe)
3. Complete Phase 3: User Story 1 (rework workflow → live text reply)
4. **STOP and VALIDATE**: Confirm text replies on the live host
5. Ship the text MVP; voice deferred (FR-008)

### Incremental Delivery

1. Setup + Foundational → infra ready
2. US1 → live text (MVP!)
3. US2 → auto-deploy reliability
4. US3 → graceful voice handling
5. Each adds value without breaking prior stories

### Notes

- [P] tasks = different files, no dependencies
- Tests are manual per the constitution (prototype pragmatism), not automated
- Commit after each logical group
- Security: T029 (secret rotation) is important before broader sharing of the repo

## Phase 6: Convergence

**Purpose**: Close the gap between the running ECS Fargate infra and the CI/CD intent.

- [X] T033 Confirm GitHub repo secret `AWS_ROLE_ARN` is set to `arn:aws:iam::243746944554:role/github-actions-ci` (via `gh secret set AWS_ROLE_ARN`) per FR-002/US2 trigger contract (partial)
- [X] T034 Define `VPC_SUBNETS` and `VPC_SG` (repo secrets or env) and fix `deploy/discord-agent/.github/workflows/deploy-aws.yml` so the create-service branch resolves them: use the two provisioned public subnets (`subnet-0291d89a38f3bb502`, `subnet-073ab0dcc4d7073c3`) and SG `sg-04910b2389f70681a` per plan: ECS Fargate (partial)
- [X] T035 Reconcile image tag: have `.github/workflows/deploy-aws.yml` push/tag `:latest` (matching taskdef `discord-agent:2`) in addition to the SHA tag, or register a new taskdef revision with the pushed SHA image, so `update-service` rolls out the newly built image per FR-002/FR-007 (partial)
- [X] T036 Point the deploy step's `update-service --task-definition` at the actual live revision (register+use `discord-agent:N`) instead of the bare service name to avoid 404/stale rollout per FR-007 (partial)
- [ ] T037 Add an ECS service health check (or external uptime pinger on `/health`) so the always-on service is monitored and surfaced per FR-009/SC-005 (missing)
- [ ] T038 Trigger a real auto-deploy (push to `main` touching `deploy/discord-agent/**`) and confirm the bot still answers a text message after rollout per US2/AC1-AC3, SC-003 (partial)
- [X] T039 Add a traceability note/README section documenting that AWS infra (ECR, ECS, SSM, taskdef) is provisioned imperatively and the static CLI key is retained while iterating per FR-005 (unrequested)
