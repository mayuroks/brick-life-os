#!/usr/bin/env node
// Local end-to-end harness for voice transcription (US3).
// Feed a fixture .opus through the SAME download -> convert -> whisper -> forward
// code path the Discord bridge uses, without needing a live guild/channel.
//
// Usage:
//   node scripts/transcribe-local.mjs [path-to.opus]     (default: fixtures/test.opus)
//   EXPECT_TRANSCRIPT="hello world" node scripts/transcribe-local.mjs
//
// The only mock is the "forward to agent" seam (there's no real channel to reply
// to locally) — it prints the transcript and optionally asserts an expected
// substring. Everything before that exercises the real production functions.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { transcribeVoiceMessage } from '../src/transcribe/transcribe.js';

const ROOT = join(process.cwd(), 'fixtures');
const input = process.argv[2] || join(ROOT, 'test.opus');
const EXPECT = process.env.EXPECT_TRANSCRIPT || '';

const bytes = await readFile(input);
console.log(`[harness] loaded ${input} (${bytes.length} bytes)`);

// Serve the fixture over local HTTP so downloadAttachment() (real fetch, redirect
// follow) is exercised rather than skipped.
const mime = /\.(opus|ogg)$/i.test(input) ? 'audio/ogg' : 'application/octet-stream';
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': bytes.length });
  res.end(bytes);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const attachment = { url: `http://127.0.0.1:${port}/fixture.opus` };

const t0 = Date.now();
const result = await transcribeVoiceMessage(attachment, { timeoutMs: 120000 });
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
server.close();

console.log(`[harness] status=${result.status} elapsed=${elapsed}s text=${JSON.stringify(result.text)}`);

// Stub forward-to-agent seam: print (and optionally assert) what would be sent.
if (result.status === 'success') {
  console.log(`[stub-forward] transcript: ${result.text}`);
  if (EXPECT) {
    const ok = result.text.toLowerCase().includes(EXPECT.toLowerCase());
    console.log(ok ? '[assert] PASS — transcript contains expected text' : `[assert] FAIL — expected "${EXPECT}" not found`);
    process.exit(ok ? 0 : 1);
  }
} else {
  console.log(`[stub-forward] (nothing forwarded) status=${result.status}`);
  if (EXPECT) {
    console.log(`[assert] FAIL — expected a transcript, got status=${result.status}`);
    process.exit(1);
  }
}
