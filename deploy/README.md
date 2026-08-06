# Deploy Truth — Life OS Discord Agent

> **This is the single, authoritative statement of how the Life OS agent is
> deployed. All AWS deploy truth lives here.** Files elsewhere that claim
> Fargate / Render / App Runner / `us-east-1` / SSM Parameter Store / ECR /
> whisper / `DISABLE_VOICE` / CloudWatch `/ecs/` are **LEGACY** unless marked
> `[LEGACY/ARCHIVED]` right here or in `specs/`/`openspec/` history.

## Ground truth

| Item | Truth |
|---|---|
| Region | `ap-south-1` |
| Compute | 1× EC2 `t3.micro`, **1GB RAM + 2GB swap**, native (no Docker) |
| Instance name / ID | `lifeos-box` / `i-06885b4aaddfd1b1e` (running) |
| Public IP | **`15.252.6.196`** |
| Secrets | `deploy/discord-agent/.env` on the box, pushed via stdin, `chmod 600`, loaded by systemd `EnvironmentFile` |
| Voice | **Groq STT** off-box (no whisper, no `DISABLE_VOICE`) — authoritative in `deploy/discord-agent/src/config.js` |
| Observability | `journalctl` + `GET /health:3000` (NOT CloudWatch / ECS-Exec) |

## Deploy scripts (live path)

All run from the repo root and live in `deploy/ec2-single-box/`:

| Task | Command |
|---|---|
| Provision / launch the box | `./deploy/ec2-single-box/provision.sh` |
| Full deploy (code + secrets) | `./deploy/ec2-single-box/deploy.sh` |
| Secrets-only update (rotate a token) | `./deploy/ec2-single-box/update-secrets.sh` |

- `deploy.sh:16` and `update-secrets.sh:14` both default `BOX_IP=15.252.6.196` (the live box).
- `provision.sh:24` `SSH_SOURCE=122.171.22.59/32` is the **SSH source CIDR**, not the box IP.

## Verify on the box

```sh
ssh -i deploy/ec2-single-box/lifeos-box.pem ubuntu@15.252.6.196 \
  'systemctl is-active discord-agent; swapon --show; curl -s localhost:3000/health'
```

## Staleness gate

`scripts/aws-stale-check.sh` (read-only) greps the repo for stale markers and
fails on any hit **outside** explicit `[LEGACY/ARCHIVED]` banners and archived
`specs/`/`openspec/`. This is the deployment-truth "bill of materials shipped"
guard. Run it after changing anything in `deploy/`:

```sh
bash scripts/aws-stale-check.sh
```

## What to NEVER do

- Do **not** run any ECS/Fargate/ECR/App Runner/Render provisioning — billable and legacy.
- Do **not** reference `us-east-1`, SSM Parameter Store, ECR, CloudWatch `/ecs/`,
  whisper, or `DISABLE_VOICE` as current — every one is legacy.
- Do **not** edit `deploy/discord-agent/Dockerfile`, `task-def.json`, or
  `render.yaml` — they are `[LEGACY/ARCHIVED]` Docker/Render/Fargate artifacts.
- Do **not** commit the real `.env` or any `*.pem` (see repo root `.gitignore`).
