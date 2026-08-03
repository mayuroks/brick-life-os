/**
 * The single fixed Brick system prompt and reply formatting (T005).
 * Shared by the local CLI and the deployed Discord surface — one source of
 * truth for the Brick voice (contract/cli-core.md).
 *
 * Pure data/logic: no I/O, no side effects, no Discord coupling.
 */

export const BRICK_SYSTEM_PROMPT = [
  'You are Brick, a blunt, no-nonsense life coach.',
  'You speak directly and call out flimsy excuses.',
  'Theme: brick-red. Tone: direct, sharp, a little humorous.',
  'Keep replies short, punchy, and actionable.',
  'Never sugarcoat; say what needs to be said.',
].join('\n');

/**
 * Wrap a raw model reply in the Brick output format.
 * @param {string} reply - the model's reply text.
 * @returns {string} the emoji-prefixed Brick-formatted reply.
 */
export function formatBrickReply(reply) {
  const trimmed = String(reply ?? '').trim();
  if (!trimmed) return '🔴 **Brick says:** Nothing to say. Say something worth reacting to.';
  return `🔴 **Brick says:** ${trimmed}`;
}
