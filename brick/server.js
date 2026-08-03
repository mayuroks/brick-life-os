/**
 * Brick Discord surface (002-discord-bot-deploy).
 *
 * Express server exposing:
 *   - POST /discord : verified Discord interactions (PING + slash/message
 *     commands) -> relays the query through the shared core and returns the
 *     Brick reply. Rejects unverified requests with 401 (FR-001).
 *   - GET  /health  : liveness endpoint for the external keep-alive pinger (FR-004).
 *
 * Boot fails fast if required secrets are missing (FR-007). No secrets are
 * hardcoded; all values come from the environment (FR-006).
 */

import 'dotenv/config';
import express from 'express';
import { loadConfig } from './src/config.js';
import { handleMessage } from './src/core/bot.js';
import { verifyDiscordSignature } from './src/discord/verify.js';

function failBoot(reason, steps) {
  console.error(reason);
  console.error('');
  console.error(steps);
  process.exit(1);
}

const cfg = loadConfig();

if (!cfg.discordPublicKey) {
  failBoot(
    'Missing required secret: DISCORD_PUBLIC_KEY',
    'To fix:\n  1. Open the Discord Developer Portal > your application > General Information\n  2. Copy the PUBLIC KEY\n  3. Set it as the DISCORD_PUBLIC_KEY env var (never commit it)\n  4. Re-run the server',
  );
}

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// /discord needs the RAW body bytes for signature verification.
app.use('/discord', express.raw({ type: 'application/json' }));

app.post('/discord', async (req, res) => {
  const signature = req.get('x-signature-ed25519') || '';
  const timestamp = req.get('x-signature-timestamp') || '';
  const rawBody = req.body.toString('utf8');

  const check = verifyDiscordSignature(cfg.discordPublicKey, rawBody, signature, timestamp);
  if (!check.valid) {
    return res.status(401).json({ error: 'Bad request signature' });
  }

  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid interaction payload' });
  }

  const { type = 0, data = {} } = interaction;

  // 1 = PING: Discord requires an immediate ack to confirm the endpoint.
  if (type === 1) {
    return res.json({ type: 1 });
  }

  // 2 = APPLICATION_COMMAND (slash or message/user context menu).
  // 3 = MESSAGE_COMPONENT (button) — treated as a plain query in this POC.
  const query = extractQuery(type, data);

  if (!query) {
    return res.json({
      type: 4,
      data: { content: '🔴 **Brick says:** Say something first. A blank message gets nothing done.' },
    });
  }

  try {
    const reply = await handleMessage(query);
    return res.json({ type: 4, data: { content: reply } });
  } catch (err) {
    return res.json({
      type: 4,
      data: { content: `🔴 **Brick says:** ${err?.message ?? 'Something went wrong. Try again.'}` },
    });
  }
});

function extractQuery(type, data) {
  if (type === 2) {
    const isSlash = data.type === 1;
    if (isSlash) {
      // /brick <text>
      const value = data?.options?.[0]?.value;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    // Message/user context command against a targeted message.
    const resolved = data?.resolved?.messages;
    if (resolved) {
      const first = Object.values(resolved)[0];
      if (first?.content) return String(first.content).trim();
    }
  }
  if ((type === 3 || type === 2) && typeof data?.content === 'string' && data.content.trim()) {
    return data.content.trim();
  }
  return '';
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Brick (Discord surface) listening on :${port}`);
  console.log('  /health — liveness check');
  console.log('  /discord — verified interactions');
});
