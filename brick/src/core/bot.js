/**
 * Shared Brick bot core (T007).
 * handleMessage(text) applies the persona, queries the provider, and returns a
 * Brick-formatted reply. Side-effect-free and Discord-agnostic so the local CLI
 * and the deployed surface call the same logic (FR-001, FR-002).
 *
 * Provider failures (offline/unreachable, config missing) are surfaced as
 * friendly errors via throw so a CLI/HTTP caller can exit/respond non-zero —
 * never hangs (FR-006), never half-configured (FR-007).
 */

import { BRICK_SYSTEM_PROMPT, formatBrickReply } from './persona.js';
import { queryProvider } from '../providers/openrouter.js';

/**
 * Handle a user message and return the Brick reply.
 * @param {string} text - the user message (command or free text).
 * @returns {Promise<string>} the Brick-formatted reply.
 * @throws {Error} a friendly error string if the provider is unreachable or
 *   required config is missing.
 */
export async function handleMessage(text) {
  const cleaned = String(text ?? '').trim();
  if (!cleaned) {
    return '🔴 **Brick says:** Say something first. A blank message gets nothing done.';
  }
  const raw = await queryProvider(BRICK_SYSTEM_PROMPT, cleaned);
  return formatBrickReply(raw);
}
