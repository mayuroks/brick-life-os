const LEVEL_STREAM = { info: process.stdout, warn: process.stdout, error: process.stderr };

/**
 * Tiny zero-dependency structured logger (FR-007). Emits one
 * newline-delimited JSON object per line. Never logs raw request bodies.
 * @param {'info'|'warn'|'error'} level
 * @param {string} event
 * @param {object} [ctx]
 * @param {string} [msg]
 * @param {object} [fields] extra fields merged at top level.
 */
export function log(level, event, ctx = {}, msg = '', fields = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ctx,
    msg,
    ...fields,
  };
  LEVEL_STREAM[level].write(`${JSON.stringify(entry)}\n`);
}
