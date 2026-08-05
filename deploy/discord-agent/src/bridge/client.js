import { Client, GatewayIntentBits } from 'discord.js';
import { runAgent } from '../agent/client.js';
import { ChannelQueue } from './queue.js';
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
 * Create the Discord Gateway bridge (FR-001, FR-005).
 * Reads plain channel messages and sends them to the headless agent; posts the
 * agent's reply back to the same channel.
 *
 * @param {{token:string, serveUrl:string}} cfg
 * @param {{agentUp:boolean, bridgeUp:boolean}} state
 */
export function createBridge(cfg, state) {
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
    log('info', 'bridge.ready', { service: 'bridge', user: client.user?.tag }, 'Bridge ready');
  });

  client.on('messageCreate', (message) => {
    const text = (message.content || '').trim();

    // Ignore the bot's own messages and other bots (no reply loops).
    if (message.author.bot) return;

    // Voice transcription is fully removed (text-only agent): any message with
    // no typed text but a transcribable audio attachment is acknowledged with a
    // notice instead of being processed. Empty text with no audio is dropped.
    if (!text && message.attachments?.size > 0) {
      message
        .reply('🎙️ Voice transcription is off — send me a text message instead.')
        .catch(() => {});
      return;
    }
    if (!text) return;

    log('info', 'msg.queued', {
      service: 'bridge',
      channelId: message.channelId,
      user: message.author?.username,
    });

    queue.enqueue(message.channelId, async () => {
      let status;
      let timer;
      let payload = text;
      try {
        console.log(`[discord] -> agent: ${JSON.stringify(payload)}`);
        status = await message.reply('⏳ **Wondering**');
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
