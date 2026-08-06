import { GROQ_TRANSCRIBE_URL, GROQ_TRANSCRIBE_MODEL, requireGroqKey } from '../config.js';
import { log } from '../log.js';

/**
 * Transcribe a Discord voice note by passing its CDN URL straight to Groq's
 * STT API (URL pass-through). No audio bytes are ever written to disk or
 * buffered in the host process — only the URL string and the returned text
 * transit the bridge (SC-001/SC-005).
 *
 * @param {string} url - the signed Discord CDN attachment URL.
 * @returns {Promise<{status:'success'|'empty'|'error', text:string}>}
 *          Categorized outcome: 2xx + non-blank text → success; 2xx + blank →
 *          empty; non-2xx / network error / missing key → error (FR-007).
 */
export async function transcribe(url) {
  let apiKey;
  try {
    apiKey = requireGroqKey();
  } catch (err) {
    log('error', 'voice.groq-key-missing', {}, err.message);
    return { status: 'error', text: '' };
  }

  // Groq's transcription endpoint is OpenAI-compatible: the request body must
  // be multipart/form-data (a `file` or `url` field plus `model`). A plain JSON
  // body is rejected with HTTP 400 "Content-Type isn't multipart/form-data".
  // Let fetch set the multipart boundary automatically (do NOT set
  // Content-Type manually, or the boundary is lost and Groq 400s).
  const form = new FormData();
  form.append('model', GROQ_TRANSCRIBE_MODEL);
  form.append('url', url);

  let res;
  try {
    res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });
  } catch (err) {
    log('error', 'voice.groq-network', {}, `Groq transcription network error: ${err?.message}`);
    return { status: 'error', text: '' };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log('warn', 'voice.groq-http', { status: res.status }, `Groq transcription HTTP ${res.status}: ${body}`);
    return { status: 'error', text: '' };
  }

  const data = await res.json().catch(() => ({}));
  const text = String(data?.text || '').trim();
  if (text) return { status: 'success', text };
  log('info', 'voice.groq-empty', {}, 'Groq returned an empty transcript (silence/no speech)');
  return { status: 'empty', text: '' };
}
