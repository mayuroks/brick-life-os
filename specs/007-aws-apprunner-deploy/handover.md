> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Handover: 007 AWS Deployment (Text-First)

**Date**: 2026-08-04 | **Feature**: [spec.md](./spec.md) | **Branch**: `007-aws-apprunner-deploy`

## Final host + account status

- **AWS account**: `243746944554` (us-east-1) — activated, admin user `aws-service-admin` + a
  restricted `aws-service-role` (which lacks perms and is unused).
- **Host**: Amazon **ECS Fargate** (App Runner is closed to new customers; Render retired).

## Provisioned infrastructure (imperative, not IaC)

| Resource | Value |
|----------|-------|
| ECR repo | `discord-agent` (`243746944554.dkr.ecr.us-east-1.amazonaws.com/discord-agent`) |
| OIDC provider | `token.actions.githubusercontent.com` |
| CI role | `arn:aws:iam::243746944554:role/github-actions-ci` |
| ECS exec role | `arn:aws:iam::243746944554:role/ecs-task-execution` |
| Cluster / Service | `discord-agent` (Fargate 256/512, desiredCount=1) |
| Task definition | `discord-agent:2` (secrets via SSM) |
| Security group | `sg-04910b2389f70681a` (ingress :3000) |
| Public subnets | `subnet-0291d89a38f3bb502`, `subnet-073ab0dcc4d7073c3` |
| SSM secrets | `/discord-agent/{DISCORD_BOT_TOKEN,JIRA_URL,JIRA_USERNAME,JIRA_API_TOKEN,OPENROUTER_API_KEY}` |
| CloudWatch logs | `/ecs/discord-agent` |
| GitHub secret | `AWS_ROLE_ARN` = CI role ARN (set via `gh`) |

## Status

- Bot live as `Brick#4254`; `/health` on :3000; text-only (`DISABLE_VOICE=1`) active.
- `.github/workflows/deploy-aws.yml` targets ECS Fargate (OIDC, SHA+latest tags, subnets/SG defined).
- **Remaining (manual/live)**: verify a real auto-deploy (push to `main`), confirm text reply after
  rollout, add an external keep-alive/uptime pinger on `/health`, then delete the static AWS CLI keys
  once OIDC deploys are stable.

## Security

- Live Jira token scrubbed from local `agent/opencode.json`; none committed (git-ignored + regenerated
  at boot). Static CLI key is local-only, retained while iterating.
