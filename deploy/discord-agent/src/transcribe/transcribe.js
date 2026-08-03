import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile, open, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageFlags } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

const DEFAULT_BIN = 'whisper-cli';
const DEFAULT_MODEL = join(process.cwd(), 'models', 'ggml-base.en.bin');
const DEFAULT_TIMEOUT_MS = 120000;
// Below this normalized RMS amplitude, treat audio as silence -> "no speech".
// Speech measures ~0.1+; codec noise on digital-silence measures ~0.01.
const SILENCE_RMS = 0.02;

/**
 * Resolve the whisper-cli binary path (env override or default on PATH).
 * @returns {string}
 */
export function whisperBinPath() {
  return process.env.WHISPER_BIN || DEFAULT_BIN;
}

/**
 * Resolve the whisper model file path (env override or default ./models/ggml-base.en.bin).
 * @returns {string}
 */
export function whisperModelPath() {
  return process.env.WHISPER_MODEL || DEFAULT_MODEL;
}

/**
 * True when a message carries no usable typed text but has transcribable audio.
 * Uses the reliable MessageFlags.IsVoiceMessage flag when available, falling
 * back to "has attachments". FR-001: voice messages are actionable, not dropped.
 * @param {import('discord.js').Message} message
 * @returns {boolean}
 */
export function isVoiceMessage(message) {
  if (!message) return false;
  const text = String(message.content || '').trim();
  if (text) return false;
  try {
    if (message.flags?.has?.(MessageFlags.IsVoiceMessage)) return true;
  } catch {
    // fall through to attachment check
  }
  return Boolean(message.attachments && message.attachments.size > 0);
}

/**
 * Download the CDN attachment bytes (signed URL; follow redirects, no auth).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function downloadAttachment(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to download attachment (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Convert an Opus/Ogg audio buffer to a 16 kHz mono WAV via static ffmpeg.
 * @param {Buffer} opusBytes
 * @param {string} wavPath
 * @returns {Promise<void>}
 */
export async function convertToWav(opusBytes, wavPath) {
  if (!ffmpegPath) throw new Error('ffmpeg-static binary unavailable to convert audio');
  const dir = wavPath.slice(0, wavPath.lastIndexOf('/'));
  const srcPath = join(dir, 'input_audio.bin');
  await writeFile(srcPath, opusBytes);
  await execFileAsync(
    ffmpegPath,
    ['-y', '-i', srcPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath],
    { maxBuffer: 16 * 1024 * 1024 },
  );
}

/**
 * Run whisper-cli on a WAV and return the transcript text.
 * Writes a sidecar .txt (via -otxt -of) and reads it back.
 * @param {string} wavPath
 * @param {{bin?:string, model?:string, tmpbase?:string, timeoutMs?:number}} opts
 * @returns {Promise<string>} trimmed transcript ('' when nothing heard)
 */
export function transcribeWav(wavPath, opts = {}) {
  const { bin = whisperBinPath(), model = whisperModelPath(), tmpbase, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-m', model, '-f', wavPath, '-otxt', '-of', tmpbase]);
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Transcription timed out'));
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', async (code) => {
      clearTimeout(timer);
      try {
        const text = await readFile(`${tmpbase}.txt`, 'utf8');
        resolve(text.trim());
      } catch {
        reject(new Error(code === 0 ? 'whisper produced no transcript' : (err.trim() || 'whisper failed')));
      }
    });
  });
}

/**
 * Estimate normalized RMS amplitude of a 16-bit PCM WAV (sample up to ~200k
 * samples). Used as a silence gate: whisper base can hallucinate words on
 * near-silent audio, so short blank clips should report "no speech" (FR-004).
 * @param {string} wavPath
 * @returns {Promise<number>} normalized RMS in [0,1]
 */
export async function wavRms(wavPath) {
  const fh = await open(wavPath, 'r');
  try {
    const { size } = await stat(wavPath);
    const header = Buffer.alloc(44);
    await fh.read(header, 0, 44, 0);
    const n = Math.min(Math.floor((size - 44) / 2), 200000);
    const buf = Buffer.alloc(n * 2);
    await fh.read(buf, 0, n * 2, 44);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const s = buf.readInt16LE(i * 2);
      sum += s * s;
    }
    return n > 0 ? Math.sqrt(sum / n) / 32768 : 0;
  } finally {
    await fh.close();
  }
}

/**
 * Orchestrate download -> convert -> transcribe for a Discord voice attachment.
 * Never throws for bad audio; resolves a result object for graceful handling.
 * @param {{url?:string}} attachment - Discord attachment (uses `.url`)
 * @param {{bin?:string, model?:string, timeoutMs?:number}} [opts]
 * @returns {Promise<{status:'success'|'no-speech'|'error', text:string}>}
 */
export async function transcribeVoiceMessage(attachment, opts = {}) {
  const { bin = whisperBinPath(), model = whisperModelPath(), timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), 'whisper-'));
    const wavPath = join(dir, 'audio.wav');
    const bytes = await downloadAttachment(attachment.url);
    await convertToWav(bytes, wavPath);

    // Silence gate: skip whisper entirely when the clip has no meaningful energy
    // (avoids hallucinated words on blank/silent audio).
    const rms = await wavRms(wavPath);
    if (rms < SILENCE_RMS) return { status: 'no-speech', text: '' };

    const text = await transcribeWav(wavPath, { bin, model, tmpbase: join(dir, 'out'), timeoutMs });
    if (!text) return { status: 'no-speech', text: '' };
    return { status: 'success', text };
  } catch (err) {
    console.error(`[transcribe] error: ${err?.message}`);
    return { status: 'error', text: '' };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
