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
    groqApiKey: env.GROQ_API_KEY || '',
    groqTranscribeUrl: GROQ_TRANSCRIBE_URL,
    groqModel: GROQ_TRANSCRIBE_MODEL,
  };
}

/**
 * Groq STT transcription endpoint and model. Kept as exported constants so the
 * transcription client stays decoupled from hardcoded strings.
 */
export const GROQ_TRANSCRIBE_URL =
  'https://api.groq.com/openai/v1/audio/transcriptions';
export const GROQ_TRANSCRIBE_MODEL = 'whisper-large-v3-turbo';

/**
 * Lazy GROQ_API_KEY validation (design.md Open Questions: lazy is default).
 * Unlike the boot-time required secrets, the key is only demanded when a voice
 * note actually needs transcribing, so the bot boots fine for pure-text use
 * (FR-007). Throws with clear next steps if missing.
 * @returns {string} the API key.
 */
export function requireGroqKey(env = process.env) {
  if (!env.GROQ_API_KEY) {
    throw new Error(
      [
        'Missing GROQ_API_KEY (needed to transcribe voice notes)',
        '',
        'To fix:',
        '  1. Add GROQ_API_KEY= to .env',
        '  2. Respect it by using the key from your Groq console',
        '  3. Re-run the bot, then send the voice note again',
      ].join('\n'),
    );
  }
  return env.GROQ_API_KEY;
}
