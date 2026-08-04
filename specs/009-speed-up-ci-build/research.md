# Research: Speed Up CI Build

**Feature**: [spec.md](spec.md) | **Date**: 2026-08-04

## Context

Build log analysis showed ~15 min total split as:
- `#10 apt-get install curl/ca-cert/git/python3` on `ubuntu:26.04` → ~10 min (runner network slow, 58 kB/s)
- `#12` NodeSource setup + `apt-get install nodejs` → ~4.5 min
- All other steps (uv copy, opencode install, npm ci, export) → ~20 s

⇒ The manual OS package + Node install steps are ~95% of the build time.

## Decisions

### 1. Base image → `node:24-slim`
- **Decision**: Use `node:24-slim` (Debian slim, glibc) as the base, then `apt-get install` only `git python3`.
- **Rationale**: Node 24 is pre-installed, eliminating the NodeSource step (~4.5 min) and the duplicate `python3`/`curl`/`ca-certificates` OS package install (~10 min). Removes two of the slowest layers and reduces cold runtime to ~1 min. Slim variant keeps glibc (needed by uv/opencode) while staying small.
- **Alternatives considered**:
  - `ubuntu:26.04` (current) — keeps manual install; rejected: 95% of build time.
  - `node:24-alpine` — smaller but musl libc; rejected: uv/opencode official binaries are glibc-targeted, risks breakage.
  - Pre-baked private gold image — fastest but requires extra infra; rejected: overkill, violates prototype pragmatism.

### 2. Keep GHA Docker layer cache (unchanged)
- **Decision**: Retain `cache-from/to: type=gha, mode=max` in `deploy-aws.yml`.
- **Rationale**: Already correct; warm builds reuse all RUN layers → ~10–20 s. Note: GHA cache scope includes the workflow file path, so edits to `deploy-aws.yml` invalidate the cache. Ship this change once and avoid churning the workflow file afterward.
- **Alternatives considered**: ECR-based cache registry, buildx `type=registry` — both add auth/complexity; not needed.

### 3. Pin base image digest
- **Decision**: Pin `node:24-slim` to a digest (as ubuntu already is) for cache-key stability.
- **Rationale**: Avoids surprise rebuilds when the moving `slim` tag drifts.
- **Alternatives considered**: Moving tag only — rejected: cache instability.

## Open items
- Resolve the exact `node:24-slim` digest at implementation time (`docker pull` + digest).
- Verify uv + opencode still run on the slim base (glibc present) via `docker build` smoke test before deploy.
