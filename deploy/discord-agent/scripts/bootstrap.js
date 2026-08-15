import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tplPath = path.join(root, 'agent/opencode.json.template');
const outPath = path.join(root, 'agent/opencode.json');

const required = ['JIRA_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required Jira secret(s): ${missing.join(', ')}`);
  process.exit(1);
}

const tpl = readFileSync(tplPath, 'utf8');
const filled = tpl
  .replaceAll('${JIRA_URL}', process.env.JIRA_URL)
  .replaceAll('${JIRA_USERNAME}', process.env.JIRA_USERNAME)
  .replaceAll('${JIRA_API_TOKEN}', process.env.JIRA_API_TOKEN)
  .replaceAll(
    '${AGENT_MODEL}',
    process.env.AGENT_MODEL || 'openrouter/poolside/laguna-s-2.1:free',
  );

writeFileSync(outPath, filled);
console.log(`Wrote ${outPath} (Jira MCP + agent model env-filled).`);
