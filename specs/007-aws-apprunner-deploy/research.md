# Research: AWS App Runner Deployment (Text-First)

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-04 | **Branch**: `007-aws-apprunner-deploy`

## Key Finding (blocks the original host choice)

> **AWS App Runner is no longer open to new customers.** As of 2026, AWS routes new
> users to **Amazon ECS Express Mode** (App Runner-style simplicity). App Runner has
> **no free tier** (provisioned $0.007/GB·h + active $0.064/vCPU·h).
>
> Sources:
> - https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
> - https://aws.amazon.com/apprunner/pricing/
> - https://aws.amazon.com/free/

**Impact**: The spec's assumption "AWS App Runner free tier" is no longer viable for a
new account. The plan must switch the host. Two candidates:

- **A — Amazon ECS Express Mode**: Keeps App Runner's simplicity (pull image, one
  service, autoscaling, built-in health checks), no free tier but low cost; closest
  conceptual fit to the original spec.
- **B — EC2 t2.micro (Free Tier)**: 750 hrs/mo free for 12 months, true free compute,
  but the user manages Docker + reverse proxy + health check manually and must keep
  instance size within free limits.

> Assumption default (pending user confirmation): **ECS Express Mode** preserves the
> "host service + auto-deploy + health check" shape of the spec with the least change
> to the workflow. EC2 is the fallback if the user requires literally-free hosting.

## Decisions

### Account status (2026-08-04)
AWS account is **not fully activated**: free-plan limitations active, registration may
take up to 24h. App Runner page shows the setup checklist / upgrade notice. This is a
**prerequisite** (finish activation + verify billing before creating resources), not a
plan blocker. Confirmed host direction (user): use an account that may already have
App Runner; given the freeze, target **ECS Express Mode** as the primary host, with
**EC2 t2.micro free tier** as the documented fallback if free hosting is required.

## IMPLEMENTED (post-plan): ECS Fargate
The account activated successfully and the host was implemented as **standard Amazon
ECS Fargate** (not ECS Express Mode): cluster + service `discord-agent`, task def
`discord-agent:2`, image `discord-agent:latest` in ECR, secrets in SSM Parameter Store
(`/discord-agent/*`), CloudWatch logs `/ecs/discord-agent`. Discord bridge boarded as
`Brick#4254`; `/health` on :3000. Static admin key retained while iterating; OIDC used
for CI. See `quickstart.md` for live validation.

## Decision: CI/CD — GitHub Actions with OIDC (no long-lived keys)
- **Decision**: GitHub Actions workflow `deploy/discord-agent` uses OIDC to assume an
  IAM CI role tailing ECR + host-deploy permissions. No AWS access key stored in the repo.
- **Rationale**: Satisfies FR-005 (no long-lived repo credentials); short-lived tokens.
- **Alternatives considered**: Stored IAM access key+secret (simpler setup, but a
  standing secret to rotate — rejected).

### Decision: Image registry — Amazon ECR
- **Decision**: Push built image to a private ECR repo (`discord-agent`); host pulls it.
- **Rationale**: Private, free components (only pay storage), native to ECS/App Runner.
- **Alternatives considered**: Docker Hub / GHCR — GHCR is fine but adds a second
  registry hop; ECR keeps everything in one AWS flow.

### Decision: Text-only runtime (whisper deferred)
- **Decision**: Set `DISABLE_VOICE=1` on the host (existing config flag). Voice notes
  get a friendly notice; no whisper model/binary on the host.
- **Rationale**: FR-004; keeps the constrained host CPU light so text stays responsive.
- **Alternatives considered**: Run whisper tiny on-host (burns CPU on a weak instance —
  rejected for text-first); Groq Whisper API (scheduled follow-up, FR-008).

### Decision: Host — ECS Express Mode (primary) / EC2 free tier (fallback)
- **Decision**: Target **Amazon ECS Express Mode** (App Runner successor for new
  customers): pull image → single service, built-in health checks, min-instance=1 to
  stay always-on. Fallback: **EC2 t2.micro free tier** if the user needs literally
  free hosting and accepts manual Docker/reverse-proxy admin.
- **Rationale**: App Runner is closed to new customers; ECS Express preserves the
  "managed host service + auto-deploy + health check" shape of the spec with the least
  change to the workflow. EC2 is the only true free-tier host.
- **Alternatives considered**: App Runner (closed to new customers — rejected).

### Decision: Keep-alive + health
- **Decision**: Keep host min-instance = 1 (never scale to zero) and serve `/health`
  for the platform's own health check and any external uptime pinger.
- **Rationale**: FR-001/FR-009 — a long-running Discord websocket must not be
  scale-to-zero evicted; a live `/health` keeps it warm and surfaces downtime.
- **Alternatives considered**: UptimeRobot external pings alone (platform may still
  scale down a 0-min auto-scaling config — host must be min-1 instead).

### Decision: Failed deploy keeps previous version
- **Decision**: A failed rollout must not take down the running version; the host
  retains prior healthy revisions and the pipeline surfaces failure.
- **Rationale**: FR-007.
- **Alternatives considered**: Blue/green manual rollback (overkill for prototype).

## Open items for Phase 1 (resolved)
- ✅ Host choice: ECS Express Mode primary; EC2 t2.micro free tier fallback (user approved
  account-status path; App Runner closed to new customers).
- ✅ Account/region: AWS account not fully activated yet — must finish sign-up (up to 24h)
  and verify billing before provisioning. Region: us-east-1.
