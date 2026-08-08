# WU-06: Eliminate opencode process-spawn startup tax (9.4s → ~0s)

## Context & Problem

The Discord bridge (`deploy/discord-agent/src/agent/client.js`) spawns a **fresh `opencode run` subprocess** per Discord message. Each spawn costs **9.4s** of startup (config load, Node/V8 warmup, ripgrep download, MCP init). This is the single largest latency contributor for short queries.

**Evidence from EC2 logs (Aug 8, 2026):**
- Run `msk14gpw` (13s total): 9.4s startup, 1.6s actual work
- Run `msin0p9f` (59s total): 8.7s startup, 50s work
- Run `msjh1y53` (36s total): 9.4s startup, 27s work

The `opencode serve` persistent HTTP server is installed (v1.18.11 — the version pinned in `Dockerfile`). It exposes an OpenAPI 3.1 spec at `http://<host>:<port>/doc`. The codebase comment in `src/agent/client.js:8-10` says serve "returns empty replies for this model/opencode build" — **this is outdated**. Live testing confirms it starts fine, creates sessions, and produces correct responses.

### API format (verified via OpenAPI spec + live testing)

The serve API uses **synchronous HTTP/JSON**, **not SSE streaming**. This corrects a key assumption in the original plan:

| Original plan assumed | Actual API |
|---|---|
| SSE response (`data: {type:"response", content}`) | Plain JSON: `{info: {...}, parts: [...]}` |
| Request body `{message: "..."}` | Request body `{parts: [{type: "text", text: "..."}]}` |
| `event.type === "response"` / `event.content` | `part.type === "text"` / `part.text` |
| `event.tool_calls` | `part.type === "tool"` with `part.tool`, `part.callID` |
| `stripThinking()` to strip "Thinking:" blocks | Not needed — reasoning is a separate `part.type === "reasoning"` |

**Key endpoint shapes:**
- `POST /session` → `{id: "ses_...", slug, ...}`
- `POST /session/{id}/message` — body `{parts:[{type:"text",text:"msg"}]}` → `{info: AssistantMessage, parts: Part[]}`
- `POST /session/{id}/abort` → `true`
- `GET /global/health` → `{healthy: true, version: "..."}`

The `AssistantMessage` (`info`) may contain an `error` field on model/provider failures (auth, rate-limit, content-filter). Text content is in `parts[]` where `type === "text"` and the `text` field.

## The Plan (start to finish — no analysis needed)

### Phase 1: Make `opencode serve` persistent (kill 9.4s startup)

**1.1 Modify `deploy/discord-agent/run.sh`**

Add a persistent serve process at the top, right after the shebang:

```bash
#!/bin/sh
# Supervisor for the Discord agent deployable.
# 1) Start persistent opencode serve (kills ~9.4s per-message startup tax).
# 2) Render agent/opencode.json from env (never bake secrets).
# 3) Start the Discord bridge + /health.
set -e
cd "$(dirname "$0")"

# Extend PATH so `opencode serve` is found (systemd unit sets PATH too, but
# double-defend for local/docker runs where PATH may differ).
export PATH="$HOME/.opencode/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Export the LLM provider key from .env to the shell so `opencode serve` (a
# subprocess) can reach the model. The Node bridge reads .env itself; the
# headless agent inherits only exported shell vars.
if [ -n "$OPENROUTER_API_KEY" ]; then
  : # already set in the environment; keep it
elif [ -f .env ] && grep -q '^OPENROUTER_API_KEY=' .env; then
  export OPENROUTER_API_KEY="$(grep '^OPENROUTER_API_KEY=' .env | head -1 | cut -d= -f2-)"
fi

# --- Start persistent opencode serve (replaces per-message spawning) ---
# ONE long-lived opencode process instead of spawning a new one per Discord
# message. Eliminates ~9.4s startup tax per message.
# The subshell `(cd agent && ...)` isolates the directory change so the parent
# run.sh stays in discord-agent/ for the Node bridge below.
export OPENCODE_SERVER_PASSWORD="${OPENCODE_SERVER_PASSWORD:-opencode-agent}"

if ! pgrep -f "opencode serve" > /dev/null 2>&1; then
  echo "[boot] starting persistent opencode serve on port 4096..."
  (cd agent && nohup opencode serve --port 4096 --hostname 127.0.0.1 \
    --log-level WARN > "$HOME/.opencode/serve.log" 2>&1 & echo $! > /tmp/opencode-serve.pid)
  # Wait for health check (up to 10s)
  for i in $(seq 1 20); do
    if curl -sf "http://127.0.0.1:4096/global/health" > /dev/null 2>&1; then
      echo "[boot] opencode serve is healthy (pid=$(cat /tmp/opencode-serve.pid))"
      break
    fi
    sleep 0.5
  done
fi
```

