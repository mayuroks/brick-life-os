import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import { runAgent } from '../agent/client.js';
import { ChannelQueue } from './queue.js';
import { transcribe } from '../transcribe/index.js';
import { log } from '../log.js';

const STATUS_PHRASES = [
  'Wondering',
  'Analysing',
  'Deep in thought',
  'Consulting Jira',
  'Checking your backlog',
  'Crunching the numbers',
  'Reading the room',
  'Polishing the hard truth',
  'Shuffling the backlog',
  'Grilling a meeting',
  'Sharpening the coach',
  'Counting your streaks',
  'Hunting the ragebait',
  'Weighing the excuses',
  'Staring at your TODO',
];

const STATUS_DOTS = ['', '.', '..', '...'];

// Discord's message content limit.
const MAX_MSG_LEN = 2000;

/**
 * Split a reply into Discord-safe chunks of at most MAX_MSG_LEN chars without
 * breaking words. Returns [firstChunk, ...rest] where firstChunk edits the
 * status message and rest are posted as follow-up messages.
 */
function chunkReply(text) {
  if (!text) return [''];
  if (text.length <= MAX_MSG_LEN) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > MAX_MSG_LEN) {
    let cut = remaining.lastIndexOf('\n', MAX_MSG_LEN);
    if (cut <= 0) cut = remaining.lastIndexOf(' ', MAX_MSG_LEN);
    if (cut <= 0) cut = MAX_MSG_LEN;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}


/**
 * Rotate a random loading status on `statusMsg` every 2.5s until cleared.
 * @param {import('discord.js').Message} statusMsg
 * @returns {NodeJS.Timeout}
 */
function startStatus(statusMsg) {
  return setInterval(async () => {
    const phrase = STATUS_PHRASES[Math.floor(Math.random() * STATUS_PHRASES.length)];
    const dots = STATUS_DOTS[Math.floor(Math.random() * STATUS_DOTS.length)];
    await statusMsg.edit(`⏳ **${phrase}${dots}**`).catch(() => {});
  }, 2500);
}

/**
 * Detect a Discord voice note (FR-006): a message flagged as a voice message,
 * OR an audio attachment with no typed text. Typed text always wins — a message
 * with both text and audio is treated as text (voice path never triggers).
 * @param {import('discord.js').Message} message
 * @returns {boolean}
 */
function isVoiceMessage(message) {
  if (!message) return false;
  const text = (message.content || '').trim();
  if (text) return false;
  try {
    if (message.flags?.has?.(MessageFlags.IsVoiceMessage)) return true;
  } catch {
    // fall through to attachment check
  }
  return Boolean(message.attachments && message.attachments.size > 0);
}

/**
 * Run a single agent turn: status → agent → chunked reply (FR-003, FR-005).
 * Shared by the typed-text path and the transcribed-voice path so a voice note
 * behaves exactly like a typed message.
 * @param {import('discord.js').Message} message
 * @param {{serveUrl:string}} cfg
 * @param {{agentUp:boolean}} state
 * @param {string} payload - the message text to send to the agent.
 * @param {import('discord.js').Message} [existingStatus] - reuse an already
 *        posted status message instead of replying a fresh one, so a voice
 *        turn updates a single message end-to-end (Listening → Wondering →
 *        reply) instead of leaving a separate ghost status.
 */
async function runTurn(message, cfg, state, payload, existingStatus) {
  let status;
  let timer;
  try {
    console.log(`[discord] -> agent: ${JSON.stringify(payload)}`);
    if (existingStatus) {
      status = existingStatus;
      await status.edit('⏳ **Wondering**').catch(() => {});
    } else {
      status = await message.reply('⏳ **Wondering**');
    }
    timer = startStatus(status);
    const t1 = Date.now();
    const reply = await runAgent(cfg.serveUrl, payload);
    clearInterval(timer);
    console.log(`[discord] <- agent (${Date.now() - t1}ms): ${JSON.stringify(reply)}`);
    state.agentUp = true;
    const chunks = chunkReply(reply);
    await status.edit(chunks[0]).catch(() => chunks[0] && message.reply(chunks[0]).catch(() => {}));
    for (const extra of chunks.slice(1)) {
      await message.channel.send(extra).catch((e) => log('warn', 'bridge.reply-extra-failed', { service: 'bridge' }, `Extra reply failed: ${e?.message}`));
    }
    console.log(`[discord] reply posted to ${message.channelId}`);
  } catch (err) {
    clearInterval(timer);
    state.agentUp = false;
    console.error(`[discord] agent error: ${err?.message}`);
    const msg = err?.message || 'Something went wrong. Try again.';
    if (status) {
      await status.edit(msg).catch(() => {});
    } else {
      await message.reply(msg).catch(() => {});
    }
  }
}

