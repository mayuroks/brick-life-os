import { log } from '../log.js';

const OP_RE = /\b(model|jira|tool)\b/i;
const DUR_RE = /(?:duration|took|elapsed|in)[^\d]*(\d+(?:\.\d+)?)\s*(ms|s|m)?/i;
const STATUS_RE = /\b(success|ok|done|failed|error|fail|cancelled|canceled|error)\b/i;

const MAX_DURATION_MS = 180000;

export function parseOp(text) {
  if (typeof text !== 'string') return null;
  if (!OP_RE.test(text)) return null;
  const durMatch = DUR_RE.exec(text);
  if (!durMatch) return null;
  const raw = Number(durMatch[1]);
  if (!Number.isFinite(raw) || raw <= 0 || raw > MAX_DURATION_MS) return null;
  const unit = (durMatch[2] || 'ms').toLowerCase();
  const durationMs = unit === 's' ? raw * 1000 : unit === 'm' ? raw * 60000 : raw;
  if (durationMs > MAX_DURATION_MS) return null;
  const statusMatch = STATUS_RE.exec(text);
  let status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
  if (status === 'ok' || status === 'done') status = 'success';
  if (status === 'fail') status = 'failed';
  const opMatch = OP_RE.exec(text);
  return { op: opMatch ? opMatch[1].toLowerCase() : 'unknown', durationMs, status };
}

export function track() {
  const ops = [];
  const counters = { model: 0, webfetch: 0, webfetchFail: 0, tools: {} };
  let tokenInfo = null;
  return {
    add(text, ctx = {}) {
      const rec = parseOp(text);
      if (rec) {
        ops.push(rec);
        if (rec.op === 'model') counters.model += 1;
        log('info', 'run.op', ctx, 'Operation completed', rec);
      }
      if (/WebFetch/.test(text || '')) {
        counters.webfetch += 1;
        if (/(failed|Error|non 2xx|Transport error)/i.test(text)) counters.webfetchFail += 1;
      }
      return rec;
    },
    toolCall(name) {
      if (!name) return;
      counters.tools[name] = (counters.tools[name] || 0) + 1;
      if (name === 'WebFetch') counters.webfetch += 1;
      log('info', 'run.tool', {}, 'Tool call', { tool: name });
    },
    setTokens(tokens) {
      if (tokens) tokenInfo = { ...tokens };
    },
    counters() {
      return { ...counters, tokens: tokenInfo };
    },
    summary() {
      return ops.slice();
    },
  };
}
