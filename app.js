// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  projects: [],
  tasks: [],
  activeTab: 'board',   // 'board' | 'deadlines'
  activeProjectId: 'all',
  searchQuery: '',
  priorityFilter: 'all',     // 'all' | 'low' | 'medium' | 'high'
};

const API = 'backend.php';

// ─── API wrappers ─────────────────────────────────────────────────────────────
async function apiFetch(action, body = null) {
  const url = `${API}?action=${action}`;
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

async function loadData() {
  const [projects, tasks] = await Promise.all([apiFetch('projects'), apiFetch('tasks')]);
  state.projects = projects;
  state.tasks = tasks;
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
    project_id: taskData.projectId,
    title: taskData.title,
    description: taskData.description,
    status: taskData.status,
    priority: taskData.priority,
    deadline: taskData.deadline,
    created_at: new Date().toISOString(),
  });
}

async function apiUpdateTask(id, status) {
  await apiFetch('update_task', { id, status });
  const t = state.tasks.find(t => t.id === id);
  if (t) t.status = status;
}

async function apiFullUpdateTask(id, taskData) {
  await apiFetch('update_task', { id, ...taskData });
  const t = state.tasks.find(t => t.id === id);
  if (t) {
    t.title = taskData.title;
    t.description = taskData.description;
    t.status = taskData.status;
    t.priority = taskData.priority;
    t.deadline = taskData.deadline;
    t.project_id = taskData.projectId;
  }
}

async function apiDeleteTask(id) {
  await apiFetch('delete_task', { id });
  state.tasks = state.tasks.filter(t => t.id !== id);
}

async function apiUpdateProject(id, name, description) {
  await apiFetch('update_project', { id, name, description });
  const p = state.projects.find(p => p.id === id);
  if (p) {
    p.name = name;
    p.description = description;
  }
}

