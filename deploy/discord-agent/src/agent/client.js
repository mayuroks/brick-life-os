import { log } from '../log.js';
import { track } from './ops.js';

const TIMEOUT_MS = 180000;      // 3-min hard limit per message
const CAPTURE_LIMIT = 8000;     // increased capture limit

function bound(text, limit) {
  if (typeof text !== 'string') return '';
  return text.length <= limit ? text : text.slice(-limit);
}

/**
 * Create a fresh session on the opencode serve instance.
 * Called once per runAgent invocation — no module-level state, no accumulation.
 */
async function createSession(serveUrl) {
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
  log('info', 'session.created', { service: 'agent', sessionId: data.id });
  return data.id;
}

/**
 * Delete a session from the opencode serve instance, freeing the conversation
 * context and associated server-side memory.
 *
 * The serve API uses HTTP DELETE on /session/{id}. Best-effort: never throws.
 */
async function deleteSession(serveUrl, id, headers) {
  if (!id) return;
  try {
    await fetch(`${serveUrl}/session/${id}`, {
      method: 'DELETE',
      headers,
    });
    log('info', 'session.deleted', { service: 'agent', sessionId: id }, 'Session deleted');
  } catch (e) {
    log('warn', 'session.delete-failed', { service: 'agent', sessionId: id }, `Delete failed: ${e.message}`);
  }
}

/**
 * Send a message to the headless agent via the opencode serve HTTP API.
 *
 * One fresh session per call — no context accumulation, no rotation, no retry.
 * The serve process stays resident (startup tax eliminated by commit 3148382);
 * only sessions are created per-message, which is a lightweight HTTP POST.
 *
 * API format (synchronous JSON, not SSE streaming):
 *   POST  /session                 → { id }
 *   POST  /session/{id}/message    → { info: AssistantMessage, parts: Part[] }
 *   DELETE /session/{id}           → true
 *
 * Text content lives in parts[] where type === "text" and .text holds the string.
 * Reasoning parts (type === "reasoning") are skipped.
 * Tool calls (type === "tool") are tracked for ops accounting.
 * Model/provider errors surface in info.error.
 *
 * Timeout uses AbortController (aborts the fetch) plus a fallback POST to
 * /session/{id}/abort to clean up server-side state.
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

  // 1. Create a fresh session (no reuse, no accumulation)
  let sessionId;
  try {
    sessionId = await createSession(serveUrl);
  } catch (e) {
    log('error', 'run.session-failed', ctx, 'Failed to create session', { err: e.message });
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

  let out = '';
  try {
    log('info', 'run.start', ctx, 'Agent serve call started', {
      timeoutMs,
      sessionId,
      serveUrl,
      model: process.env.AGENT_MODEL || 'openrouter/deepseek/deepseek-v4-flash-0731',
    });

    // 3. Send message
    const resp = await fetch(`${serveUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parts: [{ type: 'text', text: message }],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${bound(body, 500)}`);
    }

    const result = await resp.json();
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
      sessionId,
    });
    throw e;
  } finally {
    clearTimeout(timer);
    // Always clean up: delete the session so its context memory is freed.
    await deleteSession(serveUrl, sessionId, headers).catch(() => {});
  }
}
