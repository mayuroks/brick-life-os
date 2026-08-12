require('dotenv').config();
const path = require('path');
const express = require('express');
const { fetchDashboardData } = require('./src/jiraClient');
const { normalize } = require('./src/normalize');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/jira', async (req, res) => {
  const cfg = {
    url: process.env.JIRA_URL,
    user: process.env.JIRA_USERNAME,
    token: process.env.JIRA_API_TOKEN,
  };

  if (!cfg.url || !cfg.user || !cfg.token) {
    return res.status(400).json({
      error: 'Jira credentials not configured. Set JIRA_URL, JIRA_USERNAME, and JIRA_API_TOKEN in the environment.',
    });
  }

  try {
    const raw = await fetchDashboardData(cfg);
    const data = normalize(raw, cfg);
    res.json(data);
  } catch (err) {
    const status = err.status || 500;
    if (status === 401 || status === 403) {
      return res.status(502).json({
        error: 'Jira authentication failed. Check JIRA_API_TOKEN (and username/site).',
      });
    }
    if (status === 404) {
      return res.status(502).json({ error: 'Jira resource not found. Check JIRA_URL.' });
    }
    res.status(status).json({ error: err.message || 'Failed to fetch Jira data.' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Life Map dashboard running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nStopping Life Map dashboard...');
  server.close(() => process.exit(0));
});