**1.2 Keep the existing Discord bridge start:**
```bash
echo "[boot] rendering agent config..."
node scripts/bootstrap.js

echo "[boot] starting Discord bridge + /health..."
node src/index.js
```

### Phase 2: Rewrite client.js to use the serve API (not spawn)

**2.1 Replace `src/agent/client.js`** with this rewritten file:

```js
import { log } from '../log.js';
import { track } from './ops.js';

const TIMEOUT_MS = 180000;      // keep existing 3-min hard limit
const CAPTURE_LIMIT = 8000;     // increased capture limit
let sessionId = null;           // persistent session ID (created lazily)

function bound(text, limit) {
  if (typeof text !== 'string') return '';
  return text.length <= limit ? text : text.slice(-limit);
}

/**
 * Create a persistent session on the opencode serve instance.
 * Called once (lazily on first runAgent call); reused for all subsequent messages.
 * Session IDs persist for the lifetime of the serve process.
 */
async function getOrCreateSession(serveUrl) {
  if (sessionId) return sessionId;
  const password = process.env.OPENCODE_SERVER_PASSWORD || 'opencode-agent';
  const resp = await fetch(`${serveUrl}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`opencode:${password}`),
    },
    body: JSON.stringify({ title: 'life-os-agent' }),
  });
  if (!resp.ok) throw new Error(`Failed to create session: ${resp.status}`);
  const data = await resp.json();
  sessionId = data.id; // e.g., "ses_abc123"
  log('info', 'session.created', { service: 'agent', sessionId });
  return sessionId;
}

/**
 * Send a message to the headless agent via the opencode serve HTTP API.
 *
 * Uses a persistent session — zero per-message startup overhead after the
 * first call. The serve API is synchronous HTTP/JSON (not SSE streaming):
 *
 *   POST  /session/{id}/message
 *   body: { parts: [{ type: "text", text: "<message>" }] }
 *   returns: { info: AssistantMessage, parts: Part[] }
 *
 * Text content lives in parts[] where type === "text" and .text holds the string.
 * Reasoning/thinking is a separate part type ("reasoning") and is NOT included
 * in the text output, so stripThinking() is no longer needed.
 * Tool calls appear as part.type === "tool" with .tool and .callID fields.
 * Model/provider errors surface in info.error.
 *
   * Timeout uses AbortController (aborts the fetch) plus a fallback POST to
   * /session/{id}/abort to clean up the server-side session state.
   *
   * If serve restarts mid-conversation, the cached session ID becomes stale
   * (404 from the message endpoint). The code detects this, wipes the cached
   * ID, creates a fresh session, and retries the message once.

   * @param {string} serveUrl - the headless agent's URL.
   * @param {string} message - the user's message (agent command or query).
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs] - override the default timeout (ms).
   * @param {string} [opts.channelId] - source Discord channel id (passthrough).
   * @returns {Promise<string>} the agent's reply text.
   */
