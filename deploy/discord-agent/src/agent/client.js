import { spawn } from 'node:child_process';

const TIMEOUT_MS = 180000;

/**
 * Send a message to the headless agent (`opencode serve`) via
 * `opencode run --attach <serveUrl>` and return its reply (FR-002).
 * Failure (provider/Jira unreachable, timeout) rejects with a friendly message.
 *
 * @param {string} serveUrl - the headless agent's URL.
 * @param {string} message - the user's message (agent command or query).
 * @returns {Promise<string>} the agent's reply text.
 */
export function runAgent(serveUrl, message) {
  return new Promise((resolve, reject) => {
    const child = spawn('opencode', ['run', '--attach', serveUrl, message], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('The agent took too long. It may be offline or Jira is unreachable — try again.'));
    }, TIMEOUT_MS);

    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`Can't reach the agent: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.trim();
      if (code === 0 && text) return resolve(text);
      reject(new Error(err.trim() || 'The agent failed to produce a reply.'));
    });
  });
}
