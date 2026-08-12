let projectsData = [];
let currentTimelineMode = 'weekly'; // 'weekly' or 'monthly'
let activeEpic = null;
let selectedProject = null;
let lastError = null;

const MIN_W = 26, MAX_W = 49, MIN_M = 7, MAX_M = 12;

window.onload = function () {
  let saved = 'light';
  try { saved = localStorage.getItem('life-map-theme') || 'light'; } catch (e) { /* sandboxed iframe */ }
  const dark = saved === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  updateThemeIcon(dark);
  loadData();
};

function toggleTheme() {
  const root = document.documentElement;
  const dark = !root.classList.contains('dark');
  root.classList.toggle('dark', dark);
  try { localStorage.setItem('life-map-theme', dark ? 'dark' : 'light'); } catch (e) {}
  updateThemeIcon(dark);
}

function updateThemeIcon(dark) {
  const icon = document.getElementById('theme-icon');
  icon.className = dark ? 'fa-solid fa-sun text-base' : 'fa-solid fa-moon text-base';
}

function setTimelineMode(mode) {
  currentTimelineMode = mode;
  document.getElementById('mode-weekly-btn').className = mode === 'weekly'
    ? 'px-3 py-1.5 rounded-lg font-semibold bg-emerald-600 text-white transition'
    : 'px-3 py-1.5 rounded-lg font-medium text-t2 hover:text-t1 transition';
  document.getElementById('mode-monthly-btn').className = mode === 'monthly'
    ? 'px-3 py-1.5 rounded-lg font-semibold bg-emerald-600 text-white transition'
    : 'px-3 py-1.5 rounded-lg font-medium text-t2 hover:text-t1 transition';
  renderWorkspace();
}

// --- Live data (US1) + refresh (US2) ---

async function loadData() {
  setRefreshLoading(true);
  try {
    const res = await fetch('/api/jira');
    let body;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      const msg = (body && body.error) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    projectsData = Array.isArray(body) ? body : [];
    lastError = null;
    hideError();
    renderWorkspace();
    showToast('Jira data refreshed');
  } catch (err) {
    lastError = err.message;
    showError(err.message); // retain last-known data: we do NOT clear projectsData
    if (projectsData.length) renderWorkspace();
  } finally {
    setRefreshLoading(false);
  }
}

function refreshData() {
  loadData();
}

function setRefreshLoading(loading) {
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.className = loading
    ? 'fa-solid fa-rotate text-sm animate-spin'
    : 'fa-solid fa-rotate text-sm';
}

