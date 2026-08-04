import 'dotenv/config';
import { loadConfig } from './config.js';
import { createHealthApp } from './health.js';
import { createBridge } from './bridge/client.js';
import { log } from './log.js';

// Fail fast at boot if required secrets are missing (FR-007).
const cfg = loadConfig();
log('info', 'boot.config', { service: 'index' }, 'Config loaded');

const state = { agentUp: true, bridgeUp: false };

const health = createHealthApp(state);
health.listen(cfg.port, () => {
  log('info', 'boot.health-listening', { service: 'index', port: cfg.port }, '/health listening');
});

createBridge(cfg, state);
