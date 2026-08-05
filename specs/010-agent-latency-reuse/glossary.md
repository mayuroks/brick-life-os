# Glossary — 010 Agent Latency & Reuse

Terms used in the agent architecture so ambiguity doesn't hide a decision.

- **Stateless per message**: each message starts a blank agent session; no conversation
  history is carried from prior turns. All persistent state lives in Jira.
- **Green-but-blank**: a warm agent (persona + config + Jira MCP pre-initialized) that
  still starts with an empty instruction/context for the current message. Warm *boot*,
  empty *context*.
- **Warm serve**: the long-lived `opencode serve --port 4096` process that stays up so
  boot/config/Jira-MCP init are not redone per message.
- **Cold `opencode run`**: a fresh `opencode run` child process per message — redoes
  boot + auto-title + MCP reconnect + teardown every turn (current behavior).
- **Auto-title call**: the throwaway LLM round-trip used by opencode to name a session.
  Titled sessions are invisible to a Discord bot, so the ~20s is pure waste.
- **Single-slot queue**: one process-wide FIFO with exactly one agent run in flight;
  all other messages wait in an in-memory array. Guarantees 1 running `opencode run`.
- **Per-channel chain**: the current `ChannelQueue` — a FIFO per channel, so *different*
  channels execute in parallel.
- **OOM**: out-of-memory kill on the Fargate task (1GB limit) if too many concurrent
  `opencode run` processes (each ~400-500MB) start at once.
- **Hard $0/mo**: the requirement that AWS spend stays at $0 — no billable services,
  no paid plans, no non-free RDS/Lambda/buckets.
- **Reclaim**: locating currently-running billable AWS resources (EC2/ECS) and
  stopping/removing them to flatten the bill.
- **Serve-reuse gating**: verifying the persistent serve actually returns non-empty
  replies and can start a fresh blank prompt — if it can't, fall back to cold-per-message.
