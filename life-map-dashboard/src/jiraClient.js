const PROJECT_KEYS = ['BF', 'FAM', 'HM', 'FIN', 'BR', 'BH', 'BS', 'MDP', 'ART'];

function authHeaders({ user, token }) {
  return {
    Authorization: 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function jiraGet(cfg, pathname) {
  const res = await fetch(`${cfg.url}${pathname}`, { headers: authHeaders(cfg) });
  if (!res.ok) {
    const err = new Error(`Jira request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Newer Jira Cloud instances require the POST /search/jql endpoint (CHANGE-2046);
// the legacy GET /search has been removed.
async function jiraSearch(cfg, { jql, fields, maxResults }) {
  const res = await fetch(`${cfg.url}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify({ jql, fields, maxResults }),
  });
  if (!res.ok) {
    const err = new Error(`Jira request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Epic date fields are custom per instance; read the common ones, falling back to created.
const EPIC_FIELDS = 'summary,status,created,customfield_10014,customfield_10015,customfield_10016,customfield_10309,customfield_10310';

async function fetchProjectEpics(cfg, projectKey) {
  const jql = `project = ${projectKey} AND issuetype = Epic ORDER BY created ASC`;
  const res = await jiraSearch(cfg, { jql, fields: EPIC_FIELDS.split(','), maxResults: 100 });
  const issues = res.issues || [];
  return issues.map((i) => ({
    key: i.key,
    title: i.fields.summary,
    desc: (i.fields.customfield_10014 || i.fields.customfield_10309 || '').slice(0, 200),
    startDate: i.fields.customfield_10015 || i.fields.customfield_10309 || i.fields.created,
    endDate: i.fields.customfield_10016 || i.fields.customfield_10310 || null,
    status: i.fields.status ? i.fields.status.name : null,
  }));
}

async function fetchEpicStories(cfg, epicKey) {
  const fields = 'summary,status';
  const jql = `parent = ${epicKey} ORDER BY created ASC`;
  const res = await jiraSearch(cfg, { jql, fields: fields.split(','), maxResults: 200 });
  const issues = res.issues || [];
  return issues.map((i) => ({
    key: i.key,
    summary: i.fields.summary,
    status: i.fields.status ? i.fields.status.name : null,
    done: i.fields.status
      ? (i.fields.status.statusCategory && i.fields.status.statusCategory.key === 'done') ||
        /done|closed|completed|resolved|shipped|delivered/i.test(i.fields.status.name)
      : false,
  }));
}

async function fetchDashboardData(cfg) {
  const all = await jiraGet(cfg, '/rest/api/3/project');
  const projects = (Array.isArray(all) ? all : all.values || []).filter((p) =>
    PROJECT_KEYS.includes(p.key)
  );

  const out = [];
  for (const proj of projects) {
    const epics = await fetchProjectEpics(cfg, proj.key);
    const epicList = [];
    for (const e of epics) {
      const stories = await fetchEpicStories(cfg, e.key);
      epicList.push({ ...e, stories });
    }
    out.push({ key: proj.key, name: proj.name, epics: epicList });
  }
  return out;
}

module.exports = { fetchDashboardData, PROJECT_KEYS };
