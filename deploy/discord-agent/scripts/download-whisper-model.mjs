import { mkdir, access, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODEL = 'ggml-base.en.bin';
const URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';

const model = process.argv[2] || DEFAULT_MODEL;
const outDir = join(__dirname, '..', 'models');
const outFile = join(outDir, model);

await mkdir(outDir, { recursive: true });
try {
  await access(outFile);
  console.log(`[model] already present: ${outFile}`);
  process.exit(0);
} catch {}

console.log(`[model] downloading ${model} -> ${outFile} ...`);
const res = await fetch(URL, { redirect: 'follow' });
if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${URL}`);
const buf = Buffer.from(await res.arrayBuffer());
await writeFile(outFile, buf);
console.log(`[model] done: ${outFile} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
