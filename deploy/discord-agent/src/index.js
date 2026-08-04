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

// Crash guard: log unhandled rejections/exceptions instead of silently dying.
// (An unhandled 'error' on the gateway WS previously killed the container.)
process.on('unhandledRejection', (reason) => {
  log('error', 'unhandled-rejection', { service: 'index' }, 'Unhandled rejection', {
    reason: reason?.message || String(reason),
  });
});
process.on('uncaughtException', (err) => {
  log('error', 'uncaught-exception', { service: 'index' }, 'Uncaught exception', {
    message: err?.message,
    stack: err?.stack,
  });
});