function showError(msg) {
  const c = document.getElementById('workspace-container');
  if (!c || projectsData.length) return; // only surface full error when no data to show
  const box = document.createElement('div');
  box.id = 'data-error';
  box.className = 'bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl p-4 text-xs font-medium';
  box.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i>${esc(msg)}`;
  c.innerHTML = '';
  c.appendChild(box);
}

function hideError() {
  const box = document.getElementById('data-error');
  if (box) box.remove();
}

// --- Rendering (US1) ---

function renderWorkspace() {
  const container = document.getElementById('workspace-container');
  container.innerHTML = '';
  hideError();

  let columns = [];
  if (currentTimelineMode === 'weekly') {
    for (let w = MIN_W; w <= MAX_W; w++) columns.push(`W${w}`);
  } else {
    columns = ['July', 'August', 'September', 'October', 'November', 'December'];
  }

  const grid = document.createElement('div');
  grid.className = `relative grid ${currentTimelineMode === 'weekly' ? 'min-w-[1900px]' : 'min-w-[1000px]'}`;
  grid.style.gridTemplateColumns = '320px minmax(0, 1fr)';
  grid.style.gridAutoRows = 'auto';
  grid.style.gap = '1rem';

  // Timeline header
  const timelineHeader = document.createElement('div');
  timelineHeader.className = "flex items-stretch bg-page border border-line rounded-2xl sticky top-0 z-30 shadow-xl";
  timelineHeader.style.gridColumn = '1 / -1';

  const headerTitleSpace = document.createElement('div');
  headerTitleSpace.className = "w-80 flex-shrink-0 font-bold text-xs text-t2 uppercase tracking-wider px-4 flex items-center border-r border-line/60 sticky left-0 bg-page z-20";
  headerTitleSpace.innerText = "Project Vectors / Epics";
  timelineHeader.appendChild(headerTitleSpace);

  const scaleWrap = document.createElement('div');
  scaleWrap.className = "flex-1 flex flex-col flex-shrink-0";

  // Current real-world indicator (FR-013)
  const nowWeek = isoWeek(new Date());
  const nowMonth = new Date().getMonth() + 1;

  if (currentTimelineMode === 'weekly') {
    const monthBand = document.createElement('div');
    monthBand.className = "grid text-[10px] font-bold text-t3 uppercase tracking-wider border-b border-line/70 text-center z-10";
    monthBand.style.gridTemplateColumns = `repeat(6, minmax(0, 1fr))`;
    ['July','August','September','October','November','December'].forEach((m) => {
      const cell = document.createElement('div');
      cell.className = "border-l border-line/60 py-1 truncate px-1";
      cell.innerText = m;
      monthBand.appendChild(cell);
    });
    scaleWrap.appendChild(monthBand);

    const weekBand = document.createElement('div');
    weekBand.className = "grid text-[10px] font-semibold text-t2 text-center z-10";
    weekBand.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    columns.forEach((col, idx) => {
      const span = document.createElement('div');
      span.className = (idx < columns.length - 1 ? "border-r border-line/60 " : "") + "py-0.5 truncate px-1";
      span.innerText = col;
      if (MIN_W + idx === nowWeek) span.className += " bg-emerald-500/20 text-emerald-600 font-bold";
      weekBand.appendChild(span);
    });
    scaleWrap.appendChild(weekBand);
  } else {
    const scaleBar = document.createElement('div');
    scaleBar.className = "grid text-[10px] md:text-[11px] font-semibold text-t2 text-center z-10 py-1";
    scaleBar.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    columns.forEach((col, idx) => {
      const span = document.createElement('div');
      span.className = (idx < columns.length - 1 ? "border-r border-line/60 " : "") + "py-0.5 truncate px-1";
      if (MIN_M + idx === nowMonth) span.className += " bg-emerald-500/20 text-emerald-600 font-bold";
      span.innerText = col;
      scaleBar.appendChild(span);
    });
    scaleWrap.appendChild(scaleBar);
  }

  timelineHeader.appendChild(scaleWrap);
  grid.appendChild(timelineHeader);

  (projectsData || []).forEach(proj => {
    // Column 1: Project vector node; clicking opens the Jira project page (FR-012)
    const projNode = document.createElement('div');
    projNode.style.gridColumn = '1';
    projNode.className = "w-80 bg-card border border-line p-4 rounded-xl shadow-lg flex flex-col justify-center sticky left-0 z-20 cursor-pointer hover:border-barA transition";
    projNode.onclick = () => { if (proj.deepLink) window.open(proj.deepLink, '_blank'); };
    projNode.innerHTML = `
      <h4 class="font-bold text-sm text-t1 tracking-tight">${esc(proj.name)}</h4>
      <span class="text-[11px] text-t2 mt-1">${(proj.epics || []).length} Aligned Epics</span>
    `;
    grid.appendChild(projNode);

    // Column 2: Epic tracks
    const timelineTracks = document.createElement('div');
    timelineTracks.style.gridColumn = '2';
    timelineTracks.className = "relative flex flex-col justify-center space-y-2 py-2 px-3 bg-panel/40 border border-line/60 hover:border-line rounded-2xl";
    timelineTracks.style.backgroundImage = 'linear-gradient(to right, rgba(var(--line),0.6) 1px, transparent 1px)';
    timelineTracks.style.backgroundSize = `calc(100% / ${columns.length}) 100%`;
    timelineTracks.style.backgroundPosition = 'left center';

    (proj.epics || []).forEach(epic => {
      const trackRow = document.createElement('div');
      trackRow.className = "relative h-9 bg-panel/90 border border-line/80 hover:border-line2 rounded-xl flex items-center px-3 cursor-pointer group/epic transition overflow-hidden shadow-sm";
      trackRow.onclick = () => openEpicModal(proj, epic);

      // Current period highlight stripe (FR-013)
      if (currentTimelineMode === 'weekly' && nowWeek >= MIN_W && nowWeek <= MAX_W) {
        const hl = document.createElement('div');
        hl.className = "absolute inset-y-0 bg-emerald-500/10 pointer-events-none z-0";
        hl.style.left = (((nowWeek - MIN_W) / (MAX_W - MIN_W)) * 100) + '%';
        hl.style.width = (100 / (MAX_W - MIN_W)) + '%';
        trackRow.appendChild(hl);
      } else if (currentTimelineMode === 'monthly' && nowMonth >= MIN_M && nowMonth <= MAX_M) {
        const hl = document.createElement('div');
        hl.className = "absolute inset-y-0 bg-emerald-500/10 pointer-events-none z-0";
        hl.style.left = (((nowMonth - MIN_M) / (MAX_M - MIN_M + 1)) * 100) + '%';
        hl.style.width = (100 / (MAX_M - MIN_M + 1)) + '%';
        trackRow.appendChild(hl);
      }

      let leftPercent = 0;
      let widthPercent = 30;
      if (currentTimelineMode === 'weekly') {
        const spanW = MAX_W - MIN_W;
        leftPercent = Math.max(0, Math.min(100, ((epic.startWeek - MIN_W) / spanW) * 100));
        const endW = Math.max(epic.startWeek + 1, Math.min(MAX_W, epic.endWeek));
        widthPercent = Math.max(8, Math.min(100 - leftPercent, ((endW - epic.startWeek + 1) / spanW) * 100));
      } else {
        const spanM = MAX_M - MIN_M + 1;
        leftPercent = Math.max(0, Math.min(100, ((epic.startMonth - MIN_M) / spanM) * 100));
        const endM = Math.max(epic.startMonth, epic.endMonth);
        widthPercent = Math.max(15, Math.min(100 - leftPercent, ((endM - epic.startMonth + 1) / spanM) * 100));
      }

      const barContainer = document.createElement('div');
      barContainer.className = "absolute inset-x-3 inset-y-1.5 flex items-center pointer-events-none z-10";

      const ganttBar = document.createElement('div');
      ganttBar.className = "absolute h-6 rounded-lg bg-gradient-to-r from-barA to-barB shadow-md flex items-center px-3 justify-between text-barTxt text-[11px] font-medium transition group-hover/epic:brightness-110";
      ganttBar.style.left = leftPercent + '%';
      ganttBar.style.width = widthPercent + '%';
      ganttBar.innerHTML = `
        <span class="truncate pr-2 font-semibold">${esc(epic.title)}</span>
        <span class="bg-barChip/35 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0">${epic.progress}%</span>
      `;

      barContainer.appendChild(ganttBar);
      trackRow.appendChild(barContainer);
      timelineTracks.appendChild(trackRow);
    });

    grid.appendChild(timelineTracks);
  });

  container.appendChild(grid);
}

function openEpicModal(proj, epic) {
  selectedProject = proj;
  activeEpic = epic;

  document.getElementById('modal-project-badge').innerText = proj.name;
  document.getElementById('modal-epic-dates').innerText = currentTimelineMode === 'weekly'
    ? `Weeks ${epic.startWeek} - ${epic.endWeek}`
    : `Months ${epic.startMonth} - ${epic.endMonth}`;
  document.getElementById('modal-epic-title').innerText = epic.title || 'Untitled Epic';
  document.getElementById('modal-epic-desc').innerText = epic.desc || 'No description available.';
  document.getElementById('modal-progress-text').innerText = (epic.progress || 0) + '%';
  document.getElementById('modal-progress-bar').style.width = (epic.progress || 0) + '%';

  const storiesList = document.getElementById('modal-stories-list');
  storiesList.innerHTML = '';
  (epic.stories || []).forEach((story) => {
    const div = document.createElement('div');
    div.className = "flex items-center gap-3 p-3 rounded-xl bg-page border border-line text-xs text-t3";
    div.innerHTML = `<i class="fa-regular fa-circle-check text-emerald-500"></i><span class="font-medium">${esc(story)}</span>`;
    storiesList.appendChild(div);
  });
  if (!(epic.stories || []).length) {
    storiesList.innerHTML = '<div class="text-xs text-t3/70 p-2">No stories yet.</div>';
  }

  document.getElementById('epic-modal').classList.remove('hidden');
}

function openEpicInJira() {
  if (activeEpic && activeEpic.deepLink) window.open(activeEpic.deepLink, '_blank');
  closeEpicModal();
}

function closeEpicModal() {
  document.getElementById('epic-modal').classList.add('hidden');
}

// --- Helpers ---

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  document.getElementById('toast-msg').innerText = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}
