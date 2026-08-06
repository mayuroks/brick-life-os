> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Quickstart: AWS App Runner Deployment (Text-First) — Validation Guide

**Feature**: `007-aws-apprunner-deploy` | **Date**: 2026-08-04

Purpose: validate that (a) the agent boots and answers **text** on a real AWS host,
(b) changes deploy automatically from the repo, and (c) voice notes are handled
gracefully in text-only mode. Manual acceptance suffices per the constitution.

## Prerequisites

- AWS account **fully activated** (free-plan limitations cleared; may take up to 24h)
  with billing verified — [see research.md](./research.md).
- AWS CLI installed + configured locally (for the one-time infrastructure setup).
- Host decision settled: **ECS Express Mode** (primary) or **EC2 free tier** (fallback).
- The image must already build (verified: `deploy/discord-agent/Dockerfile` builds
  clean for `linux/amd64`).

## 1. Verify text-only runtime locally (FR-004, FR-006)

Boot the service with a text-only override and confirm a voice note is answered with
the notice while text still flows.

```bash
cd deploy/discord-agent
# set real secrets (Discord/Jira/OpenRouter) in .env, then:
DISABLE_VOICE=1 node src/index.js
```

- Send a **text** message → expect a substantive agent reply (FR-003).
- Send a **voice note** → expect: "Voice transcription is off... send a text message"
  (FR-004).
- Boot **without** a required key → expect a clear fail-fast error listing the missing
  secret (FR-006); verify with `contracts/` data model validation rules.

## 2. Verify the health/keep-alive surface (FR-009)

While running, confirm the health contract:

```bash
curl -i http://localhost:3000/health   # expect 200 {"status":"ok","agent":"up","bridge":"up"}
```

See `contracts/health-contract.md` ([006](../006-health-endpoint/contracts/health-contract.md))
for ready-state semantics.

## 3. Verify live host deployment (FR-001, FR-002)

Once the account is active:

1. Create the ECR repo, IAM OIDC CI role, and host service (one-time setup; details in
   `tasks.md` — Phase 2).
2. Push a change touching `deploy/discord-agent/**` to `main` (or trigger
   `workflow_dispatch`).
3. Open GitHub Actions → confirm the build → push → deploy steps all pass.
4. Send a text message to the bot → expect a reply from the **live host** (not local).
5. Confirm host stays reachable via `/health` after rollout.

## 4. Verify failed deploy safety (FR-007)

- Push a change that fails to deploy (e.g., broken image build).
- Expect: pipeline marked **failed**; previously running (healthy) version keeps
  answering text; no silent outage.

## 5. Verify voice does not wedge the bot (FR-004, SC-004)

- On the live host with `DISABLE_VOICE=1`, send a voice note then immediately a text
  message.
- Expect: the next text message still gets a reply (0 voice-related outages).

## Reference

- Data model: [data-model.md](./data-model.md)
- Deploy contract: [contracts/deploy-contract.md](./contracts/deploy-contract.md)
- Research (account/host): [research.md](./research.md)
