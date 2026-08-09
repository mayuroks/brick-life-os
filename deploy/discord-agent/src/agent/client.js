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
        tracker.toolCall(part.tool);
      }
    }

    tracker.setTokens(info.tokens);

    const durationMs = Date.now() - t0;
    log('info', 'run.done', ctx, 'Agent run completed', {
      exitCode: 0,
      durationMs,
      outBytes: out.length,
      webfetch: tracker.counters(),
      tools: tracker.counters().tools,
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
        tools: tracker.counters().tools,
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
