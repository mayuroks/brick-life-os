# WU-01 — Warm-serve attach (`AGENT_ATTACH`)

> ## ⛔ NOT SHIPPABLE (verified 2026-08-08)
>
> **Status:** Do not implement. The `AGENT_ATTACH` flag was implemented and then
> **reverted / removed** after in-container verification showed the `--attach`
> path does not work with the currently deployed model + opencode build. Only the
> WU-02 (`run.sh`) respawn fix ships. Work can be revisited ONLY if the model /
> opencode pairing that supports attach is restored.
>
> **Key reason (failure of the core premise):**
> - Fresh `opencode run` → **non-empty** reply (`hi`), RC 0.
> - `opencode run --attach http://127.0.0.1:4096/` → **RC 0 but EMPTY stdout (0 bytes)**.
> - Verified in the local Docker container (`lifeos-agent`) on **opencode 1.18.15 + model `openrouter/poolside/laguna-xs-2.1`** (the model from `.env`).
> - `specs/010-agent-latency-reuse/research.md:48` had called the empty-reply bug
>   "stale / not reproducible" — but that was on **deepseek-v4-flash-0731 / opencode 1.18.11**.
>   The deployed pairing still reproduces empty replies. The original `client.js:8-10`
>   comment was correct; research was environment-specific.
> - Since `--attach` returns no answer, `AGENT_ATTACH=1` saves ~7s but **delivers nothing**.
>   The flag could never be safely enabled → dead code + a foot-gun.

> ### Risks of making this change (why it must stay off)
> - Every reply becomes empty if the serve worker is healthy enough to accept the
>   attach (RC 0) but returns no text. WU-01's own "Accepted edge cases" admits this
>   ("If attach ever returns empty, reply posts empty — acceptable"), but that empty
>   reply is the *normal* case for the current model, not an edge case.
> - Turning it on silently degrades the whole bot with no crash/log to surface it
>   (RC 0 looks like success). The existing empty-reply guard relies on a code path
>   that never fires for these args.
> - `run.op` telemetry would read from serve output; if that is also blank, the
>   observability (WU-05) shows nothing to diagnose — masked failure.

> ### Which user flows break (from the user's POV) if implemented
> - **Text messages (`today`, `add to backlog: X`, any freeform):** bot replies with
>   **nothing** (or an empty edit) instead of an answer. The `⏳ Wondering` status
>   disappears and no reply text posts. Every message, not just a subset.
> - **Voice notes:** comes after STT — the transcript would still be sent to the
>   attach path and also get an **empty** final reply, so voice flow breaks the same
>   way as text.
> - **Weekly groom (`run weekly`) / daily (`today`):** the long multi-turn/aux commands
>   depend on a real answer; empty reply leaves the user with no output and no error
>   they can act on.
> - **Net:** ~100% of interactive turns produce an empty response — functionally the
>   bot goes mute. The ~7s latency win is meaningless if there is no reply.

**Rollback:** flip `AGENT_ATTACH=0` in `.env` and restart (fresh-spawn path is preserved as fallback). Since the flag was removed, the fresh-spawn path is the only path — nothing to enable.

## Goal

Make the Discord bridge drive the **already-warm `opencode serve :4096`** via
`opencode run --attach http://127.0.0.1:4096` instead of spawning a fresh cold
`opencode run` per message — but gated behind a flag with the old path intact as fallback.

## Current behaviour / code

`deploy/discord-agent/src/agent/client.js:80-88` always spawns a fresh process:

```js
const child = spawn(
  'opencode',
  ['run', '--dir', AGENT_DIR, '--print-logs', '--log-level', 'DEBUG', '--title', 'life-os-agent', message],
  { cwd: AGENT_DIR, stdio: ['ignore', 'pipe', 'pipe'], env },
);
```

`serveUrl` (the `:4096` worker) is already passed in as `runAgent(cfg.serveUrl, payload)`
(`bridge/client.js`) but is silently dropped in the spawn (`client.js:55`).

## Edits (exact)

**File:** `deploy/discord-agent/src/agent/client.js`

1. **Read the flag once**, near the top of `runAgent` (after `const t0 = Date.now();`):

   ```js
   const attach = process.env.AGENT_ATTACH === '1';
   ```

2. **Build the args array conditionally**, replacing the hardcoded `['run', ...]` array in
   the `spawn(...)` call:

   ```js
   const baseArgs = ['run', '--dir', AGENT_DIR, '--print-logs', '--log-level', 'DEBUG', '--title', 'life-os-agent'];
   const attachArgs = attach ? ['run', '--dir', AGENT_DIR, '--attach', serveUrl, '--title', 'life-os-agent'] : baseArgs;
   const child = spawn('opencode', [...attachArgs, message], {
     cwd: AGENT_DIR,
     stdio: ['ignore', 'pipe', 'pipe'],
     env,
   });
   ```

   Note: keep `--print-logs --log-level DEBUG` only on the fresh-spawn path (attach output
   arrives via the serve process; final answer still comes back on this child's stdout).

3. **Log the mode** in the existing `run.start` log call: append `attach: attach` to the
   `fields` object.

## Verify (local, before touching EC2)

```sh
cd deploy/discord-agent
node --check src/agent/client.js                      # syntax OK
# Start serve, run one attach turn by hand:
(cd agent && OPENCODE_SERVE_URL=http://127.0.0.1:4096 opencode serve --port 4096 &) ; sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4096/   # expect 200
opencode run --dir agent --attach http://127.0.0.1:4096 --title life-os-agent "say hi"   # expect non-empty reply
```

If the manual attach returns a **non-empty** reply (RC 0), the path is safe to gate on.
If it ever returns empty, that is the known "empty-reply" risk → keep `AGENT_ATTACH=0`.

## Deploy / enable

1. Ship the code change to the box (`./deploy/ec2-single-box/deploy.sh`).
2. Add `AGENT_ATTACH=1` to the box's `.env` (`deploy/discord-agent/.env`), then
   `sudo systemctl restart discord-agent`.
3. Canary: send 10 real messages; confirm every reply is non-empty and boot time
   (`run.start` → first `stream providerID=openrouter`) is ≤3s.

## Accepted edge cases (keep simple)

- If attach ever returns empty, reply posts empty — acceptable; rollback via flag.
- Jira MCP now lives shared in the serve process; single-slot queue already serializes
  turns, so no cross-turn interference.
- `run.op` telemetry must still populate from serve output — see WU-05 if it doesn't.
