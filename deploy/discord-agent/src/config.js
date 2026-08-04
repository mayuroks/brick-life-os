import 'dotenv/config';

/**
 * Resolve and validate runtime configuration from the environment.
 * Fails fast at boot if required secrets are missing (FR-007).
 * No secret is hardcoded; all values come from env (FR-007).
 *
 * @returns {{token:string, jiraUrl:string, jiraUsername:string, jiraToken:string, serveUrl:string, port:number}}
 * @throws {Error} with the exact next steps when required secrets are missing.
 */
export function loadConfig(env = process.env) {
  const missing = [];
  if (!env.DISCORD_BOT_TOKEN) missing.push('DISCORD_BOT_TOKEN');
  if (!env.JIRA_URL) missing.push('JIRA_URL');
  if (!env.JIRA_USERNAME) missing.push('JIRA_USERNAME');
  if (!env.JIRA_API_TOKEN) missing.push('JIRA_API_TOKEN');
  const hasProvider =
    env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
  if (!hasProvider) missing.push('an LLM provider key (ANTHROPIC_API_KEY / OPENROUTER_API_KEY)');

  if (missing.length) {
    throw new Error(
      [
        `Missing required secret(s): ${missing.join(', ')}`,
        '',
        'To fix:',
        '  1. Copy .env.example to .env',
        '  2. Fill in the missing value(s)',
        '  3. Re-run',
      ].join('\n'),
    );
  }

  return {
    token: env.DISCORD_BOT_TOKEN,
    jiraUrl: env.JIRA_URL,
    jiraUsername: env.JIRA_USERNAME,
    jiraToken: env.JIRA_API_TOKEN,
    serveUrl: env.OPENCODE_SERVE_URL || 'http://127.0.0.1:4096',
    port: Number(env.PORT || 3000),
  };
}
