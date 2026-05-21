// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  projects:        [],
  tasks:           [],
  activeTab:       'board',   // 'board' | 'deadlines'
  activeProjectId: 'all',
  searchQuery:     '',
  priorityFilter:  'all',     // 'all' | 'low' | 'medium' | 'high'
};

const API = 'api.php';

// ─── API wrappers ─────────────────────────────────────────────────────────────
async function apiFetch(action, body = null) {
  const url  = `${API}?action=${action}`;
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

async function loadData() {
  const [projects, tasks] = await Promise.all([apiFetch('projects'), apiFetch('tasks')]);
  state.projects = projects;
  state.tasks    = tasks;
}

async function apiCreateProject(name, description) {
  const id = `proj-${Date.now()}`;
  await apiFetch('create_project', { id, name, description });
  state.projects.push({ id, name, description, created_at: new Date().toISOString() });
}

async function apiCreateTask(taskData) {
  const id = `task-${Date.now()}`;
  await apiFetch('create_task', { id, ...taskData });
  state.tasks.push({
    id,
    project_id:  taskData.projectId,
    title:       taskData.title,
    description: taskData.description,
    status:      taskData.status,
    priority:    taskData.priority,
    deadline:    taskData.deadline,
    created_at:  new Date().toISOString(),
  });
}

async function apiUpdateTask(id, status) {
  await apiFetch('update_task', { id, status });
  const t = state.tasks.find(t => t.id === id);
  if (t) t.status = status;
}

async function apiDeleteTask(id) {
  await apiFetch('delete_task', { id });
  state.tasks = state.tasks.filter(t => t.id !== id);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysDiff(deadlineStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [y, m, d] = deadlineStr.split('-').map(Number);
  const due = new Date(y, m - 1, d); // local midnight — avoids UTC-shift on ISO strings
  return Math.ceil((due - today) / 86400000);
}

function getOverdueCount() {
  return state.tasks.filter(t => {
    if (t.status === 'done' || !t.deadline) return false;
    return getDaysDiff(t.deadline) < 0;
  }).length;
}

function priorityBadge(p) {
  if (p === 'high')   return `<span class="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">High</span>`;
  if (p === 'medium') return `<span class="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Medium</span>`;
  return `<span class="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Low</span>`;
}

function deadlineAlert(deadline) {
  if (!deadline) return '';
  const diff = getDaysDiff(deadline);
  if (diff < 0)   return `<span class="flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">⚠ Overdue by ${Math.abs(diff)}d</span>`;
  if (diff === 0) return `<span class="flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">📅 Due Today</span>`;
  if (diff === 1) return `<span class="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">📅 Due Tomorrow</span>`;
  return `<span class="flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-200/50 rounded-md px-1.5 py-0.5 text-[10px]">📅 ${diff} days left (${deadline})</span>`;
}

// ─── HTML escape helper (prevents XSS from user-supplied content) ──────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ─── Render: Header ───────────────────────────────────────────────────────────
function renderHeader() {
  const completed = state.tasks.filter(t => t.status === 'done').length;
  const total     = state.tasks.length;
  const overdue   = getOverdueCount();
  const overdueChip = overdue > 0
    ? `<div class="bg-rose-500/10 border border-rose-500/20 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
         <span class="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
         <span class="text-rose-300 font-semibold">Overdue:</span>
         <span class="font-mono font-bold text-rose-100">${overdue}</span>
       </div>` : '';

  document.getElementById('app-header').innerHTML = `
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-indigo-600 rounded-xl shadow shadow-indigo-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
          </svg>
        </div>
        <div>
          <span class="font-mono text-[9px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 px-1.5 py-0.5 rounded">PHP 8.2+ with PDO MySQL</span>
          <h1 class="text-base font-extrabold tracking-tight mt-0.5 text-white">DevBoard Project Tracker</h1>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
          <span class="h-2 w-2 rounded-full bg-indigo-500"></span>
          <span class="text-slate-400">Projects:</span>
          <span class="font-mono font-bold text-slate-200">${state.projects.length}</span>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
          <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span class="text-slate-400">Completed:</span>
          <span class="font-mono font-bold text-slate-200">${completed}/${total}</span>
        </div>
        ${overdueChip}
      </div>
    </div>`;
}

// ─── Render: Tab Nav ──────────────────────────────────────────────────────────
function renderTabNav() {
  const tabs = [
    { id: 'board',     label: 'Task Kanban Board' },
    { id: 'deadlines', label: 'Urgent Deadlines Tracker' },
  ];
  document.getElementById('tab-nav').innerHTML = tabs.map(tab => `
    <button data-tab="${tab.id}" class="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
      state.activeTab === tab.id
        ? 'bg-white text-indigo-600 border border-slate-200 font-extrabold shadow-sm'
        : 'text-slate-600 hover:text-slate-900'}">
      ${tab.label}
    </button>`).join('');
  document.querySelectorAll('[data-tab]').forEach(btn =>
    btn.addEventListener('click', () => { state.activeTab = btn.dataset.tab; render(); })
  );
}

// ─── Render: Kanban Board ─────────────────────────────────────────────────────
function renderKanbanBoard() {
  const statuses = ['todo','in_progress','review','done'];
  const cols = [
    { status:'todo',        label:'To Do',         hBg:'bg-slate-100',                                 tC:'text-slate-700'  },
    { status:'in_progress', label:'In Progress',   hBg:'bg-indigo-50/70 border border-indigo-100/50',  tC:'text-indigo-800' },
    { status:'review',      label:'Under Review',  hBg:'bg-amber-50/70 border border-amber-100/50',    tC:'text-amber-800'  },
    { status:'done',        label:'Completed',     hBg:'bg-emerald-50/70 border border-emerald-100/50',tC:'text-emerald-800'},
  ];

  const filtered = state.tasks.filter(t => {
    const mp = state.activeProjectId === 'all' || t.project_id === state.activeProjectId;
    const ms = !state.searchQuery || t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
               (t.description||'').toLowerCase().includes(state.searchQuery.toLowerCase());
    const mpr = state.priorityFilter === 'all' || t.priority === state.priorityFilter;
    return mp && ms && mpr;
  });

  const activeProj = state.projects.find(p => p.id === state.activeProjectId);
  const projDesc = (state.activeProjectId !== 'all' && activeProj)
    ? `<div class="mt-4 pt-4 border-t border-slate-100 text-slate-600 leading-relaxed text-xs">${esc(activeProj.description || '')}</div>` : '';

  const projTabs = [
    `<button data-projid="all" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${state.activeProjectId==='all'?'bg-slate-900 text-white shadow':'text-slate-600 hover:bg-slate-50'}">All Projects</button>`,
    ...state.projects.map(p => `<button data-projid="${p.id}" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${state.activeProjectId===p.id?'bg-indigo-600 text-white shadow':'text-slate-600 hover:bg-slate-50'}">${esc(p.name)}</button>`),
    `<button id="btn-new-project" class="px-2.5 py-1.5 text-xs font-semibold border border-dashed border-slate-300 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 shrink-0">+ New Project</button>`,
  ].join('');

  const cardHtml = (task) => {
    const proj = state.projects.find(p => p.id === task.project_id);
    const projTag = (proj && state.activeProjectId === 'all')
      ? `<span class="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">${esc(proj.name)}</span>` : '';
    const idx = statuses.indexOf(task.status);
    const ml = idx > 0 ? `<button data-action="move" data-id="${task.id}" data-target="${statuses[idx-1]}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Move back">←</button>` : '';
    const mr = idx < 3 ? `<button data-action="move" data-id="${task.id}" data-target="${statuses[idx+1]}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Move forward">→</button>` : '';
    return `
      <div class="bg-white border border-slate-150 rounded-lg p-3 hover:shadow-md transition-all space-y-2 relative group">
        <div class="flex justify-between items-start gap-1">${projTag}<div class="flex gap-1 items-center ml-auto">${priorityBadge(task.priority)}</div></div>
        <h4 class="text-xs font-bold text-slate-900 leading-snug break-words">${esc(task.title)}</h4>
        ${task.description ? `<p class="text-[11px] text-slate-500 leading-relaxed line-clamp-3 break-words">${esc(task.description)}</p>` : ''}
        <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-50 items-center justify-between">
          ${deadlineAlert(task.deadline)}
          <div class="flex gap-1.5">${ml}${mr}
            <button data-action="delete" data-id="${task.id}" class="p-1 border border-slate-200 rounded text-red-500 hover:bg-red-50 transition-colors opacity-70 group-hover:opacity-100" title="Delete">🗑</button>
          </div>
        </div>
      </div>`;
  };

  const colHtml = (col) => {
    const colTasks = filtered.filter(t => t.status === col.status);
    const inner = colTasks.length === 0
      ? `<div class="text-slate-400 text-center py-10 text-[11px] select-none border border-dashed border-slate-100 rounded-xl">No active tasks here.</div>`
      : colTasks.map(cardHtml).join('');
    return `
      <div class="bg-white/80 border border-slate-150 rounded-xl p-4 flex flex-col h-[520px] max-h-[600px]">
        <div class="p-3 rounded-lg flex justify-between items-center mb-4 ${col.hBg}">
          <span class="text-xs font-bold uppercase tracking-wider ${col.tC}">${col.label}</span>
          <span class="bg-white/90 shadow-sm border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">${colTasks.length}</span>
        </div>
        <div class="flex-1 overflow-y-auto space-y-3.5 pr-1">${inner}</div>
      </div>`;
  };

  document.getElementById('tab-content').innerHTML = `
    <div class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-150 p-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">${projTabs}</div>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
              <input id="search-input" type="text" placeholder="Search board tasks..." value="${esc(state.searchQuery)}"
                class="pl-8 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-48 text-slate-800" />
            </div>
            <div class="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <select id="priority-filter" class="bg-transparent border-0 text-xs font-semibold focus:outline-none text-slate-700 pr-1">
                <option value="all"   ${state.priorityFilter==='all'   ?'selected':''}>Any Priority</option>
                <option value="high"  ${state.priorityFilter==='high'  ?'selected':''}>🔴 High</option>
                <option value="medium"${state.priorityFilter==='medium'?'selected':''}>🟡 Medium</option>
                <option value="low"   ${state.priorityFilter==='low'   ?'selected':''}>⚪ Low</option>
              </select>
            </div>
            <button id="btn-add-task" class="bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">+ Add Task</button>
          </div>
        </div>
        ${projDesc}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">${cols.map(colHtml).join('')}</div>
    </div>`;

  // Board event listeners
  document.querySelectorAll('[data-projid]').forEach(btn =>
    btn.addEventListener('click', () => { state.activeProjectId = btn.dataset.projid; renderKanbanBoard(); })
  );
  document.getElementById('btn-new-project')?.addEventListener('click', openProjectModal);
  document.getElementById('btn-add-task')?.addEventListener('click', openTaskModal);
  document.getElementById('search-input')?.addEventListener('input', e => { state.searchQuery = e.target.value; renderKanbanBoard(); });
  document.getElementById('priority-filter')?.addEventListener('change', e => { state.priorityFilter = e.target.value; renderKanbanBoard(); });
  document.querySelectorAll('[data-action="move"]').forEach(btn =>
    btn.addEventListener('click', async () => {
      try { await apiUpdateTask(btn.dataset.id, btn.dataset.target); render(); }
      catch (e) { alert('Failed to update: ' + e.message); }
    })
  );
  document.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try { await apiDeleteTask(btn.dataset.id); render(); }
      catch (e) { alert('Failed to delete: ' + e.message); }
    })
  );
}

