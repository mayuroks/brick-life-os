---

description: "Task list for Render Ubuntu cloud deployment"
---

# Tasks: Render Ubuntu Cloud Deployment

**Input**: Design documents from `/specs/005-render-ubuntu-deploy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: None required (manual acceptance per constitution). This feature is deployment *packaging*:
the implementation is a new `Dockerfile` + `render.yaml` + supporting files; validation is a local
Docker build + inspect + boot.

**Organization**: Tasks grouped by user story. Infrastructure file edits are split by file so parallel
sub-agents never collide. Installs/verification (Docker build, boot, inspect, voice check) are delegated
to sub-agents per constitution V.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task).
- **[Story]**: US1/US2/US3 (spec.md user stories).
- Paths are relative to `deploy/discord-agent/`.

---

## Phase 1: Setup (Shared Configuration)

**Purpose**: One-time config touch. Single file, no parallel conflicts.

- [X] T001 Append a deployment-default note for `WHISPER_MODEL` to `deploy/discord-agent/.env.example`: document that on Render it should be `/app/models/ggml-tiny.en.bin` (free tier fits tiny.en) and the local default remains `./models/ggml-base.en.bin`

---

## Phase 2: Foundational (Blocking — the deploy artifacts)

**Purpose**: The deployable packaging. All four tasks touch DIFFERENT files and can run in parallel.

**⚠️ CRITICAL**: No build/verify (US1–US3) can start until `Dockerfile` (T002) exists.

- [X] T002 [P] Rewrite `deploy/discord-agent/Dockerfile` per `contracts/deploy-contract.md` + `research.md`: `FROM --platform=linux/amd64 ubuntu:26.04`; install Node 24 (NodeSource); `apt-get install -y --no-install-recommends whisper.cpp ffmpeg curl ca-certificates git`; install opencode via the official installer into `/usr/local/bin` (`ENV OPENCODE_INSTALL_DIR=/usr/local/bin` + `curl -fsSL https://opencode.ai/install | bash`); copy `package.json`/`package-lock.json`, `npm ci --omit=dev` (scripts ENABLED so `ffmpeg-static` downloads its amd64 binary); copy the app (`run.sh`, `src/`, `scripts/`, `agent/`); download `ggml-tiny.en.bin` to `/app/models/`; `CMD ["./run.sh"]`. NO secrets baked
- [X] T003 [P] Update `deploy/discord-agent/render.yaml` to the Docker blueprint in `contracts/deploy-contract.md`: `runtime: docker`, `plan: free`, `healthCheckPath: /health`, and `envVars` for `DISCORD_BOT_TOKEN`, `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `OPENROUTER_API_KEY` (secrets) plus `WHISPER_MODEL=/app/models/ggml-tiny.en.bin`
- [X] T004 [P] Update `deploy/discord-agent/.dockerignore`: exclude `node_modules/`, `.env*`, `.git`, `agent/opencode.json`, `agent/auth.json`, `models/` (source tree, the model is downloaded inside the build), and personal recording fixtures (e.g. `fixtures/*.voice.opus`, `fixtures/**/*.wav`)
- [X] T005 [P] Update `deploy/discord-agent/README.md` "Deploy to Render (via GitHub)" section to reflect the new Ubuntu 26.04 Docker image + `render.yaml` blueprint + `WHISPER_MODEL` env; keep the existing secret list

**Checkpoint**: dockerfile + render.yaml + dockerignore + docs all present.

---

## Phase 3: User Story 1 - 24/7 Cloud Bot (Priority: P1) 🎯 MVP

**Goal**: The Ubuntu-based image builds cleanly on amd64 with no secrets baked, ready for Render.

**Independent Test**: `docker build --platform=linux/amd64 -t brick-life-os .` succeeds and the image
contains no secret files/values.

### Implementation for User Story 1

- [X] T006 [US1] (sub-agent) Build the image locally and verify: `cd deploy/discord-agent && docker build --platform=linux/amd64 -t brick-life-os .`; then inspect for FR-002/SC-003 — assert no `.env`, no `agent/opencode.json`, no credential text inside the built image (`docker run --rm --entrypoint sh brick-life-os -c "ls -la /app && env"` and grep for token-like values)

**Checkpoint**: US1 done — a clean, secret-free amd64 image builds.

---

## Phase 4: User Story 2 - Secure Reproducible Build (Priority: P1)

**Goal**: The image actually contains the full runtime (node/opencode/whisper/ffmpeg/model) and boots a
working bot, proving reproducibility + readiness beyond just building.

**Independent Test**: Boot the image locally with real secrets from `.env`; `/health` returns 200, the
Discord bridge logs in, and a text message gets an in-channel reply.

### Implementation for User Story 2

- [X] T007 [US2] (sub-agent) Boot the built image locally: `docker run --rm -p 10000:10000 --env-file .env -e WHISPER_MODEL=/app/models/ggml-tiny.en.bin brick-life-os`; confirm `/health` returns 200, the log shows `Bridge logged in`, and a **text** message produces an agent reply; also confirm the image provides `node --version` ≥22, `opencode --version`, and `whisper-cli --help`

**Checkpoint**: US2 done — bootable, connected, text-replying bot from the reproducible image.

---

## Phase 5: User Story 3 - Voice Transcription in Cloud Build (Priority: P2)

**Goal**: The deployed image transcribes voice messages server-side with the tiny model, matching local
behavior.

**Independent Test**: Run the transcription pipeline inside the container (or send a live voice message
to the running container) and confirm Whisper produces a sensible transcript that the agent answers.

### Implementation for User Story 3

- [X] T008 [US3] (sub-agent) Verify voice transcription in the Ubuntu image: run the fixture through the container's own whisper/ffmpeg (`docker run --rm -v $PWD/fixtures:/fixtures --entrypoint sh brick-life-os -c "ffmpeg -y -i /fixtures/test.opus -ar 16000 -ac 1 -c:a pcm_s16le /tmp/a.wav && whisper-cli -m /app/models/ggml-tiny.en.bin -f /tmp/a.wav -otxt -of /tmp/out && cat /tmp/out.txt"`); confirm a transcript is produced; optionally confirm the running bridge replies to a live voice note (or shows `no-speech`/`error` gracefully — SC-006)

**Checkpoint**: US3 done — server-side voice transcription works in the deployed image.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs + end-to-end validation wrap-up.

- [X] T009 [P] Add a "Free-tier keep-alive" note to `deploy/discord-agent/README.md`: external pinger (<15 min) on `/health`, the 15-min sleep behavior, 0.1 CPU transcription latency, and that guaranteed 24/7 + near-realtime voice needs a paid/starter plan
- [X] T010 Run every step of `specs/005-render-ubuntu-deploy/quickstart.md` locally (build → inspect → boot → voice); fix any issue found
- [X] T011 Update `HANDOVER-discord-integration.md` (or a 005 note) documenting the Ubuntu 26.04 Render deployment, the `WHISPER_MODEL=tiny.en` choice, and the free-tier limitations + paid-plan option

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 only — no blockers.
- **Foundational (Phase 2)**: T002–T005 all in parallel (distinct files). T002 (Dockerfile) is the gate for every story.
- **US1 (Phase 3)**: Depends on T002. Builds the image.
- **US2 (Phase 4)**: Depends on T002 (and the built image). Boots + text reply.
- **US3 (Phase 5)**: Depends on T002 (and the built image). Voice transcription in-container (independent of the boot test).
- **Polish (Phase 6)**: Depends on image building; T010 depends on all verify tasks.

### Parallel Opportunities

- Wave 1 (Setup): T001.
- Wave 2 (Foundational): **T002, T003, T004, T005** — 4 parallel sub-agents (distinct files).
- Wave 3 (after T002): T006 builds the image.
- Wave 4: **T007 (boot) and T008 (voice-in-container)** can run in parallel on the built image.
- Wave 5 (Polish): T009 (README) is independent/parallel; T010/T011 after verification.

**Same-file rule**: `README.md` is edited by T005 (foundational) then T009 (polish) — different phases,
so no parallel collision. `.env.example` only by T001.

**Constitution note (V)**: the Docker build (T006), boot/inspect (T007), and voice-in-container (T008)
are install/verify work and MUST be delegated to sub-agents, ≤3 at once.

---

## Parallel Example (max throughput)

```bash
# Wave 2 — Foundational (4 parallel sub-agents):
Task: "T002 rewrite Dockerfile to ubuntu:26.04 amd64"
Task: "T003 update render.yaml to docker blueprint"
Task: "T004 update .dockerignore"
Task: "T005 update README Deploy to Render"