/**
 * Route a voice note: transcribe via Groq, then either enqueue the transcript
 * as a normal agent turn (success) or reply with a clear notice and keep the
 * bridge alive (error/empty) — no retry, no fallback (FR-004).
 * @param {import('discord.js').Message} message
 * @param {{serveUrl:string}} cfg
 * @param {{agentUp:boolean}} state
 */
async function handleVoice(message, cfg, state) {
  let status;
  let timer;
  try {
    const attachment = message.attachments?.first();
    const url = attachment?.url;
    if (!url) {
      await message.reply("🎙️ I couldn't see an audio attachment to transcribe.").catch(() => {});
      return;
    }

    console.log('[discord] -> groq transcribe');
    status = await message.reply('🎙️ **Listening**');
    timer = startStatus(status);
    const t1 = Date.now();
    const { status: tStatus, text: transcript } = await transcribe(url);
    clearInterval(timer);
    console.log(`[discord] <- transcript (${Date.now() - t1}ms): ${JSON.stringify(transcript)} [${tStatus}]`);

    if (tStatus === 'error') {
      log('warn', 'voice.transcribe-error', { service: 'bridge', channelId: message.channelId }, 'Voice transcription failed');
      await status.edit("Sorry, I couldn't transcribe that audio. Try again or send a text message.").catch(() => {});
      return;
    }
    if (tStatus === 'empty' || !transcript) {
      log('info', 'voice.no-speech', { service: 'bridge', channelId: message.channelId }, 'No speech detected in voice note');
      await status.edit("🎙️ I didn't catch that — try a text message or speak up.").catch(() => {});
      return;
    }

    // Success: reuse the exact text turn path (FR-003), and hand the current
    // "Listening" status message into runTurn so it becomes the single reply
    // message (Listening → Wondering → answer) — no separate "Got it" ghost.
    return runTurn(message, cfg, state, transcript, status);
  } catch (err) {
    clearInterval(timer);
    log('error', 'voice.handling-failed', { service: 'bridge', channelId: message.channelId }, `Voice handling failed: ${err?.message}`);
    const msg = err?.message || "'What?' is a great start — but try a text message instead.";
    if (status) {
      await status.edit(msg).catch(() => {});
    } else {
      await message.reply(msg).catch(() => {});
    }
  }
}

/**
 * Create the Discord Gateway bridge (FR-001, FR-005).
 * Reads plain channel messages and sends them to the headless agent; posts the
 * agent's reply back to the same channel.
 *
 * @param {{token:string, serveUrl:string, myBotId:string, allowedBotIds?:string[]}} cfg
 * @param {{agentUp:boolean, bridgeUp:boolean}} state
 */
export function createBridge(cfg, state) {
  const { myBotId, allowedBotIds = [] } = cfg;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  const queue = new ChannelQueue();

  client.once('ready', () => {
    state.bridgeUp = true;
    const myBotId = client.user?.id;
    log('info', 'bridge.ready', { service: 'bridge', user: client.user?.tag, userId: myBotId }, 'Bridge ready');
  });

  client.on('messageCreate', (message) => {
    // Ignore the bot's own messages (prevent reply loops).
    if (myBotId && message.author.id === myBotId) return;
    // Ignore other bots not in whitelist (allow Message Scheduler, etc.).
    if (message.author.bot && !allowedBotIds.includes(message.author.id)) return;

    const text = (message.content || '').trim();
    const isVoice = !text && isVoiceMessage(message);

    // Empty text with no audio is dropped (nothing to act on).
    if (!text && !isVoice) return;

    log('info', 'msg.queued', {
      service: 'bridge',
      channelId: message.channelId,
      user: message.author?.username,
      voice: isVoice,
    });

    queue.enqueue(message.channelId, () => {
      if (isVoice) return handleVoice(message, cfg, state);
      return runTurn(message, cfg, state, text);
    });
  });

  process.on('SIGTERM', () => client.destroy());
  client.login(cfg.token).catch((e) => {
    log('error', 'bridge.login-failed', { service: 'bridge' }, `Bridge login failed: ${e.message}`);
    process.exit(1);
  });

  // An unhandled 'error' on the Discord gateway WebSocket crashes the whole
  // container (observed: ECONNRESET after a long agent run). Swallow + log so
  // the bridge stays alive; discord.js will reconnect on its own.
  client.on('error', (e) => {
    log('warn', 'bridge.ws-error', { service: 'bridge' }, `Gateway error: ${e?.message || e}`);
  });
  client.ws?.on('error', (e) => {
    log('warn', 'bridge.ws-error', { service: 'bridge' }, `WebSocket error: ${e?.message || e}`);
  });

  return client;
}
