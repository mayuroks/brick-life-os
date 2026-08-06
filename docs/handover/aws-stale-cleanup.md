# AWS Deploy Surface — Stale-Reference Cleanup Handover

**Status:** READY FOR EXECUTION
**Owner:** next agent to pick this up
**Companion audit:** see the admin-level analysis this is derived from (the AWS-staleness audit discussion).
**Rule (hard):** DO NOT provision any AWS resource. DO NOT delete any AWS account resource until Phase 0 verification passes and a human confirms.
**Free-tier mandate:** the **only** valid setup is a single EC2 `t3.micro`, **1GB RAM + 2GB swap**, **region `ap-south-1`**, native (no Docker), secrets via `.env`. Everything named below as "stale" contradicts that and must be neutralized so a future LLM agent can't follow it into billable/wrong-region action.

---

## TL;DR for the picking-up agent

The repo has a **correct live path** and **six stale media surfaces** that still read as authoritative. Your job: retire/banner the stale ones, fix the wrong values that remain, centralize one "deploy truth" file, and add a staleness gate so this never regresses. No code behavior of the live agent changes.

Same-old-top-errors to avoid:
1. Do **not** mention/amplify "Fargate", "us-east-1", "Render", "App Runner", "SSM Parameter Store", "ECR", "DISABLE_VOICE", or "CloudWatch /ecs/" as if current — every one is legacy.
2. Do **not** run `.github/workflows/deploy-aws.yml` — it provisions billable Fargate.

---

## Ground truth (single source)

| Item | Truth | Where proven |
|---|---|---|
| Region | `ap-south-1` | `deploy/ec2-single-box/provision.sh:18`, `.github/workflows/deploy-aws.yml:25` (region half only) |
| Compute | 1× EC2 `t3.micro`, 1GB RAM + **2GB swap**, native (no Docker) | `provision.sh:12,20,23,83-89`; `specs/011-groq-stt-voice/adr.md:16` |
| Secrets | `.env` pushed via stdin, chmod 600, systemd `EnvironmentFile` | `deploy.sh:35-37`, `setup-app-remote.sh:53` |
| Voice | Groq STT off-box (no whisper, no DISABLE_VOICE) | `deploy/discord-agent/src/config.js:41-53` |
| Observability | `journalctl` + `/health:3000` (NOT CloudWatch/ECS-Exec) | `run.sh`, `setup-app-remote.sh:71-74` |

**Live box IP ambiguity (must resolve):** `deploy.sh:16` and `update-secrets.sh:14` default `15.252.6.196`, but `deploy/ec2-single-box/README.md:49` says `54.242.7.113`. `provision.sh:24` `122.171.22.59/32` is the SSH source CIDR, not the box IP. Pick the one live IP before finalizing the truth file.

---

## Phase 0 — Verify real AWS account state (read-only; human confirms before any delete)

**Goal:** find out what actually exists in the account so we never delete a live resource, and confirm whether billable Fargate/ECR is currently running.

Commands (read-only, via repo-local CLI wrapper `./aws.sh`):
```sh
./aws.sh sts get-caller-identity
./aws.sh ecs list-clusters --region ap-south-1
./aws.sh ecs list-services --cluster discord-agent --region ap-south-1
./aws.sh ecr describe-repositories --region ap-south-1
./aws.sh logs describe-log-groups --region ap-south-1        # look for /ecs/discord-agent
./aws.sh ec2 describe-instances --region ap-south-1          # confirm the one t3.micro
```

