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
        await status.edit(reply);
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

  return client;
}
