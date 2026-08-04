import express from 'express';
import { log } from './log.js';

/**
 * Minimal health endpoint (FR-006). Reports agent + bridge readiness.
 * @param {{agentUp:boolean, bridgeUp:boolean}} state
 * @returns {import('express').Express}
 */
export function createHealthApp(state) {
  const prev = { agentUp: state.agentUp, bridgeUp: state.bridgeUp };
  const app = express();
  app.get('/health', (_req, res) => {
    for (const flag of ['agentUp', 'bridgeUp']) {
      if (state[flag] !== prev[flag]) {
        prev[flag] = state[flag];
        log('info', 'health.flip', { service: 'health' }, `${flag} flipped`, {
          flag,
          value: state[flag],
        });
      }
    }
    const ok = state.agentUp && state.bridgeUp;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      agent: state.agentUp ? 'up' : 'down',
      bridge: state.bridgeUp ? 'up' : 'down',
    });
  });
  return app;
}
