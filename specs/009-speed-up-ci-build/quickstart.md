# Quickstart: Validate CI Speed-Up

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-08-04

Purpose: prove the `node:24-slim` base swap builds correctly and quickly before
deploying to ECS Fargate. Validation is build-time only (deploys are
non-reversible; the Fargate task definition is unchanged).

## Prerequisites

- Docker with `docker buildx` plugin
- Access to GHCR (`ghcr.io/astral-sh/uv`) and the opencode install URL (network)

## 1. Cold build (correctness + timing)

```bash
docker buildx build \
  --platform linux/amd64 \
  --file deploy/discord-agent/Dockerfile \
  --progress=plain \
  deploy/discord-agent
```

- **Expected**: build succeeds with the `node:24-slim` image.
- **Expected (SC-001/SC-003)**: the two legacy apt-get steps (`#10`, `#12`) are gone;
  total time is dominated only by the base pull + `apt-get install git python3` — well under 1 min.
- **Expected**: `opencode --version`, `uv --version`, and `node --version` all report inside the image
  (verify in a `RUN` or by running the produced image).

Verify the final image has node 24 and the agent's deps:

```bash
# after build, tag it locally first:
docker buildx build --platform linux/amd64 -t discord-agent:test --file deploy/discord-agent/Dockerfile deploy/discord-agent
id=$(docker create discord-agent:test) && docker cp $id:/app /tmp/agent-check 2>/dev/null || true
docker run --rm discord-agent:test node --version   # → v24.x
docker run --rm discord-agent:test uv --version     # → 0.x
docker run --rm discord-agent:test opencode --version  # → 1.18.x
```

## 2. Warm build (caching, SC-001/SC-004)

Rerun the same `docker buildx build` command a second time with GHA-style cache
warmed (on CI this is automatic). Expected: layers reuse from cache → ~10–20 s.

On CI: push a no-op commit after the change and compare the job's Docker build
step duration against the previous ~15 min run.

## 3. Deploy (after local validation)

Trigger the existing `deploy-aws.yml` workflow (`workflow_dispatch`) or push to
`main`. Confirm the ECS Fargate task comes up Healthy. The task definition and
`run.sh` are unchanged, so runtime behavior is preserved.

## Success gates

- [ ] Cold `docker build` succeeds and finishes ≤ 1 min (SC-001/SC-003)
- [ ] Warm `docker build` finishes ≤ 20 s (SC-001/SC-004)
- [ ] `node`, `uv`, `opencode` all functional in the image (SC-005 — no regressions)
- [ ] Deployed task is Healthy (end-to-end)
