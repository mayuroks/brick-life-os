import express from 'express';

/**
 * Minimal health endpoint (FR-006). Reports agent + bridge readiness.
 * @param {{agentUp:boolean, bridgeUp:boolean}} state
 * @returns {import('express').Express}
 */
export function createHealthApp(state) {
  const app = express();
  app.get('/health', (_req, res) => {
    const ok = state.agentUp && state.bridgeUp;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      agent: state.agentUp ? 'up' : 'down',
      bridge: state.bridgeUp ? 'up' : 'down',
    });
  });
  return app;
}
