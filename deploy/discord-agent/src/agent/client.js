import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../log.js';
import { track } from './ops.js';

// Run from the bundled agent dir so opencode loads its opencode.json (model +
// provider) and AGENTS.md (persona + skills). The persistent opencode serve
// worker returns empty replies for this model/opencode build (see plan.md), so
// we drive a fresh `opencode run` per message instead of `--attach`.
const AGENT_DIR = path.resolve(fileURLToPath(new URL('../../agent', import.meta.url)));

const TIMEOUT_MS = 180000;
const CHUNK_LIMIT = 2000;
const CAPTURE_LIMIT = 4000;
let runCounter = 0;

function shortHex(n = 6) {
  let s = '';
  while (s.length < n) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function bound(text, limit) {
  if (typeof text !== 'string') return '';
  if (text.length <= limit) return text;
  return text.slice(-limit);
}

/**
 * Send a message to the headless agent (`opencode serve`) via
 * `opencode run --attach <serveUrl>` and return its reply (FR-002).
 * Failure (provider/Jira unreachable, timeout) rejects with a friendly message.
 *
 * @param {string} serveUrl - the headless agent's URL.
 * @param {string} message - the user's message (agent command or query).
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] - override the default timeout (ms).
 * @param {string} [opts.channelId] - source Discord channel id (passthrough).
 * @returns {Promise<string>} the agent's reply text.
 */
export function runAgent(serveUrl, message, opts = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
    const id = `${Date.now().toString(36)}-${shortHex(4)}-${++runCounter}`;
    const ctx = { service: 'agent', channelId: opts.channelId, run: id };
    const t0 = Date.now();
    const tracker = track();

    // --dir is required: opencode ignores spawn()'s cwd for project/config
    // discovery (it defaults to the invoking process's dir), so without this it
    // ran in the wrong dir and fell back to a default model. --dir pins it to
    // the bundled agent dir that holds opencode.json + AGENTS.md.
    // --print-logs + --log-level DEBUG + --thinking make the run verbose so a
    // silent hang is diagnosable in CloudWatch (network calls, model stream,
    // thinking blocks). We log these preconditions at spawn so a stuck run is
    // distinguishable from a broken one.
    const env = {
      ...process.env,
      // Force debug logging through stderr regardless of TTY.
      ...(process.env.OPENCODE_LOG_LEVEL ? {} : { OPENCODE_LOG_LEVEL: 'DEBUG' }),
    };
    const child = spawn(
      'opencode',
      ['run', '--dir', AGENT_DIR, '--print-logs', '--log-level', 'DEBUG', '--thinking', message],
      {
        cwd: AGENT_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      },
    );
    log('info', 'run.start', ctx, 'Agent run started', {
      timeoutMs,
      pid: child.pid,
      opencodeVersion: process.env.OPENCODE_VERSION || 'unknown',
      providerKey: env.OPENROUTER_API_KEY ? 'set' : 'missing',
      model: env.AGENT_MODEL || 'openrouter/deepseek/deepseek-v4-flash-0731',
    });
    let out = '';
    let err = '';
    const state = { settled: false };

    // Heartbeat: if the agent produces no output for a while, say so loudly
    // instead of silently waiting out the full timeout.
    let lastActivity = Date.now();
    const hbTimer = setInterval(() => {
      if (state.settled) return;
      const quietFor = Date.now() - lastActivity;
      if (quietFor >= 30000) {
        log('warn', 'run.stall', ctx, 'No agent output for 30s+', {
          quietMs: quietFor,
          elapsedMs: Date.now() - t0,
          outBytes: out.length,
          errBytes: err.length,
        });
      }
    }, 15000);

    const finish = (fn) => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      clearInterval(hbTimer);
      fn();
    };

    const onData = (stream) => (d) => {
      lastActivity = Date.now();
      const chunk = d.toString();
      if (stream === 'stdout') out += chunk;
      else err += chunk;
      out = bound(out, CAPTURE_LIMIT);
      err = bound(err, CAPTURE_LIMIT);
      log('info', 'run.chunk', ctx, 'Agent output chunk', {
        stream,
        durationMs: Date.now() - t0,
        text: bound(chunk, CHUNK_LIMIT),
      });
      tracker.add(chunk, ctx);
    };
    child.stdout.on('data', onData('stdout'));
    child.stderr.on('data', onData('stderr'));

    const timer = setTimeout(() => {
      const fields = {
        timeoutMs: timeoutMs,
        durationMs: Date.now() - t0,
        capturedOut: bound(out, CAPTURE_LIMIT),
        capturedErr: bound(err, CAPTURE_LIMIT),
        ops: tracker.summary(),
      };
      log('warn', 'run.timeout', ctx, 'Agent run timed out', fields);
      child.kill('SIGKILL');
      finish(() =>
        reject(new Error('The agent took too long. It may be offline or Jira is unreachable — try again.')),
      );
    }, timeoutMs);

    child.on('error', (e) => {
      if (state.settled) return;
      const fields = {
        reason: e.message,
        durationMs: Date.now() - t0,
        ops: tracker.summary(),
      };
      log('error', 'run.failed', ctx, 'Agent spawn failed', fields);
      finish(() => reject(new Error(`Can't reach the agent: ${e.message}`)));
    });

    child.on('close', (code) => {
      if (state.settled) return;
      const text = out.trim();
      const errText = err.trim();
      const fields = {
        exitCode: code,
        durationMs: Date.now() - t0,
        outBytes: out.length,
        errBytes: err.length,
        ops: tracker.summary(),
      };
      if (code === 0 && text) {
        fields.outcome = 'success';
        log('info', 'run.done', ctx, 'Agent run completed', fields);
        return finish(() => resolve(text));
      }
      if (code === 0) {
        fields.outcome = 'empty';
        log('info', 'run.done', ctx, 'Agent run completed with no output', fields);
        return finish(() => resolve(''));
      }
      fields.outcome = 'failed';
      fields.reason = bound(errText || 'The agent failed to produce a reply.', CHUNK_LIMIT);
      log('error', 'run.failed', ctx, 'Agent run failed', fields);
      finish(() => reject(new Error(errText || 'The agent failed to produce a reply.')));
    });
  });
}
