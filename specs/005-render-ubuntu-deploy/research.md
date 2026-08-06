> **[LEGACY/ARCHIVED] — historical spec for a retired host path, superseded by the EC2 single-box native deploy (`deploy/ec2-single-box/` + `deploy/README.md`). Kept as audit history — do not follow. Region is `ap-south-1`, host is a 1GB+2GB-swap `t3.micro`.**

# Research: Render Ubuntu Cloud Deployment (Phase 0)

**Feature**: `005-render-ubuntu-deploy` | **Date**: 2026-08-03

Resolves the deployment unknowns. Three parallel research passes consolidated.

## R1 — Base image honoring "Ubuntu 26.04 LTS"

- **Decision**: `FROM ubuntu:26.04` (amd64) and install Node.js **24 LTS** via NodeSource, keeping the user's explicit Ubuntu choice.
- **Rationale**: There is no official *Node* image based on Ubuntu (Node images are Debian- or Alpine-based), but the requirement is glibc compatibility for the whisper/ffmpeg binaries — which Ubuntu provides. A single `ubuntu:26.04` runtime stage keeps the base as the user asked while giving glibc.
- **Alternatives**: `node:24-bookworm-slim` (Debian, glibc, smaller — pragmatic but is *not* Ubuntu); `node:20-alpine` (musl — breaks whisper/ffmpeg-static). Rejected in favor of the requested Ubuntu base.

## R2 — whisper-cli on Ubuntu amd64

- **Decision**: Install the **`whisper.cpp` apt package** (`universe`, provides `/usr/bin/whisper-cli`) in the image — no source compile, tiny footprint.
- **Rationale**: Ubuntu 26.04 ships a prebuilt amd64 `whisper-cli` (~v1.8.3). Runtime deps (`libc6`, `libstdc++6`, `libgomp`/OpenBLAS are **not** required for the default CPU build) come via apt. No build tools in the final image.
- **Alternatives**: build-from-source (needs `build-essential cmake git`, large build stage, ~2–5 min — avoid); official prebuilt `whisper-bin-ubuntu-x64.tar.gz` (v1.9.1) as a pin-worthy upgrade if newer features are needed.
- **Audio**: whisper needs **16 kHz mono 16-bit WAV**; Discord gives Opus. Transcode with ffmpeg before whisper (add `ffmpeg` via apt, or keep the code's `ffmpeg-static` npm binary — both are fine; the code already uses `ffmpeg-static`).

## R3 — ffmpeg + Node + opencode in the image

- **Decision**: 
  - `ffmpeg-static` npm already bundles an amd64 glibc static ffmpeg — keep it (postinstall must run; do NOT `--ignore-scripts`). No system ffmpeg strictly required by the code, but apt `ffmpeg` is harmless if needed.
  - opencode CLI via the official installer: `ENV OPENCODE_INSTALL_DIR=/usr/local/bin` + `curl -fsSL https://opencode.ai/install | bash` (single compiled binary). Install `git` + `ca-certificates`.
  - Node 24 LTS (discord.js needs ≥18; opencode is a standalone binary).
- **Rationale**: Smallest, most reliable set for an amd64 glibc container.

## R4 — Render free-tier constraints

- **Architecture**: Render runs **linux/amd64** only. The image must be amd64 (pin `--platform=linux/amd64` in the top-level `FROM`; local Apple-Silicon arm64 binaries are NOT reusable).
- **Resources**: Free Docker web service = **512 MB RAM / 0.1 CPU**. Model + Node + opencode + ffmpeg must fit in 512 MB. → Use the **`tiny.en`** model (~75 MB disk, ~273 MB RAM) in the image; **`base.en`** (~388 MB) is too tight on the free plan.
- **Sleep**: Free tier sleeps after **15 min idle**; the Discord gateway is *outbound*, so it does NOT count as inbound activity — the bot can disconnect during sleep. Mitigation: an **external pinger** (e.g., UptimeRobot) hitting the public URL every <15 min. This is a platform limitation: free tier cannot host a truly always-on Discord bot; a paid/starter plan is required for guaranteed 24/7 + near-realtime transcription (0.1 CPU will make transcription slower than local).
- **Ports**: bind public server to `$PORT` (Render default `10000`); opencode serve binds `127.0.0.1:4096` (loopback, fine). Avoid reserved ports 18012/18013/19099.
- **Health**: `healthCheckPath: /health` returning 2xx within 5s.
- **Build**: build-time compute is separate (2 CPU/8 GB on hobby starter); image ≤10 GB compressed; each redeploy re-burns build minutes (500/mo on hobby).

## Consolidated decisions

| Point | Decision | Rationale |
|-------|----------|-----------|
| Base image | `ubuntu:26.04` (amd64) + Node 24 via NodeSource | user's explicit Ubuntu choice; glibc |
| whisper-cli | apt `whisper.cpp` pkg (`/usr/bin/whisper-cli`) | prebuilt, no compile |
| Audio conversion | reuse `ffmpeg-static` npm (amd64 glibc binary) | already used by code |
| opencode | official install script → `/usr/local/bin` | single binary, no npm noise |
| Model (deployed) | `ggml-tiny.en.bin` at `/app/models/` + `WHISPER_MODEL` env | fits 512 MB free tier |
| Architecture | `linux/amd64` | Render requirement |
| Ports | express on `$PORT`(10000); opencode on `127.0.0.1:4096` | public + loopback |
| Health/keep-alive | `/health` + external pinger | free-tier sleep mitigation |
| 24/7 honesty | free tier sleeps; paid plan needed for guaranteed always-on + fast transcription | platform limitation, documented |
