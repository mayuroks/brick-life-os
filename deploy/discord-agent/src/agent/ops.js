import { log } from '../log.js';

const OP_RE = /\b(model|jira|tool)\b/i;
const DUR_RE = /(?:duration|took|elapsed|in)[^\d]*(\d+(?:\.\d+)?)\s*(ms|s|m)?/i;
const STATUS_RE = /\b(success|ok|done|failed|error|fail|cancelled|canceled|error)\b/i;

export function parseOp(text) {
  if (typeof text !== 'string') return null;
  if (!OP_RE.test(text)) return null;
  const durMatch = DUR_RE.exec(text);
  if (!durMatch) return null;
  const raw = Number(durMatch[1]);
  if (!Number.isFinite(raw)) return null;
  const unit = (durMatch[2] || 'ms').toLowerCase();
  const durationMs = unit === 's' ? raw * 1000 : unit === 'm' ? raw * 60000 : raw;
  const statusMatch = STATUS_RE.exec(text);
  let status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';
  if (status === 'ok' || status === 'done') status = 'success';
  if (status === 'fail') status = 'failed';
  const opMatch = OP_RE.exec(text);
  return { op: opMatch ? opMatch[1].toLowerCase() : 'unknown', durationMs, status };
}

export function track() {
  const ops = [];
  return {
    add(text, ctx = {}) {
      const rec = parseOp(text);
      if (!rec) return;
      ops.push(rec);
      log('info', 'run.op', ctx, 'Operation completed', rec);
      return rec;
    },
    summary() {
      return ops.slice();
    },
  };
}
