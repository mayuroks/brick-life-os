#!/usr/bin/env node
/**
 * Brick local CLI (T008).
 * Reads a message from argv (or stdin), calls the shared core handleMessage,
 * prints the Brick reply, and exits non-zero on error.
 *
 * Boot fail-fast (FR-007): validates required secrets before any processing so
 * a missing OPENROUTER_API_KEY aborts immediately with exact next steps.
 */

import { loadConfig } from '../config.js';
import { handleMessage } from '../core/bot.js';

function validateConfig() {
  try {
    loadConfig();
  } catch (err) {
    console.error(err?.message ?? 'Missing required configuration.');
    process.exit(1);
  }
}

async function readInput() {
  const fromArgv = process.argv.slice(2).join(' ').trim();
  if (fromArgv) return fromArgv;

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return chunks.join('').trim();
  }

  return '';
}

async function main() {
  validateConfig();

  const message = await readInput();
  if (!message) {
    console.error('Usage: node src/cli/cli.js "your message"');
    console.error('   or:  echo "your message" | node src/cli/cli.js');
    process.exitCode = 2;
    return;
  }

  try {
    const reply = await handleMessage(message);
    console.log(reply);
  } catch (err) {
    console.error(err?.message ?? 'Unexpected error.');
    process.exitCode = 1;
  }
}

main();
