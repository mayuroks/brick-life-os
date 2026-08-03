/**
 * Discord interaction signature verification (FR-001).
 *
 * Verifies the Ed25519 signature over `<timestamp><rawBody>` using the
 * application's PUBLIC key from the Discord Developer Portal. Uses Node's
 * built-in crypto (no extra deps) by wrapping the raw 32-byte hex public key
 * into an Ed25519 JWK.
 */

import { createPublicKey, verify as ed25519Verify } from 'node:crypto';

const MAX_TIMESTAMP_AGE_SECONDS = 300;

function publicKeyObject(publicKeyHex) {
  const raw = Buffer.from(publicKeyHex, 'hex');
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: raw.toString('base64url'),
  };
  return createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * Verify a Discord interaction request.
 * @param {string} publicKeyHex - Discord application public key (hex).
 * @param {string} rawBody - the RAW request body string (exact bytes).
 * @param {string} signatureHex - the `x-signature-ed25519` header value.
 * @param {string} timestamp - the `x-signature-timestamp` header value.
 * @returns {{valid: boolean, reason?: string}}
 */
export function verifyDiscordSignature(publicKeyHex, rawBody, signatureHex, timestamp) {
  if (!publicKeyHex || !signatureHex || !timestamp) {
    return { valid: false, reason: 'Missing signature headers or public key' };
  }
  if (!/^\d+$/.test(timestamp)) {
    return { valid: false, reason: 'Invalid signature timestamp' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (Math.abs(nowSeconds - ts) > MAX_TIMESTAMP_AGE_SECONDS) {
    return { valid: false, reason: 'Stale signature timestamp (possible replay)' };
  }

  try {
    const message = Buffer.from(timestamp + rawBody, 'utf8');
    const signature = Buffer.from(signatureHex, 'hex');
    const key = publicKeyObject(publicKeyHex);
    const ok = ed25519Verify(null, message, key, signature);
    return ok ? { valid: true } : { valid: false, reason: 'Signature does not match' };
  } catch {
    return { valid: false, reason: 'Signature verification error' };
  }
}