async function apiDeleteProject(id) {
  await apiFetch('delete_project', { id });
  state.projects = state.projects.filter(p => p.id !== id);
  state.tasks = state.tasks.filter(t => t.project_id !== id);
  if (state.activeProjectId === id) state.activeProjectId = 'all';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysDiff(deadlineStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
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
  if (p === 'high') return `<span class="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">High</span>`;
  if (p === 'medium') return `<span class="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Medium</span>`;
  return `<span class="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Low</span>`;
}

function deadlineAlert(deadline) {
  if (!deadline) return '';
  const diff = getDaysDiff(deadline);
  const warningSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
  const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>`;

  if (diff < 0) return `<span class="flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">${warningSvg} Overdue by ${Math.abs(diff)}d</span>`;
  if (diff === 0) return `<span class="flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">${warningSvg} Due Today</span>`;
  if (diff === 1) return `<span class="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">${calendarSvg} Due Tomorrow</span>`;
  return `<span class="flex items-center gap-1 text-slate-500 bg-slate-50 border border-slate-200/50 rounded-md px-1.5 py-0.5 text-[10px]">${calendarSvg} ${diff} days left (${deadline})</span>`;
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
  const total = state.tasks.length;
  const overdue = getOverdueCount();
  const overdueChip = overdue > 0
    ? `<div class="bg-rose-500/10 border border-rose-500/20 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
         <span class="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
         <span class="text-rose-300 font-semibold">Overdue:</span>
         <span class="font-mono font-bold text-rose-100">${overdue}</span>
       </div>` : '';

  document.getElementById('app-header').innerHTML = `
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl overflow-hidden shadow-lg shadow-[#3BBDE5]/10 bg-slate-850 flex items-center justify-center shrink-0 border border-slate-700">
          <img src="time-svgrepo-com.svg" alt="Logo" class="h-full w-full object-cover" />
        </div>
        <div>
          <h1 class="text-base font-extrabold tracking-tight text-white">Project Tracker</h1>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
          <span class="h-2 w-2 rounded-full bg-[#3BBDE5]"></span>
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
    { id: 'board', label: 'Task Kanban Board' },
    { id: 'deadlines', label: 'Urgent Deadlines Tracker' },
  ];
  document.getElementById('tab-nav').innerHTML = tabs.map(tab => `
    <button data-tab="${tab.id}" class="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${state.activeTab === tab.id
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
  const statuses = ['todo', 'in_progress', 'review', 'done'];
  const cols = [
    { status: 'todo', label: 'To Do', hBg: 'bg-slate-100', tC: 'text-slate-700' },
    { status: 'in_progress', label: 'In Progress', hBg: 'bg-indigo-50/70 border border-indigo-100/50', tC: 'text-indigo-800' },
    { status: 'review', label: 'Under Review', hBg: 'bg-amber-50/70 border border-amber-100/50', tC: 'text-amber-800' },
    { status: 'done', label: 'Completed', hBg: 'bg-emerald-50/70 border border-emerald-100/50', tC: 'text-emerald-800' },
  ];

  const filtered = state.tasks.filter(t => {
    const mp = state.activeProjectId === 'all' || t.project_id === state.activeProjectId;
    const ms = !state.searchQuery || t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(state.searchQuery.toLowerCase());
    const mpr = state.priorityFilter === 'all' || t.priority === state.priorityFilter;
    return mp && ms && mpr;
  });

  const activeProj = state.projects.find(p => p.id === state.activeProjectId);
  const projDesc = (state.activeProjectId !== 'all' && activeProj)
    ? `<div class="mt-4 pt-4 border-t border-slate-100 flex items-start justify-between gap-4">
         <div class="text-slate-600 leading-relaxed text-xs flex-1">${esc(activeProj.description || '')}</div>
         <div class="flex gap-2 shrink-0">
           <button data-action="edit-project" data-id="${activeProj.id}" class="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors">Edit Project</button>
           <button data-action="delete-project" data-id="${activeProj.id}" class="text-[11px] px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded transition-colors">Delete Project</button>
         </div>
       </div>` : '';

  const projTabs = [
    `<button data-projid="all" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${state.activeProjectId === 'all' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}">All Projects</button>`,
    ...state.projects.map(p => `<button data-projid="${p.id}" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${state.activeProjectId === p.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}">${esc(p.name)}</button>`),
    `<button id="btn-new-project" class="px-2.5 py-1.5 text-xs font-semibold border border-dashed border-slate-300 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>New Project</button>`,
  ].join('');

  const cardHtml = (task) => {
    const proj = state.projects.find(p => p.id === task.project_id);
    const projTag = (proj && state.activeProjectId === 'all')
      ? `<span class="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">${esc(proj.name)}</span>` : '';
    const idx = statuses.indexOf(task.status);
    const ml = idx > 0 ? `<button data-action="move" data-id="${task.id}" data-target="${statuses[idx - 1]}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Move back"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>` : '';
    const mr = idx < 3 ? `<button data-action="move" data-id="${task.id}" data-target="${statuses[idx + 1]}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Move forward"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>` : '';
    return `
      <div class="bg-white border border-slate-150 rounded-lg p-3 hover:shadow-md transition-all space-y-2 relative group">
        <div class="flex justify-between items-start gap-1">${projTag}<div class="flex gap-1 items-center ml-auto">${priorityBadge(task.priority)}</div></div>
        <h4 class="text-xs font-bold text-slate-900 leading-snug break-words">${esc(task.title)}</h4>
        ${task.description ? `<p class="text-[11px] text-slate-500 leading-relaxed line-clamp-3 break-words">${esc(task.description)}</p>` : ''}
        <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-50 items-center justify-between">
          ${deadlineAlert(task.deadline)}
          <div class="flex gap-1.5">${ml}${mr}
            <button data-action="edit-task" data-id="${task.id}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors opacity-70 group-hover:opacity-100" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button>
            <button data-action="delete" data-id="${task.id}" class="p-1 border border-slate-200 rounded text-red-500 hover:bg-red-50 transition-colors opacity-70 group-hover:opacity-100" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" /></svg>
              <input id="search-input" type="text" placeholder="Search board tasks..." value="${esc(state.searchQuery)}"
                class="pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-48 text-slate-800" />
            </div>
            <div class="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <select id="priority-filter" class="bg-transparent border-0 text-xs font-semibold focus:outline-none text-slate-700 pr-1">
                <option value="all"   ${state.priorityFilter === 'all' ? 'selected' : ''}>Any Priority</option>
                <option value="high"  ${state.priorityFilter === 'high' ? 'selected' : ''}>High Priority</option>
                <option value="medium"${state.priorityFilter === 'medium' ? 'selected' : ''}>Medium Priority</option>
                <option value="low"   ${state.priorityFilter === 'low' ? 'selected' : ''}>Low Priority</option>
              </select>
            </div>
            <button id="btn-add-task" class="bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Add Task</button>
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
  document.querySelectorAll('[data-action="edit-task"]').forEach(btn =>
    btn.addEventListener('click', () => openEditTaskModal(btn.dataset.id))
  );
  document.querySelectorAll('[data-action="edit-project"]').forEach(btn =>
    btn.addEventListener('click', () => openEditProjectModal(btn.dataset.id))
  );
  document.querySelectorAll('[data-action="delete-project"]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;
      try { await apiDeleteProject(btn.dataset.id); render(); }
      catch (e) { alert('Failed to delete project: ' + e.message); }
    })
  );
}

// ─── Render: Deadlines Tracker ────────────────────────────────────────────────
function renderDeadlines() {
  const withDeadlines = state.tasks.filter(t => !!t.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const overdue = [], activeSoon = [], future = [], completed = [];
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
    if (d < 0) return `Overdue by ${Math.abs(d)} days`;
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    return `Due in ${d} days`;
  }
  function statusBadge(s) {
    const m = { in_progress: 'bg-indigo-50 border border-indigo-200 text-indigo-700', review: 'bg-amber-50 border border-amber-200 text-amber-700', done: 'bg-emerald-50 border border-emerald-200 text-emerald-700', todo: 'bg-slate-100 border border-slate-200 text-slate-600' };
    return `<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${m[s] || m.todo}">${s.replace('_', ' ')}</span>`;
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
          <span class="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-600 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-slate-400"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>${task.deadline}</span>
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

  const fireSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>`;
  const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>`;
  const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>`;
  const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

  document.getElementById('tab-content').innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-slate-150 p-6 space-y-6">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-indigo-600 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Critical Milestones &amp; Deadlines Tracker</h2>
        <p class="text-xs text-slate-500 mt-1">Chronologically monitors active items to ensure coursework requirements are never submitted overdue.</p>
      </div>
      <div class="space-y-6">
        ${overdue.length > 0 ? section('Overdue Actions', fireSvg, 'text-rose-700 bg-rose-50 border border-rose-100', overdue, 'bg-rose-500 text-white border-rose-600', '') : ''}
        ${section('Due This Week', alertSvg, 'text-amber-700 bg-amber-50 border border-amber-100', activeSoon, 'bg-amber-500 text-white border-amber-600', 'No deadlines active within the next 7 days.')}
        ${section('Future Deadlines', calendarSvg, 'text-slate-700 bg-slate-100 border border-slate-200', future, 'bg-indigo-100 text-indigo-800 border-indigo-200', 'No other future deadlines configured.')}
        ${section('Saved / Completed', checkSvg, 'text-emerald-700 bg-emerald-50 border border-emerald-100', completed, 'bg-emerald-500 text-white border-emerald-600', 'Completed tasks with deadlines will settle here.')}
      </div>
    </div>`;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openProjectModal() {
  document.getElementById('modal-project-title').textContent = 'Create New Course Project';
  document.getElementById('proj-id').value = '';
  document.getElementById('proj-name').value = '';
  document.getElementById('proj-desc').value = '';
  document.getElementById('proj-name-error').classList.add('hidden');
  const m = document.getElementById('modal-project');
  m.classList.remove('hidden'); m.classList.add('flex');
  document.getElementById('proj-name').focus();
}
function openEditProjectModal(id) {
  const p = state.projects.find(p => p.id === id);
  if (!p) return;
  document.getElementById('modal-project-title').textContent = 'Edit Course Project';
  document.getElementById('proj-id').value = p.id;
  document.getElementById('proj-name').value = p.name;
  document.getElementById('proj-desc').value = p.description || '';
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
  document.getElementById('modal-task-title').textContent = 'Record New Tracked Task';
  document.getElementById('task-id').value = '';
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-deadline').value = '';
  document.getElementById('task-title-error').classList.add('hidden');
  const sel = document.getElementById('task-project');
  sel.innerHTML = state.projects.map(p =>
    `<option value="${p.id}" ${(state.activeProjectId !== 'all' && state.activeProjectId === p.id) ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
  document.getElementById('task-priority').value = 'low';
  document.getElementById('task-status').value = 'todo';
  const m = document.getElementById('modal-task');
  m.classList.remove('hidden'); m.classList.add('flex');
  document.getElementById('task-title').focus();
}
function openEditTaskModal(id) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  document.getElementById('modal-task-title').textContent = 'Edit Tracked Task';
  document.getElementById('task-id').value = t.id;
  document.getElementById('task-title').value = t.title;
  document.getElementById('task-desc').value = t.description || '';
  document.getElementById('task-deadline').value = t.deadline || '';
  document.getElementById('task-title-error').classList.add('hidden');
  const sel = document.getElementById('task-project');
  sel.innerHTML = state.projects.map(p =>
    `<option value="${p.id}" ${t.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
  document.getElementById('task-priority').value = t.priority;
  document.getElementById('task-status').value = t.status;
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
document.getElementById('modal-project').addEventListener('click', e => { if (e.target === e.currentTarget) closeProjectModal(); });
document.getElementById('modal-task').addEventListener('click', e => { if (e.target === e.currentTarget) closeTaskModal(); });

document.getElementById('form-project').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('proj-id').value;
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { document.getElementById('proj-name-error').classList.remove('hidden'); return; }
  try {
    if (id) {
      await apiUpdateProject(id, name, document.getElementById('proj-desc').value.trim());
    } else {
      await apiCreateProject(name, document.getElementById('proj-desc').value.trim());
    }
    closeProjectModal(); render();
  } catch (err) { alert('Failed to save project: ' + err.message); }
});

document.getElementById('form-task').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  if (!title) { document.getElementById('task-title-error').classList.remove('hidden'); return; }

  const taskData = {
    projectId: document.getElementById('task-project').value,
    title,
    description: document.getElementById('task-desc').value.trim(),
    deadline: document.getElementById('task-deadline').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
  };

  try {
    if (id) {
      await apiFullUpdateTask(id, taskData);
    } else {
      await apiCreateTask(taskData);
    }
    closeTaskModal(); render();
  } catch (err) { alert('Failed to save task: ' + err.message); }
});

// ─── Orchestrator & Init ──────────────────────────────────────────────────────
function render() {
  renderHeader();
  renderTabNav();
  if (state.activeTab === 'board') renderKanbanBoard();
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
