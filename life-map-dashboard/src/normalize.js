const MIN_W = 26;
const MAX_W = 49;
const MIN_M = 7;
const MAX_M = 12;

function isoWeek(date) {
  const d = new Date(date);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function toBand(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return { week: isoWeek(d), month: d.getMonth() + 1 };
}

function clampWeek(w) {
  return Math.min(MAX_W, Math.max(MIN_W, w));
}

// Map fetched Jira projects/epics/stories into the shape the omni-compass template renders.
// Timeline is fixed July–Dec (weeks 26–49, months 7–12); missing dates default to the band start.
function normalize(projects, cfg) {
  const jiraBase = cfg.url.replace(/\/+$/, '');
  return (projects || []).map((proj) => {
    const epics = (proj.epics || []).map((ep) => {
      const start = toBand(ep.startDate);
      const end = toBand(ep.endDate) || start;
      const stories = (ep.stories || []).map((s) => s.summary);
      const total = (ep.stories || []).length;
      const done = (ep.stories || []).filter((s) => s.done).length;
      const progress = total === 0 ? 0 : Math.round((done / total) * 100);
      const startWeek = start ? clampWeek(start.week) : MIN_W;
      const endWeek = end ? clampWeek(Math.max(end.week, start ? start.week : MIN_W)) : MIN_W + 1;
      return {
        id: ep.key,
        title: ep.title,
        progress,
        startWeek,
        endWeek,
        startMonth: start ? Math.min(MAX_M, Math.max(MIN_M, start.month)) : MIN_M,
        endMonth: end ? Math.min(MAX_M, Math.max(MIN_M, end.month)) : MIN_M,
        desc: ep.desc,
        deepLink: `${jiraBase}/browse/${ep.key}`,
        stories,
      };
    });
    return {
      id: proj.key,
      name: proj.name,
      deepLink: `${jiraBase}/browse/${proj.key}`,
      epics,
    };
  });
}

module.exports = { normalize };