// ─── Render: Deadlines Tracker ────────────────────────────────────────────────
function renderDeadlines() {
  const withDeadlines = state.tasks.filter(t => !!t.deadline)
    .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

  const overdue=[], activeSoon=[], future=[], completed=[];
  withDeadlines.forEach(t => {
    if (t.status === 'done') { completed.push(t); return; }
    const diff = getDaysDiff(t.deadline);
    if (diff < 0) overdue.push(t);
    else if (diff <= 7) activeSoon.push(t);
    else future.push(t);
  });

  function cdText(t) {
    if (t.status === 'done') return 'Completed';
    const d = getDaysDiff(t.deadline);
    if (d < 0)  return `Overdue by ${Math.abs(d)} days`;
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    return `Due in ${d} days`;
  }
  function statusBadge(s) {
    const m = { in_progress:'bg-indigo-50 border border-indigo-200 text-indigo-700', review:'bg-amber-50 border border-amber-200 text-amber-700', done:'bg-emerald-50 border border-emerald-200 text-emerald-700', todo:'bg-slate-100 border border-slate-200 text-slate-600' };
    return `<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${m[s]||m.todo}">${s.replace('_',' ')}</span>`;
  }
  function row(task, badgeCls) {
    const proj = state.projects.find(p => p.id === task.project_id);
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150/70 rounded-xl gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeCls}">${cdText(task)}</span>
            ${proj ? `<span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">${esc(proj.name)}</span>` : ''}
          </div>
          <h4 class="text-xs font-bold text-slate-800">${esc(task.title)}</h4>
          ${task.description ? `<p class="text-[11px] text-slate-500 line-clamp-1">${esc(task.description)}</p>` : ''}
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs font-mono font-medium text-slate-600 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-lg">📅 ${task.deadline}</span>
          ${statusBadge(task.status)}
        </div>
      </div>`;
  }
  function section(title, icon, bgCls, items, badgeCls, emptyMsg) {
    return `
      <div class="space-y-2.5">
        <h3 class="text-xs font-bold flex items-center gap-1.5 rounded-lg px-3 py-1.5 w-max ${bgCls}">${icon} ${title} (${items.length})</h3>
        ${items.length === 0
          ? `<p class="text-xs text-slate-400 italic pl-2 py-2">${emptyMsg}</p>`
          : `<div class="space-y-2">${items.map(t => row(t, badgeCls)).join('')}</div>`}
      </div>`;
  }

  document.getElementById('tab-content').innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-slate-150 p-6 space-y-6">
      <div>
        <h2 class="text-lg font-bold text-slate-900">⏰ Critical Milestones &amp; Deadlines Tracker</h2>
        <p class="text-xs text-slate-500 mt-1">Chronologically monitors active items to ensure coursework requirements are never submitted overdue.</p>
      </div>
      <div class="space-y-6">
        ${overdue.length > 0 ? section('Overdue Actions','🔥','text-rose-700 bg-rose-50 border border-rose-100',overdue,'bg-rose-500 text-white border-rose-600','') : ''}
        ${section('Due This Week','⚠','text-amber-700 bg-amber-50 border border-amber-100',activeSoon,'bg-amber-500 text-white border-amber-600','No deadlines active within the next 7 days.')}
        ${section('Future Deadlines','📅','text-slate-700 bg-slate-100 border border-slate-200',future,'bg-indigo-100 text-indigo-800 border-indigo-200','No other future deadlines configured.')}
        ${section('Saved / Completed','✅','text-emerald-700 bg-emerald-50 border border-emerald-100',completed,'bg-emerald-500 text-white border-emerald-600','Completed tasks with deadlines will settle here.')}
      </div>
    </div>`;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openProjectModal() {
  document.getElementById('proj-name').value = '';
  document.getElementById('proj-desc').value = '';
  document.getElementById('proj-name-error').classList.add('hidden');
  const m = document.getElementById('modal-project');
  m.classList.remove('hidden'); m.classList.add('flex');
  document.getElementById('proj-name').focus();
}
function closeProjectModal() {
  const m = document.getElementById('modal-project');
  m.classList.add('hidden'); m.classList.remove('flex');
}
function openTaskModal() {
  if (!state.projects.length) {
    alert('Please create a project first before adding tasks.');
    return;
  }
  document.getElementById('task-title').value   = '';
  document.getElementById('task-desc').value    = '';
  document.getElementById('task-deadline').value = '';
  document.getElementById('task-title-error').classList.add('hidden');
  const sel = document.getElementById('task-project');
  sel.innerHTML = state.projects.map(p =>
    `<option value="${p.id}" ${(state.activeProjectId !== 'all' && state.activeProjectId === p.id) ? 'selected':''}>${esc(p.name)}</option>`
  ).join('');
  document.getElementById('task-priority').value = 'low';
  document.getElementById('task-status').value   = 'todo';
  const m = document.getElementById('modal-task');
  m.classList.remove('hidden'); m.classList.add('flex');
  document.getElementById('task-title').focus();
}
function closeTaskModal() {
  const m = document.getElementById('modal-task');
  m.classList.add('hidden'); m.classList.remove('flex');
}

document.getElementById('btn-cancel-project').addEventListener('click', closeProjectModal);
document.getElementById('btn-cancel-task').addEventListener('click', closeTaskModal);
document.getElementById('modal-project').addEventListener('click', e => { if (e.target===e.currentTarget) closeProjectModal(); });
document.getElementById('modal-task').addEventListener('click', e => { if (e.target===e.currentTarget) closeTaskModal(); });

document.getElementById('form-project').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { document.getElementById('proj-name-error').classList.remove('hidden'); return; }
  try {
    await apiCreateProject(name, document.getElementById('proj-desc').value.trim());
    closeProjectModal(); render();
  } catch (err) { alert('Failed to create project: ' + err.message); }
});

document.getElementById('form-task').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  if (!title) { document.getElementById('task-title-error').classList.remove('hidden'); return; }
  try {
    await apiCreateTask({
      projectId:   document.getElementById('task-project').value,
      title,
      description: document.getElementById('task-desc').value.trim(),
      deadline:    document.getElementById('task-deadline').value,
      priority:    document.getElementById('task-priority').value,
      status:      document.getElementById('task-status').value,
    });
    closeTaskModal(); render();
  } catch (err) { alert('Failed to create task: ' + err.message); }
});

// ─── Orchestrator & Init ──────────────────────────────────────────────────────
function render() {
  renderHeader();
  renderTabNav();
  if (state.activeTab === 'board')     renderKanbanBoard();
  if (state.activeTab === 'deadlines') renderDeadlines();
}

async function init() {
  try {
    await loadData();
  } catch (e) {
    document.getElementById('tab-content').innerHTML =
      `<div class="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-6 text-sm">
         <strong>Could not reach the PHP backend.</strong><br>
         Make sure MAMP is running and all files are in htdocs/project-tracker/.<br>
         Error: ${e.message}
       </div>`;
    return;
  }
  render();
}

document.addEventListener('DOMContentLoaded', init);
