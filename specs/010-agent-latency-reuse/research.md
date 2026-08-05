# Research: Discord Agent — Latency & Reuse

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-05 | **Branch**: `010-agent-latency-reuse`

## Key Findings (verified via source + live repro on opencode v1.18.11)

> **NOTE — local vs deployed scope**: The latency/reuse work targets the **deployed**
> agent inside the Fargate container (`opencode` installed via `opencode.ai/install`
> into `deploy/discord-agent`, driven by the Discord bridge). It does **not** touch the
> maintainer's **local interactive opencode** on the Macbook (npm-installed). None of
> the changes below affect local usage; they are scoped to `deploy/discord-agent`
> production invocations only.

### R1 — Kill the throwaway auto-title call (FR-004)
- **Verified by reading opencode v1.18.11 source** (`SessionPrompt.ensureTitle`,
  `packages/opencode/src/session/prompt.ts:193`): a title LLM call fires once per fresh
  session, ONLY if the session still has a default title (`"New session - <ISO>"`).
- **Mechanism**: when `opencode run` starts a fresh session with no title given, the
  default title matches → triggers the ~20s throwaway title call (invisible to a
  Discord bot).
- **There is NO config option, env var, or `--no-title` flag.**
- **Fix (server-side only, verified)**: pass a **fixed** `--title "<some string>"` on
  every deployed `opencode run`. A non-default title short-circuits `ensureTitle`
  before any LLM call → call skipped entirely, no cost for the named session.
- **Caveats**:
  - Must pass `--title` on EVERY invocation (each `run` is a fresh session).
  - `--title ""` (empty) is NOT equivalent — it's treated as "no title" and re-triggers
    the call. Use a non-empty fixed string.
- A separate `summary.summarize` call also exists (not `--title`-controllable); if the
  measured 20s is dominated by summary rather than title, `--title` alone won't fix
  it — confirm which dominates in the deployed `--print-logs --log-level DEBUG` output.

**Implementer note (2026-08-05)**: `--title "life-os-agent"` added to the deployed
`opencode run` spawn in `src/agent/client.js`. If deployed logs post-deploy still show
~20s of pre-answer overhead, re-check whether a **summary** call (not title, not
`--title`-controllable) is the dominant cost — this is the residual unknown to verify
on the live host, not in a local repro.

### R2 — Reuse the warm serve via `--attach` (FR-005, FR-008)
- **Live-tested** on `opencode v1.18.11` + `deepseek-v4-flash-0731` with the repo's
  `deploy/discord-agent/agent` config:
  - Fresh run: **non-empty**, ~13s.
  - Warm serve + `run --attach http://127.0.0.1:4096`: **non-empty** (6+ runs, RC=0,
    never empty), ~6s.
  - **Blank-session-per-message likely**: an attach run had no recall of earlier
    attaches ("nothing was given to me this session") → green-but-blank shape holds.
  - Memory (RSS): serve ~666MB; one attach run ~326MB.
- **Verdict: the "empty replies with `--attach`" bug (code comment at
  `client.js:8-10`) appears STALE / NOT reproducible** for this build+model+config.
  The `--attach` path is viable and avoids the per-message spawn overhead.
- **Gate before committing**: local repro used short stateless prompts. The original
  failure may have been scenario-specific (multi-turn or MCP-heavy prompts). **RUN a
  small live canary through the real deployed bridge path** (an actual `today` /
  `add to backlog` command) before `--attach` replaces the fresh-run path (FR-008).

### R3 — Sizing the single-slot queue (FR-002, SC-002)
- Per-process RSS measured: warm serve ~666MB, one `--attach` run ~326MB, fresh
  `opencode run` ~326MB+ (retains per-message model+config load).
- On the ~1GB free-tier task, **1 agent turn in flight** (global single-slot) is the safe
  bound: a serve (~666MB) + one run (~326MB) ≈ ~1GB is already near the ceiling, so
  **no concurrency beyond 1** is viable. Single-slot queue is the structurally simple,
  OOM-proof choice (ADR decision).

## Decisions
- **D1 (FR-004)**: Disable auto-title by passing fixed `--title` on deployed `opencode
  run` invocations. Server-side only; local opencode unaffected. Low-risk, ~20s guaranteed.
- **D2 (FR-002)**: Implement a global single-slot in-memory queue (array + one worker)
  replacing the per-channel `ChannelQueue`; exactly one agent turn in flight.
- **D3 (FR-008, FR-005)**: Reuse the warm serve via `--attach` **gated on a live canary**
  through the real bridge path. Until the canary passes, keep the safe fresh-run path
  (with R1 title-off). Contingency: if the deployed attach path misbehaves, the floor is
  fresh-run + title-off (still ~20s win).

## Alternatives Considered
- **Carry conversation / compaction**: rejected — user wants stateless; Jira is memory.
- **Per-channel serial (status quo)**: rejected — different channels run in parallel,
  risking OOM on bursts.
- **Bounded parallelism (cap 3-4)**: rejected — arithmetically impossible on ~1GB with
  ~326-666MB runs (R3).

## References
- Source: opencode `v1.18.11` tag (`packages/opencode/src/session/prompt.ts`,
  `cli/cmd/run.ts`).
- Live repro: local `opencode v1.18.11` via `opencode run` / `opencode serve --port 4096`.
