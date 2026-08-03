import 'dotenv/config';

const DEFAULTS = Object.freeze({
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  BRICK_MODEL: 'openai/gpt-4o-mini',
});

/**
 * Resolve and validate the runtime configuration from the environment.
 * Fails fast at boot if required secrets are missing (FR-005, FR-007).
 * No key/model/url is hardcoded — only documented defaults are applied.
 *
 * @returns {{ apiKey: string, baseUrl: string, model: string }}
 * @throws {Error} with the exact next steps when OPENROUTER_API_KEY is missing.
 */
export function loadConfig(env = process.env) {
  const apiKey = env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      [
        'Missing required secret: OPENROUTER_API_KEY',
        '',
        'To fix:',
        '  1. Copy .env.example to .env',
        '  2. Fill in OPENROUTER_API_KEY with your key',
        '     (optional: OPENROUTER_BASE_URL, BRICK_MODEL)',
        '  3. Re-run the command',
      ].join('\n'),
    );
  }

  return {
    apiKey,
    baseUrl: env.OPENROUTER_BASE_URL || DEFAULTS.OPENROUTER_BASE_URL,
    model: env.BRICK_MODEL || DEFAULTS.BRICK_MODEL,
    discordPublicKey: env.DISCORD_PUBLIC_KEY || '',
  };
}