# Wave 3 — build the image:
Task: "T006 docker build --platform=linux/amd64 + secret-free inspect"

# Wave 4 — verify (parallel):
Task: "T007 boot image, /health 200, text reply"
Task: "T008 voice transcription inside container (tiny.en)"

# Wave 5 — polish:
Task: "T009 README keep-alive + limitations"
Task: "T010 run quickstart.md end-to-end"
Task: "T011 update HANDOVER"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup.
2. Phase 2 Foundational (parallel).
3. Phase 3 US1 — image builds clean, no secrets. STOP and validate.

### Incremental Delivery

1. Setup + Foundational → deployables ready.
2. US1 → clean amd64 image (MVP).
3. US2 → boots + text replies.
4. US3 → voice transcription works in the image.
5. Polish.

### Parallel Team Strategy

- Foundational authored across 4 sub-agents (distinct files).
- Build delegated to one sub-agent; boot + voice delegated to two parallel sub-agents.
- Polish docs in parallel.

---

## Notes

- `[P]` = different files / no unfinished dependencies.
- No automated test tasks — validation is manual via `quickstart.md` + delegated sub-agent verify tasks.
- Do NOT bake secrets; do NOT commit `.env` or the locally downloaded model (`models/`).
- `sudo` may be needed for `docker` on some setups; run build/verify via a sub-agent that handles it.