**Deliverable:** a short note in this file under "Account findings" stating which legacy resources exist and their region. **Stop and ask the human before deleting/tearing down any account resource.**
- Note: `.aws-setup/*` (OIDC/IAM/ECS-exec) may be fully dead, but confirm against account state before archiving (its OIDC trust conflicts with the workflow's IAM-key auth — at least one is dead).

---

## Phase 1 — Neutralize the dangerous Fargate workflow (highest priority)

**Target:** `.github/workflows/deploy-aws.yml`
**Why:** currently triggers on every push to `deploy/discord-agent/**` (`:10-16`) and registers/deploys an **ECS Fargate** service (`:72-108`, `--launch-type FARGATE :94`) => billable, free-tier-violating. It is NOT how the live box deploys (that's `ec2-single-box/deploy.sh`).

**Tasks:**
1. Remove the `on.push` trigger (or delete the workflow file). Keep `workflow_dispatch` only if a human explicitly wants a manual Fargate run — otherwise delete the file.
2. If the workflow is the only consumer of `deploy/discord-agent/Dockerfile`, note that (Phase 3 will banner it).

**Files touched:** `.github/workflows/deploy-aws.yml`

**Verify:** the workflow no longer fires on push; no new ECS/Fargate tasks appear in the account after a code push.

---

## Phase 2 — Create a single deploy-truth file

**New file:** `deploy/README.md` (or `deploy/state.md`)
**Content:** assert the Ground Truth table above (region, instance/swap, IP, secrets path, voice, observability) plus: "All AWS deploy truth lives here. Files elsewhere claiming Fargate/Render/App Runner/us-east/SSM/ECR/whisper/DISABLE_VOICE are LEGACY unless marked otherwise."
**Why:** gives every future agent one authoritative pointer and kills the "which file is right?" cost for them.

**Files touched:** new `deploy/README.md`

---

## Phase 3 — Banner every legacy surface (do NOT delete history)

Add a top-of-file banner to each. Use an unambiguous marker the gate (Phase 5) can grep, e.g.:
```md
> **[LEGACY/ARCHIVED] — superseded by the EC2 single-box path (deploy/ec2-single-box/ + deploy/README.md). Do not follow. Region is ap-south-1, host is a 1GB+2GB-swap t3.micro.**
```

Targets & the stale claims to neutralize (with line refs):
| File | Stale claims to fix/banner |
|---|---|
| `deploy/discord-agent/Dockerfile` | builds a Fargate/ECR image (`:21 uv tool install mcp-atlassian`, `:47 Fargate`) — only used by the Phase-1 workflow |
| `deploy/discord-agent/task-def.json` | `requiresCompatibilities FARGATE :4-8`; `cpu 512/mem 1024 :7-8`; `DISABLE_VOICE=1 :25-27`; image+SSM `ap-south-1 :14,44-57` **but** `awslogs-region us-east-1 :63` (internal contradiction — fix or delete) |
| `deploy/discord-agent/render.yaml` | Render free tier, `WHISPER_MODEL :22` — Render retired |
| `deploy/discord-agent/README.md` | header: "Current host: AWS ECS **Fargate** / GitHub **OIDC** :8-20" (actual auth = IAM keys, not OIDC); voice section describes **local whisper** + "deployed voice later" `:59-82` (Groq already shipped); "Deploy to Render" section `:84-131` |
| `docs/log-blueprint.md` | CloudWatch `/ecs/discord-agent`, ECS-Exec/SSM `:1,8,39,89-142` — box uses journalctl. Repoint or banner |
| `.aws-setup/*` | `taskdef.json`, `taskdef2.json`, `ecs-exec-policy*.json`, `oidc-trust.json`, `ci-policy.json` — `us-east-1` Fargate/OIDC |
| `specs/005-render-ubuntu-deploy/*` | Render + whisper (retired host) |
| `specs/007-aws-apprunner-deploy/*` | App Runner → ECS Express → Fargate, `us-east-1` (`handover.md:7,15,20-23`; `research.md:40-96`) |
| `deploy/ec2-single-box/README.md` | fix IP `:49` to the one live box IP |

**Do NOT delete:** archived specs (`specs/00X`, `openspec/changes/archive/**`) — keep as audit history, label with banner only.

**Files touched:** `deploy/discord-agent/{Dockerfile,task-def.json,render.yaml,README.md}`, `docs/log-blueprint.md`, `.aws-setup/*`, `specs/005-render-ubuntu-deploy/*`, `specs/007-aws-apprunner-deploy/*`, `deploy/ec2-single-box/README.md`

---

## Phase 4 — Fix the live-path drift

Keep these correct and aligned with the truth file:
1. `deploy/ec2-single-box/README.md:49` — set the single live IP (match `deploy.sh:16`).
2. Confirm `deploy/ec2-single-box/` scripts are consistent (`deploy.sh:16` == `update-secrets.sh:14`, `provision.sh:24` SSH source).
3. `deploy/discord-agent/src/config.js` is authoritative for voice (Groq) — do not reintroduce `DISABLE_VOICE`.

**Files touched:** `deploy/ec2-single-box/README.md` (and any script default that drifts)

---

## Phase 5 — Add a staleness gate (prevents regression)

**New file:** `scripts/aws-stale-check.sh` (or a CI read-only job)
**Behavior (read-only):** grep the repo for stale markers and fail on any hit **outside** explicit `[LEGACY/ARCHIVED]` banners and archived `specs/`.
Markers: `FARGATE`, `us-east-1`, `Render`, `App Runner`, `DISABLE_VOICE`, `SSM Parameter Store`, `ECR`, `/ecs/`, `ECS-Exec`, `CloudWatch`.
**Why:** this is the deployment-truth "bill of materials shipped" guard — future agents can't silently re-introduce wrong claims.

**Files touched:** new `scripts/aws-stale-check.sh` (+ optionally wire into CI)

---

## Phase 6 — Verification / exit criteria

Run and confirm:
1. `grep -rni "Fargate" .` (excluding `specs/`, `openspec/`, `node_modules`) → **0** hits.
2. `grep -rni "us-east" .` (excluding `specs/`, `openspec/`, `.aws-cli-v2/`) → **0** hits.
3. All region/compute/secrets/voice/IP asserts appear in exactly one file (`deploy/README.md`).
4. `.github/workflows/deploy-aws.yml` no longer triggers on push.
5. Live box health: `ssh ubuntu@<live-ip> 'systemctl is-active discord-agent; swapon --show; free -h; curl -s localhost:3000/health'` returns active + swap + `ok`.
6. Optionally run the Phase 5 gate: `bash scripts/aws-stale-check.sh` → clean.

---

## Account findings (filled in during Phase 0 — read-only audit, 2026-08-06)

- **Live box (the one to keep):** `i-06885b4aaddfd1b1e` — `t3.micro` **`lifeos-box`**, **running**, public IP **`15.252.6.196`** (ap-south-1). Health verified: `discord-agent` systemd **active**, 2G swap on, `/health` → `{"status":"ok",...}`.
- **IP ambiguity RESOLVED:** live IP is **`15.252.6.196`** (matches `deploy.sh:16` and `update-secrets.sh:14`). `54.242.7.113` in `deploy/ec2-single-box/README.md:49` is **wrong** and is being fixed in Phase 4.
- **ECS clusters:** none in `ap-south-1` **or** `us-east-1` (`clusterArns: []`). No Fargate service `discord-agent` exists anywhere → **no billable Fargate is running.** The Phase-1 workflow's ECS targets are dead.
- **ECR repos:** none in either region (`repositories: []`). No `discord-agent` image repo.
- **CloudWatch group `/ecs/discord-agent`:** exists **only in `us-east-1`** (legacy from the old Fargate path). The live box uses **journalctl**, not CloudWatch. This group is a stranded legacy artifact (no cluster references it now).
- **Legacy resources — CLEANED (human signed off 2026-08-06):**
  - Stopped `t3.small` `agentv2` (`i-094366662cde99906`) → **terminated** (Verified: `State=terminated`; live box untouched).
  - CloudWatch `/ecs/discord-agent` (us-east-1) → **deleted** (Verified: `logGroups: []` us-east-1).
  - IAM roles `ecs-task-execution`, `ecs-task-role`, `github-actions-ci` → **deleted** (inline policies `ecs-exec`/`ci-deploy` removed first; `AmazonSSMManagedInstanceCore` detached). Verified `NoSuchEntity`.
  - OIDC provider `token.actions.githubusercontent.com` → **deleted** (Verified: `OpenIDConnectProviderList: []`).
  - Standalone managed policies: none existed for this work (ci/ecs policies were inline-only).
  - Post-cleanup re-check: **live `lifeos-box` `i-06885b4aaddfd1b1e` untouched, `running` at `15.252.6.196`, `discord-agent` active, `/health` → ok.**
- **Human sign-off obtained before any teardown?:** **YES** — account resources listed above were deleted after human approval. No billable/live resource was touched.

---

## Reference index (minimize your research)

- Live deploy scripts: `deploy/ec2-single-box/{provision.sh,deploy.sh,update-secrets.sh,setup-app-remote.sh,README.md}`
- Live app: `deploy/discord-agent/{run.sh,src/**}` + `src/config.js` (Groq voice) + `scripts/bootstrap.js`
- Live config render input: `deploy/discord-agent/agent/opencode.json.template`
- Stale Fargate workflow: `.github/workflows/deploy-aws.yml`
- Stale Fargate/Render artifacts: `deploy/discord-agent/{task-def.json,render.yaml,Dockerfile}`
- Stale observability doc: `docs/log-blueprint.md`
- Stale us-east-1 account artifacts: `.aws-setup/*`
- Historical specs to banner, not delete: `specs/005-render-ubuntu-deploy/*`, `specs/007-aws-apprunner-deploy/*` (note `specs/010-agent-latency-reuse/research.md:39-51` documents the warm-serve reversal if relevant)
- Authority pointer: `openspec/changes/archive/2026-08-06-groq-token-env-ec2-deploy/design.md:3,14`
