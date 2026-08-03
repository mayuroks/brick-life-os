import 'dotenv/config';
import { loadConfig } from './config.js';
import { createHealthApp } from './health.js';
import { createBridge } from './bridge/client.js';

// Fail fast at boot if required secrets are missing (FR-007).
const cfg = loadConfig();

const state = { agentUp: true, bridgeUp: false };

const health = createHealthApp(state);
health.listen(cfg.port, () => {
  console.log(`/health listening on :${cfg.port}`);
});

createBridge(cfg, state);
