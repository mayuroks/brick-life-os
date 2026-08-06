> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Contract: Automated Deployment (CI → Registry → Host)

**Feature**: `007-aws-apprunner-deploy` | **Date**: 2026-08-04

The deployable interface this feature provides: a **CI pipeline contract** that, given
a merged change to `main`, produces a working host deployment with no manual action
(FR-002) and never takes down the running version on failure (FR-007).

Target host: **ECS Express Mode** (App Runner closed to new customers); fallback **EC2
free tier**. The CI contract is host-agnostic at the "build + push image" step and
host-specific at the "deploy" step.

## Contract: workflow triggers & behavior

- Input: a push/merge to the `main` branch touching `deploy/discord-agent/**` or the
  workflow file; or a manual `workflow_dispatch`.
- Step 1 — Build: build `deploy/discord-agent/Dockerfile` for `linux/amd64`.
- Step 2 — Push: tag with `${{ github.sha }}` and push to the private ECR repo.
- Step 3 — Deploy: create (first time) or update (subsequent) the host service to the
  new image, with text-only runtime env and secrets from the host secret store.
- Failure: any step failure aborts the pipeline and is surfaced in the GitHub Actions
  run; the previous healthy service revision continues serving (FR-007).

## Contract: authentication (FR-005)

- GitHub Actions assumes an **IAM CI role** via OIDC (short-lived tokens). No AWS
  access key is stored in the repo.
- The host uses a **separate access role** to pull the image from ECR (run-time pull),
  distinct from the CI push role.

## Contract: required repo secrets

| Secret | Used for |
|--------|----------|
| `AWS_ROLE_ARN` | IAM role ARN the CI workflow assumes (OIDC). |
| Host access role ARN | Role the host service uses to pull images from ECR (set in the service). |
| Discord / Jira / provider secrets | Runtime env on the host (from the host secret store, not the repo). |

## Contract: success / failure rule

- **Success** = image pushed AND host service updated AND health endpoint reachable
  after rollout.
- **Failure** = any step errors → pipeline marked failed; prior revision kept serving;
  human-visible failure in the run log.

## Reference

- Spec: [spec.md](../spec.md) (FR-002, FR-005, FR-007)
- Data model: [data-model.md](../data-model.md)