export async function runAgent(serveUrl, message, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const ctx = { service: 'agent', channelId: opts.channelId, run: id };
  const t0 = Date.now();
  const tracker = track();

  const password = process.env.OPENCODE_SERVER_PASSWORD || 'opencode-agent';
  const auth = 'Basic ' + btoa(`opencode:${password}`);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': auth,
  };

  // 1. Ensure we have a persistent session
  try {
    await getOrCreateSession(serveUrl);
  } catch (e) {
    log('error', 'run.session-failed', ctx, 'Failed to get/create session', { err: e.message });
    throw new Error('Agent session unavailable. Try restarting the service.');
  }

  // 2. AbortController for timeout — aborts the fetch AND hits /abort endpoint
  const controller = new AbortController();
  const timer = setTimeout(async () => {
    controller.abort();
    try {
      await fetch(`${serveUrl}/session/${sessionId}/abort`, {
        method: 'POST',
        headers,
      }).catch(() => {});
      log('warn', 'run.abort', ctx, 'Session aborted due to timeout', { timeoutMs });
    } catch { /* session may already be gone */ }
  }, timeoutMs);

  // 3. Send message via API (NOT spawn) — synchronous JSON, single response
  let out = '';
  let result;
  try {
    log('info', 'run.start', ctx, 'Agent serve call started', {
      timeoutMs,
      sessionId,
      serveUrl,
      model: process.env.AGENT_MODEL || 'openrouter/deepseek/deepseek-v4-flash-0731',
    });

    // Retry once on 404: serve may have restarted and the cached session ID
    // is stale. We wipe it, create a fresh session, and retry the message.
    for (let attempt = 0; attempt < 2; attempt++) {
      const resp = await fetch(`${serveUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parts: [{ type: 'text', text: message }],
        }),
        signal: controller.signal,
      });

      if (resp.status === 404 && attempt === 0) {
        log('warn', 'run.session-stale', ctx, 'Session not found (serve restarted?), recreating', {
          oldSessionId: sessionId,
        });
        sessionId = null;
        await getOrCreateSession(serveUrl);
        continue;
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${bound(body, 500)}`);
      }

      result = await resp.json();
      break;
    }

    const info = result.info || {};

    // Check for model/provider errors surfaced by serve
    if (info.error) {
      const errMsg = info.error.message || JSON.stringify(info.error);
      log('error', 'run.model-error', ctx, 'Model returned an error', {
        error: errMsg,
        modelID: info.modelID,
        providerID: info.providerID,
      });
      throw new Error(`Model error: ${errMsg}`);
    }

    // Extract text from parts[].text where part.type === "text"
    // Reasoning parts (type === "reasoning") are skipped — they are thinking
    // blocks not intended for the Discord user.
    // Tool parts (type === "tool") are tracked for ops accounting but not shown.
    const parts = result.parts || [];
    for (const part of parts) {
      if (part.type === 'text' && part.text) {
        out += part.text;
        tracker.add(part.text, ctx);
      }
      if (part.type === 'tool') {
        tracker.add(JSON.stringify({ tool: part.tool, callID: part.callID }), ctx);
      }
    }

    const durationMs = Date.now() - t0;
    log('info', 'run.done', ctx, 'Agent run completed', {
      exitCode: 0,
      durationMs,
      outBytes: out.length,
      webfetch: tracker.counters(),
      ops: tracker.summary(),
      sessionId,
      modelID: info.modelID,
      providerID: info.providerID,
      finish: info.finish,
      cost: info.cost,
      tokens: info.tokens,
      outcome: out ? 'success' : 'empty',
    });

    if (out) return out;
    return '';
  } catch (e) {
    if (e.name === 'AbortError') {
      log('warn', 'run.timeout', ctx, 'Agent run timed out', {
        timeoutMs,
        durationMs: Date.now() - t0,
        outBytes: out.length,
        webfetch: tracker.counters(),
        ops: tracker.summary(),
      });
      throw new Error('The agent took too long. It may be offline or Jira is unreachable — try again.');
    }
    log('error', 'run.error', ctx, 'Agent call failed', {
      err: e.message,
      durationMs: Date.now() - t0,
      outBytes: out.length,
    });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
```

**2.2 `src/bridge/client.js`** — No changes needed. The existing call `runAgent(cfg.serveUrl, payload)` at line 110 is already compatible with the new `runAgent(serveUrl, message, opts)` signature (opts is optional, defaults apply).

**2.3 Add `.env.example` entry**:

```env
# Opencode serve auth (used by persistent server mode)
OPENCODE_SERVER_PASSWORD=opencode-agent
```

**2.4 `src/config.js`** — Already exports `serveUrl` at line 39:
```js
serveUrl: env.OPENCODE_SERVE_URL || 'http://127.0.0.1:4096',
```
No changes needed.

**2.5 `deploy/discord-agent/agent/opencode.json`** — Keep as-is. The `bootstrap.js` script renders `opencode.json` from the `.env.template` at boot, so the committed `opencode.json` is a legacy copy (see `src/agent/client.js:8-10` comment). Serve mode reads this same file from the `agent/` directory at startup — no changes needed.

### Phase 3: systemd unit (no changes needed)

The systemd unit in `setup-app-remote.sh` (lines 43-63) already calls `run.sh` via `ExecStart=$APP_DIR/run.sh`. Since `run.sh` now starts `opencode serve` before the Discord bridge (Phase 1.1), **no systemd unit changes are required**. The unit already provides:

- `EnvironmentFile=$APP_DIR/.env` — so `OPENCODE_SERVER_PASSWORD` flows through to `run.sh`
- `Environment=OPENCODE_SERVE_URL=http://127.0.0.1:4096` — consumed by `config.js`
- `Environment=PATH=...` — `run.sh` extends this with `$HOME/.opencode/bin` at the top

The plan's original Phase 3 (inlining serve into `ExecStart`) conflicts with Phase 1.1 and would double-start serve. Skip it.

### Phase 4: Working directory (handled by run.sh, not systemd)

The `opencode serve` process needs to run in the `agent/` directory (where `opencode.json` lives). **Do not** change `WorkingDirectory` in the systemd unit — that would break the Discord bridge which runs from the parent `discord-agent/` dir.

Instead, `run.sh` starts serve inside a subshell with `cd agent` so the bridge's cwd remains correct:
```sh
(cd agent && nohup opencode serve --port 4096 --hostname 127.0.0.1 --log-level WARN \
  > "$HOME/.opencode/serve.log" 2>&1 &)
```
The `(...)` subshell isolates the directory change so the parent `run.sh` stays in `discord-agent/`.

### Phase 5: Test locally before deploying

**5.1 On local machine (or in Docker):**

```bash
# Start serve in the agent dir
cd deploy/discord-agent/agent
export OPENCODE_SERVER_PASSWORD=test123
opencode serve --port 4096 &
sleep 5

# Test health
curl -su "opencode:test123" http://127.0.0.1:4096/global/health
# → {"healthy":true,"version":"1.18.11"}

# Test session creation
curl -su "opencode:test123" -X POST http://127.0.0.1:4096/session \
  -H 'Content-Type: application/json' -d '{"title":"test"}'
# → {"id":"ses_xxx", ...}

# Test message send (use the session ID from above)
# NOTE: the request body uses {parts:[{type:"text",text:"..."}]}, NOT {message:"..."}
curl -su "opencode:test123" -X POST http://127.0.0.1:4096/session/ses_XXX/message \
  -H 'Content-Type: application/json' -d '{"parts":[{"type":"text","text":"what is 2+2"}]}'
# → {"info":{...}, "parts":[{"type":"text","text":"4",...}, ...]}
```

**5.2 Expected result:** Response in ~1-2s instead of ~9.4s startup + 1-2s response = 12s+ currently. The 9.4s startup tax is eliminated because `opencode serve` stays resident after the first call.

### Phase 6: Deploy

**Local Docker testing (MacBook):**

```bash
cd deploy/discord-agent
# Build uses the serve mode Dockerfile
docker build -f Dockerfile.serve -t discord-agent-serve --secret id=env,src=.env .
# Run (needs .env with Discord token, Jira keys, OpenRouter key, OPENCODE_SERVER_PASSWORD)
docker run -it --env-file .env -p 3000:3000 discord-agent-serve
```

**EC2 deployment:**

```bash
cd /Users/macbook/Documents/Prac/life-os-project
./deploy/ec2-single-box/deploy.sh
```

This will rsync the updated code and restart the service. The systemd unit calls `run.sh`, which now starts `opencode serve` before the Discord bridge.

### Phase 7: Verify

1. Check the service starts without errors:
   ```bash
   ssh -i deploy/ec2-single-box/lifeos-box.pem ubuntu@15.252.6.196 \
     'systemctl status discord-agent && journalctl -u discord-agent -n 30'
   ```

2. Send a Discord message and time it:
   - Before: ~36s for "today" query
   - Expected after: ~27s (startup eliminated)

3. Verify the persistent session is reused:
   ```bash
   ssh -i deploy/ec2-single-box/lifeos-box.pem ubuntu@15.252.6.196 \
     'journalctl -u discord-agent -f'
   ```
   Look for `session.created` once at startup, then `run.start`/`run.done` with `sessionId` in all subsequent entries.

4. Verify session-stale recovery:
   ```bash
   # Kill serve, then send a Discord message
   ssh -i deploy/ec2-single-box/lifeos-box.pem ubuntu@15.252.6.196 \
     'pkill -f "opencode serve"'
   # Wait 5s, then send a message in Discord
   # Expected: run.sh's pgrep detects no serve → restarts it → runAgent gets
   # 404 → wipes cached sessionId → creates new session → succeeds
   ```
   Look for `run.session-stale` log entry, then `session.created` (new session), then `run.done` with a different `sessionId`.

### Phase 7.1: Manual QA scenarios

| # | Scenario | Expected result |
|---|---|---|
| 1 | **Serve boots** | `[boot] opencode serve is healthy` in logs |
| 2 | **Session created once** | `session.created` logged once, all subsequent `run.start`/`run.done` reuse same `sessionId` |
| 3 | **Startup tax eliminated** | First message ~9.4s+model; subsequent: model-time only |
| 4 | **Simple query** | "what is 2+2" → "4" |
| 5 | **Skills still work** | "today" → daily/Todo-Week assessment (skills resolved from `agent/` dir) |
| 6 | **Jira MCP tools** | Create/list Jira issue → tool call in ops log |
| 7 | **Timeout/abort** | Long query >180s → `run.timeout` logged, friendly error reply |
| 8 | **Model error surfaces** | Bad API key → `run.model-error` logged, friendly "Model error" reply |
| 9 | **Voice → text → text** | Voice note transcribed, then 2 text messages, all in order, single session |
| 10 | **Multi-channel FIFO** | Messages in 2 channels → processed one at a time in arrival order |
| 11 | **Serve crash recovery** | Kill serve mid-conversation → `run.session-stale` → new session → succeeds |
| 12 | **Container restart** | Full restart → `session.created` logged fresh, all functionality works |

### Phase 8: Rollback plan

If the serve mode doesn't work:
1. Revert `client.js` to use `spawn()` — git stash the change or restore from git
2. Revert `run.sh` — comment out the serve start block (remove the `pgrep`/`nohup opencode serve` block)
3. No systemd unit change to revert (Phase 3 was skipped — systemd already called `run.sh`)
4. Restart service

### Notes for the executing agent

- The `opencode serve` API uses HTTP Basic Auth with username `opencode` and password from `OPENCODE_SERVER_PASSWORD`
- Session IDs persist for the lifetime of the serve process — reused across all messages. If serve restarts, 404 from the message endpoint triggers session recovery (wipe + recreate + retry)
- The `/session/{sessionID}/message` endpoint is **synchronous** (returns complete JSON response, not SSE streaming). The response is `{info: {...}, parts: [...]}`. Extract text from `parts[].text` where `part.type === "text"`. Reasoning/thinking is a separate `part.type === "reasoning"` part — no `stripThinking()` needed.
- Timeout: `runAgent` uses `AbortController` to abort the `fetch`, plus a fallback `POST /session/{id}/abort` to clean up server-side state
- Model/provider errors surface in `response.info.error` — checked before reading parts
- If the serve process dies, the `fetch` fails (ECONNREFUSED) and the Discord bridge catches it with the existing `catch` block in `bridge/client.js:runTurn`
- The serve process writes logs to `~/.opencode/serve.log`
- **Memory consideration**: The persistent process stays at ~200MB RSS (same as spawning one process). This is BETTER than spawning fresh processes because there's no per-process overhead.
- **No real-time streaming to Discord**: Unlike the spawn-based approach (which streamed stdout chunks), the serve API returns the complete response. The Discord bot still shows "Wondering..." status while waiting — same UX, just no intermediate chunk logging.
- **Known limitation**: If the model requests a permission (e.g., filesystem write, command execution), the serve API may require an interactive reply via `POST /session/{id}/permissions/{requestID}`. The current implementation does not handle auto-replying to permissions. Most agent queries (today, what is 2+2, Jira operations) don't trigger permissions, but file-editing commands may. Monitor `run.stall` logs for hangs.

### Expected outcome

| Metric | Before | After |
|--------|--------|-------|
| Startup per message | 9.4s | ~0s |
| "Today" query | ~36s | ~27s |
| Web research (38s) | ~38s | ~29s |
| Process overhead | 1 spawn per message | 0 spawns after boot |
| Memory usage | ~200MB per spawn (GC'd after) | ~200MB steady state |
