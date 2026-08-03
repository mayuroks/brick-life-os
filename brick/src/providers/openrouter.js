/**
 * OpenRouter provider client (T006).
 * Reads connection params from config.js — no hardcoded key/url/model (FR-005).
 * On unreachable/offline returns a clear one-line friendly error, never hangs (FR-006).
 */

import { loadConfig } from '../config.js';

/**
 * Query the AI provider and return the raw reply text.
 * @param {string} systemPrompt - the persona system prompt.
 * @param {string} userText - the user message.
 * @returns {Promise<string>} the raw model reply text.
 * @throws {Error} a friendly one-line message when the provider is unreachable.
 */
export async function queryProvider(systemPrompt, userText) {
  const { apiKey, baseUrl, model } = loadConfig();

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
      }),
    });
  } catch (err) {
    throw new Error("Can't reach the model — check your network connection and try again.");
  }

  if (!res.ok) {
    throw new Error("Can't reach the model right now. Check your key and network, then try again.");
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  return String(reply ?? '').trim();
}
