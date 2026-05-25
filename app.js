// ─────────────────────────────────────────────────────────────
// SECTION 1: APP STATE
// One central object that holds everything the app needs to know:
// the list of projects, tasks, which tab is active, which project
// is selected, the current search text, priority filter, and the
// logged-in user. Everything reads from and writes to this object.
// ─────────────────────────────────────────────────────────────
const state = {
  projects:        [],
  tasks:           [],
  activeTab:       'board',   // 'board' | 'deadlines'
  activeProjectId: 'all',
  searchQuery:     '',
  priorityFilter:  'all',     // 'all' | 'low' | 'medium' | 'high'
  user:            null,      // { id, username } if logged in
  authMode:        'login',   // 'login' | 'register'
};

// The base URL for all backend requests.
const BACKEND_URL = 'backend.php';

// ─────────────────────────────────────────────────────────────
// SECTION 2: API HELPERS
// These functions talk to backend.php. They handle sending
// requests, parsing the JSON response, and catching errors.
// ─────────────────────────────────────────────────────────────

// request — the core request function.
// If a body is passed it sends a POST with JSON, otherwise a GET.
// Includes session cookies so PHP knows who's logged in.
// If the server says 401 (not logged in), it shows the login modal.
async function request(action, body = null) {
  const url  = `${BACKEND_URL}?action=${action}`;
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include' // crucial for PHP Session cookies!
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res  = await fetch(url, opts);
  const json = await res.json();
  
  // Session expired or user not logged in — show login screen.
  if (res.status === 401) {
    showAuthModal();
    throw new Error('Session expired or unauthorized. Please log in.');
  }
  
  if (!res.ok) throw new Error(json.error || 'API error');
  return json;
}

// loadData — fetches all projects and tasks for the logged-in user
// at once and stores them in state.
async function loadData() {
  const [projects, tasks] = await Promise.all([request('projects'), request('tasks')]);
  state.projects = projects;
  state.tasks    = tasks;
}

// createProject — sends a new project to the backend,
// then immediately adds it to state so the UI updates without a reload.
async function createProject(name, description) {
  const id = `proj-${Date.now()}`;
  await request('create_project', { id, name, description });
  state.projects.push({ id, name, description, created_at: new Date().toISOString() });
}

// createTask — sends a new task to the backend,
// then pushes it into state.tasks right away.
async function createTask(taskData) {
  const id = `task-${Date.now()}`;
  await request('create_task', { id, ...taskData });
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

// updateTask — moves a task to a new status column (e.g. todo → in_progress).
// Updates the backend and the local state copy.
async function updateTask(id, status) {
  await request('update_task', { id, status });
  const t = state.tasks.find(t => t.id === id);
  if (t) t.status = status;
}

// fullUpdateTask — saves all editable fields of a task (used by the Edit form).
// Updates the backend and patches the matching task in state.
async function fullUpdateTask(id, taskData) {
  await request('update_task', { id, ...taskData });
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

// deleteTask — deletes a task from the backend and removes it from state.
async function deleteTask(id) {
  await request('delete_task', { id });
  state.tasks = state.tasks.filter(t => t.id !== id);
}

// updateProject — saves an edited project name/description to the backend
// and updates the local state copy.
async function updateProject(id, name, description) {
  await request('update_project', { id, name, description });
  const p = state.projects.find(p => p.id === id);
  if (p) {
    p.name = name;
    p.description = description;
  }
}

// deleteProject — deletes a project and all its tasks from the backend.
// Also cleans them out of state, and resets the active project tab to "All".
async function deleteProject(id) {
  await request('delete_project', { id });
  state.projects = state.projects.filter(p => p.id !== id);
  state.tasks = state.tasks.filter(t => t.project_id !== id);
  if (state.activeProjectId === id) state.activeProjectId = 'all';
}

// ─────────────────────────────────────────────────────────────
// SECTION 3: UTILITY HELPERS
// Small reusable functions used across the rendering code.
// ─────────────────────────────────────────────────────────────

// getDaysDiff — returns how many days until (or since) a deadline.
// Negative = overdue. Uses local midnight to avoid timezone issues.
function getDaysDiff(deadlineStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [y, m, d] = deadlineStr.split('-').map(Number);
  const due = new Date(y, m - 1, d); // local midnight — avoids UTC-shift on ISO strings
  return Math.ceil((due - today) / 86400000);
}

// getOverdueCount — counts tasks that are not done and past their deadline.
function getOverdueCount() {
  return state.tasks.filter(t => {
    if (t.status === 'done' || !t.deadline) return false;
    return getDaysDiff(t.deadline) < 0;
  }).length;
}

// priorityBadge — returns a colored HTML badge for a task's priority level.
function priorityBadge(p) {
  if (p === 'high')   return `<span class="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">High</span>`;
  if (p === 'medium') return `<span class="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Medium</span>`;
  return `<span class="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Low</span>`;
}

// deadlineAlert — returns a colored HTML chip showing deadline urgency.
// Red = overdue or due today, amber = due tomorrow, gray = future.
function deadlineAlert(deadline) {
  if (!deadline) return '';
  const diff = getDaysDiff(deadline);
  const warningSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>`;
  const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>`;

  if (diff < 0)   return `<span class="flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">${warningSvg} Overdue by ${Math.abs(diff)}d</span>`;
  if (diff === 0) return `<span class="flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">${warningSvg} Due Today</span>`;
  if (diff === 1) return `<span class="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">${calendarSvg} Due Tomorrow</span>`;
  return `<span class="flex items-center gap-1 text-slate-500 bg-slate-50 border border-slate-200/50 rounded-md px-1.5 py-0.5 text-[10px]">${calendarSvg} ${diff} days left (${deadline})</span>`;
}

// esc — escapes user-supplied text before injecting it into HTML.
// Prevents XSS attacks (e.g. a task title containing <script>).
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ─────────────────────────────────────────────────────────────
// SECTION 4: RENDER — HEADER
// Builds and injects the top navigation bar HTML.
// Shows the app logo, project/task counts, overdue warning chip,
// and the logged-in user's avatar + Sign Out button.
// ─────────────────────────────────────────────────────────────
function renderHeader() {
  const completed = state.tasks.filter(t => t.status === 'done').length;
  const total     = state.tasks.length;
  const overdue   = getOverdueCount();

  // Only show the red overdue chip if there are overdue tasks.
  const overdueChip = overdue > 0
    ? `<div class="bg-rose-500/10 border border-rose-500/20 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
         <span class="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
         <span class="text-rose-300 font-semibold">Overdue:</span>
         <span class="font-mono font-bold text-rose-100">${overdue}</span>
       </div>` : '';

  // Show the user widget only if someone is logged in.
  const userWidget = state.user
    ? `<div class="flex items-center gap-2 bg-slate-850/80 border border-slate-700 rounded-xl py-1 px-2.5 text-xs text-slate-300 select-none">
         <div class="h-6 w-6 rounded-lg bg-[#2E7D9B] text-white font-extrabold flex items-center justify-center text-[10px] uppercase shadow shadow-[#3BBDE5]/20">
           ${esc(state.user.username.substring(0, 2))}
         </div>
         <span class="font-semibold text-[11px] text-slate-200 max-w-[80px] truncate">${esc(state.user.username)}</span>
         <button id="btn-logout" class="ml-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded transition-all border border-rose-500/20">Sign Out</button>
       </div>`
    : '';

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
        ${userWidget}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// SECTION 5: RENDER — TAB NAVIGATION
// Builds the two main tabs: "Task Kanban Board" and
// "Urgent Deadlines Tracker". Highlights the active one
// and attaches click listeners to switch between them.
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// SECTION 6: RENDER — KANBAN BOARD
// The main view. Builds the 4-column board (To Do, In Progress,
// Under Review, Completed), applies the active filters
// (project, search, priority), renders each task as a card,
// and wires up all the buttons (move, edit, delete, filters).
// ─────────────────────────────────────────────────────────────
function renderKanbanBoard() {
  const statuses = ['todo','in_progress','review','done'];
  // Column definitions — each has a status key, a display label, and color classes.
  const cols = [
    { status:'todo',        label:'To Do',         hBg:'bg-slate-100',                                 tC:'text-slate-700'  },
    { status:'in_progress', label:'In Progress',   hBg:'bg-indigo-50/70 border border-indigo-100/50',  tC:'text-indigo-800' },
    { status:'review',      label:'Under Review',  hBg:'bg-amber-50/70 border border-amber-100/50',    tC:'text-amber-800'  },
    { status:'done',        label:'Completed',     hBg:'bg-emerald-50/70 border border-emerald-100/50',tC:'text-emerald-800'},
  ];

  // Filter tasks by the active project, search text, and priority filter.
  const filtered = state.tasks.filter(t => {
    const mp = state.activeProjectId === 'all' || t.project_id === state.activeProjectId;
    const ms = !state.searchQuery || t.title.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
               (t.description||'').toLowerCase().includes(state.searchQuery.toLowerCase());
    const mpr = state.priorityFilter === 'all' || t.priority === state.priorityFilter;
    return mp && ms && mpr;
  });

  // If a specific project is selected, show its description + Edit/Delete buttons.
  const activeProj = state.projects.find(p => p.id === state.activeProjectId);
  const projDesc = (state.activeProjectId !== 'all' && activeProj)
    ? `<div class="mt-4 pt-4 border-t border-slate-100 flex items-start justify-between gap-4">
         <div class="text-slate-600 leading-relaxed text-xs flex-1">${esc(activeProj.description || '')}</div>
         <div class="flex gap-2 shrink-0">
           <button data-action="edit-project" data-id="${activeProj.id}" class="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors">Edit Project</button>
           <button data-action="delete-project" data-id="${activeProj.id}" class="text-[11px] px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded transition-colors">Delete Project</button>
         </div>
       </div>` : '';

  // Build the project filter pill buttons ("All Projects", each project, "+ New Project").
  const projTabs = [
    `<button data-projid="all" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${state.activeProjectId==='all'?'bg-slate-900 text-white shadow':'text-slate-600 hover:bg-slate-50'}">All Projects</button>`,
    ...state.projects.map(p => `<button data-projid="${p.id}" class="px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${state.activeProjectId===p.id?'bg-indigo-600 text-white shadow':'text-slate-600 hover:bg-slate-50'}">${esc(p.name)}</button>`),
    `<button id="btn-new-project" class="px-2.5 py-1.5 text-xs font-semibold border border-dashed border-slate-300 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 mr-1"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>New Project</button>`,
  ].join('');

  // cardHtml — builds the HTML for a single task card.
  // Shows the project tag (if viewing "All"), priority badge,
  // title, description, deadline chip, and move/edit/delete buttons.
  const cardHtml = (task) => {
    const proj = state.projects.find(p => p.id === task.project_id);
    const projTag = (proj && state.activeProjectId === 'all')
      ? `<span class="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">${esc(proj.name)}</span>` : '';
    const idx = statuses.indexOf(task.status);
    // Left arrow button — only shown if not already in the first column.
    const ml = idx > 0 ? `<button data-action="move" data-id="${task.id}" data-target="${statuses[idx-1]}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Move back"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>` : '';
    // Right arrow button — only shown if not already in the last column.
    const mr = idx < 3 ? `<button data-action="move" data-id="${task.id}" data-target="${statuses[idx+1]}" class="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title="Move forward"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>` : '';
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

  // colHtml — builds one full Kanban column with its header and task cards.
  // Shows a placeholder message if the column is empty.
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

  // Inject the full board HTML: toolbar (project tabs, search, filter, add button) + 4 columns.
  document.getElementById('tab-content').innerHTML = `
    <div class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm border border-slate-150 p-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">${projTabs}</div>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div class="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" /></svg>
              <input id="search-input" type="text" placeholder="Search board tasks..." value="${esc(state.searchQuery)}"
                class="pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#3BBDE5]/20 focus:border-[#3BBDE5] transition-all w-full sm:w-48 text-slate-800" />
            </div>
            <div class="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <select id="priority-filter" class="bg-transparent border-0 text-xs font-semibold focus:outline-none text-slate-700 pr-1">
                <option value="all"   ${state.priorityFilter==='all'   ?'selected':''}>Any Priority</option>
                <option value="high"  ${state.priorityFilter==='high'  ?'selected':''}>High Priority</option>
                <option value="medium"${state.priorityFilter==='medium'?'selected':''}>Medium Priority</option>
                <option value="low"   ${state.priorityFilter==='low'   ?'selected':''}>Low Priority</option>
              </select>
            </div>
            <button id="btn-add-task" class="bg-[#2E7D9B] text-white hover:bg-[#3BBDE5] transition-all shadow px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>Add Task</button>
          </div>
        </div>
        ${projDesc}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">${statuses.map(s => colHtml(cols.find(c=>c.status===s))).join('')}</div>
    </div>`;

  // ── Board event listeners ──────────────────────────────────
  // Attach click handlers to all interactive elements after rendering.

  // Project filter pills — switch the active project and re-render the board.
  document.querySelectorAll('[data-projid]').forEach(btn =>
    btn.addEventListener('click', () => { state.activeProjectId = btn.dataset.projid; renderKanbanBoard(); })
  );
  document.getElementById('btn-new-project')?.addEventListener('click', openProjectModal);
  document.getElementById('btn-add-task')?.addEventListener('click', openTaskModal);

  // Search box — update state and re-render on every keystroke.
  document.getElementById('search-input')?.addEventListener('input', e => { state.searchQuery = e.target.value; renderKanbanBoard(); });

  // Priority dropdown — update state and re-render on change.
  document.getElementById('priority-filter')?.addEventListener('change', e => { state.priorityFilter = e.target.value; renderKanbanBoard(); });

  // Move arrow buttons — update the task status and re-render.
  document.querySelectorAll('[data-action="move"]').forEach(btn =>
    btn.addEventListener('click', async () => {
      try { await updateTask(btn.dataset.id, btn.dataset.target); render(); }
      catch (e) { alert('Failed to update: ' + e.message); }
    })
  );

  // Delete task buttons — confirm first, then delete and re-render.
  document.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try { await deleteTask(btn.dataset.id); render(); }
      catch (e) { alert('Failed to delete: ' + e.message); }
    })
  );

  // Edit task buttons — open the task modal prefilled with existing data.
  document.querySelectorAll('[data-action="edit-task"]').forEach(btn =>
    btn.addEventListener('click', () => openEditTaskModal(btn.dataset.id))
  );

  // Edit project button — open the project modal prefilled.
  document.querySelectorAll('[data-action="edit-project"]').forEach(btn =>
    btn.addEventListener('click', () => openEditProjectModal(btn.dataset.id))
  );

  // Delete project button — confirm, then delete project + its tasks.
  document.querySelectorAll('[data-action="delete-project"]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;
      try { await deleteProject(btn.dataset.id); render(); }
      catch (e) { alert('Failed to delete project: ' + e.message); }
    })
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 7: RENDER — DEADLINES TRACKER
// Shows all tasks that have a deadline, grouped into 4 buckets:
// Overdue, Due This Week, Future, and Completed.
// Sorted by date so the most urgent always appears first.
// ─────────────────────────────────────────────────────────────
function renderDeadlines() {
  // Get all tasks with a deadline, sorted soonest first.
  const withDeadlines = state.tasks.filter(t => !!t.deadline)
    .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

  // Split tasks into the four urgency buckets.
  const overdue=[], activeSoon=[], future=[], completed=[];
  withDeadlines.forEach(t => {
    if (t.status === 'done') { completed.push(t); return; }
    const diff = getDaysDiff(t.deadline);
    if (diff < 0) overdue.push(t);
    else if (diff <= 7) activeSoon.push(t);
    else future.push(t);
  });

  // cdText — human-readable deadline label for each task row.
  function cdText(t) {
    if (t.status === 'done') return 'Completed';
    const d = getDaysDiff(t.deadline);
    if (d < 0)  return `Overdue by ${Math.abs(d)} days`;
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    return `Due in ${d} days`;
  }

  // statusBadge — colored pill showing a task's current status.
  function statusBadge(s) {
    const m = { in_progress:'bg-indigo-50 border border-indigo-200 text-indigo-700', review:'bg-amber-50 border border-amber-200 text-amber-700', done:'bg-emerald-50 border border-emerald-200 text-emerald-700', todo:'bg-slate-100 border border-slate-200 text-slate-600' };
    return `<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${m[s]||m.todo}">${s.replace('_',' ')}</span>`;
  }

  // row — builds one task row in the deadlines list.
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

  // section — wraps a group of task rows under a titled header.
  function section(title, icon, bgCls, items, badgeCls, emptyMsg) {
    return `
      <div class="space-y-2.5">
        <h3 class="text-xs font-bold flex items-center gap-1.5 rounded-lg px-3 py-1.5 w-max ${bgCls}">${icon} ${title} (${items.length})</h3>
        ${items.length === 0
          ? `<p class="text-xs text-slate-400 italic pl-2 py-2">${emptyMsg}</p>`
          : `<div class="space-y-2">${items.map(t => row(t, badgeCls)).join('')}</div>`}
      </div>`;
  }

  // SVG icons used for each section header.
  const fireSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>`;
  const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>`;
  const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>`;
  const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

  // Inject the full deadlines page HTML with all 4 sections.
  document.getElementById('tab-content').innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-slate-150 p-6 space-y-6">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 text-indigo-600 mr-2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Critical Milestones &amp; Deadlines Tracker</h2>
        <p class="text-xs text-slate-500 mt-1">Chronologically monitors active items to ensure coursework requirements are never submitted overdue.</p>
      </div>
      <div class="space-y-6">
        ${overdue.length > 0 ? section('Overdue Actions',fireSvg,'text-rose-700 bg-rose-50 border border-rose-100',overdue,'bg-rose-500 text-white border-rose-600','') : ''}
        ${section('Due This Week',alertSvg,'text-amber-700 bg-amber-50 border border-amber-100',activeSoon,'bg-amber-500 text-white border-amber-600','No deadlines active within the next 7 days.')}
        ${section('Future Deadlines',calendarSvg,'text-slate-700 bg-slate-100 border border-slate-200',future,'bg-indigo-100 text-indigo-800 border-indigo-200','No other future deadlines configured.')}
        ${section('Saved / Completed',checkSvg,'text-emerald-700 bg-emerald-50 border border-emerald-100',completed,'bg-emerald-500 text-white border-emerald-600','Completed tasks with deadlines will settle here.')}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// SECTION 8: MODALS — OPEN / CLOSE
// Functions to show and hide the Project and Task modals.
// "Open" clears/prefills the form fields and makes the modal visible.
// "Edit" versions find the existing item in state and prefill values.
// "Close" just hides the modal again.
// ─────────────────────────────────────────────────────────────

// openProjectModal — blank form for creating a new project.
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

// openEditProjectModal — prefills the form with an existing project's data.
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

// closeProjectModal — hides the project modal.
function closeProjectModal() {
  const m = document.getElementById('modal-project');
  m.classList.add('hidden'); m.classList.remove('flex');
}

// openTaskModal — blank form for creating a new task.
// Populates the project dropdown and blocks creation if no projects exist.
function openTaskModal() {
  if (!state.projects.length) {
    alert('Please create a project first before adding tasks.');
    return;
  }
  document.getElementById('modal-task-title').textContent = 'Record New Tracked Task';
  document.getElementById('task-id').value = '';
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

// openEditTaskModal — prefills the task form with an existing task's data.
function openEditTaskModal(id) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  document.getElementById('modal-task-title').textContent = 'Edit Tracked Task';
  document.getElementById('task-id').value = t.id;
  document.getElementById('task-title').value   = t.title;
  document.getElementById('task-desc').value    = t.description || '';
  document.getElementById('task-deadline').value = t.deadline || '';
  document.getElementById('task-title-error').classList.add('hidden');
  const sel = document.getElementById('task-project');
  sel.innerHTML = state.projects.map(p =>
    `<option value="${p.id}" ${t.project_id === p.id ? 'selected':''}>${esc(p.name)}</option>`
  ).join('');
  document.getElementById('task-priority').value = t.priority;
  document.getElementById('task-status').value   = t.status;
  const m = document.getElementById('modal-task');
  m.classList.remove('hidden'); m.classList.add('flex');
  document.getElementById('task-title').focus();
}

// closeTaskModal — hides the task modal.
function closeTaskModal() {
  const m = document.getElementById('modal-task');
  m.classList.add('hidden'); m.classList.remove('flex');
}

// ─────────────────────────────────────────────────────────────
// SECTION 9: MODAL FORM LISTENERS
// Wires up the Cancel buttons and backdrop clicks to close modals,
// and handles form submissions for creating/editing projects and tasks.
// ─────────────────────────────────────────────────────────────

// Cancel buttons and clicking the dark backdrop close the modals.
document.getElementById('btn-cancel-project').addEventListener('click', closeProjectModal);
document.getElementById('btn-cancel-task').addEventListener('click', closeTaskModal);
document.getElementById('modal-project').addEventListener('click', e => { if (e.target===e.currentTarget) closeProjectModal(); });
document.getElementById('modal-task').addEventListener('click', e => { if (e.target===e.currentTarget) closeTaskModal(); });

// Project form submit — creates a new project or updates an existing one.
// The hidden proj-id field tells us which mode we're in.
document.getElementById('form-project').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('proj-id').value;
  const name = document.getElementById('proj-name').value.trim();
  if (!name) { document.getElementById('proj-name-error').classList.remove('hidden'); return; }
  try {
    if (id) {
      await updateProject(id, name, document.getElementById('proj-desc').value.trim());
    } else {
      await createProject(name, document.getElementById('proj-desc').value.trim());
    }
    closeProjectModal(); render();
  } catch (err) { alert('Failed to save project: ' + err.message); }
});

// Task form submit — creates a new task or saves edits to an existing one.
// The hidden task-id field tells us which mode we're in.
document.getElementById('form-task').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  if (!title) { document.getElementById('task-title-error').classList.remove('hidden'); return; }
  
  // Collect all form values into one object to send to the API.
  const taskData = {
    projectId:   document.getElementById('task-project').value,
    title,
    description: document.getElementById('task-desc').value.trim(),
    deadline:    document.getElementById('task-deadline').value,
    priority:    document.getElementById('task-priority').value,
    status:      document.getElementById('task-status').value,
  };
  
  try {
    if (id) {
      await fullUpdateTask(id, taskData);
    } else {
      await createTask(taskData);
    }
    closeTaskModal(); render();
  } catch (err) { alert('Failed to save task: ' + err.message); }
});

// ─────────────────────────────────────────────────────────────
// SECTION 10: AUTHENTICATION
// Handles showing/hiding the login modal, switching between
// Login and Register modes, submitting credentials, and logging out.
// ─────────────────────────────────────────────────────────────

// showAuthModal — makes the login/register overlay visible.
function showAuthModal() {
  const m = document.getElementById('modal-auth');
  m.classList.remove('hidden');
  m.classList.add('flex');
  document.getElementById('auth-error').classList.add('hidden');
  updateAuthFormUI();
}

// hideAuthModal — hides the login/register overlay.
function hideAuthModal() {
  const m = document.getElementById('modal-auth');
  m.classList.remove('flex');
  m.classList.add('hidden');
}

// updateAuthFormUI — updates the modal labels, button text, and visible fields
// based on whether we're in "login" or "register" mode.
function updateAuthFormUI() {
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const submitBtn = document.getElementById('btn-auth-submit');
  const emailGroup = document.getElementById('auth-email-group');
  const emailInput = document.getElementById('auth-email');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');

  if (state.authMode === 'login') {
    // Login mode — hide the email field, update text.
    title.textContent = 'Sign In';
    subtitle.textContent = 'Access your Project Tracker board';
    submitBtn.textContent = 'Sign In';
    emailGroup.classList.add('hidden');
    emailInput.removeAttribute('required');

    tabLogin.className = "flex-1 text-xs font-bold py-1.5 rounded-md bg-white text-slate-900 shadow-sm transition-all focus:outline-none";
    tabRegister.className = "flex-1 text-xs font-bold py-1.5 rounded-md text-slate-500 hover:text-slate-900 transition-all focus:outline-none";
  } else {
    // Register mode — show the email field, update text.
    title.textContent = 'Create Account';
    subtitle.textContent = 'Start tracking your course milestones';
    submitBtn.textContent = 'Register Now';
    emailGroup.classList.remove('hidden');
    emailInput.setAttribute('required', 'true');

    tabRegister.className = "flex-1 text-xs font-bold py-1.5 rounded-md bg-white text-slate-900 shadow-sm transition-all focus:outline-none";
    tabLogin.className = "flex-1 text-xs font-bold py-1.5 rounded-md text-slate-500 hover:text-slate-900 transition-all focus:outline-none";
  }
}

// bindAuthEvents — attaches event listeners for the auth modal buttons and form.
// Uses a flag so it only runs once, even if called multiple times.
let authEventsBound = false;
function bindAuthEvents() {
  if (authEventsBound) return;
  authEventsBound = true;

  // Switch between Login and Register tabs.
  document.getElementById('tab-btn-login')?.addEventListener('click', () => {
    state.authMode = 'login';
    updateAuthFormUI();
  });
  document.getElementById('tab-btn-register')?.addEventListener('click', () => {
    state.authMode = 'register';
    updateAuthFormUI();
  });

  // Auth form submit — calls login or register depending on mode.
  // On success, saves user to state, hides modal, loads data, and renders.
  document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('auth-email').value.trim();
    const errDiv = document.getElementById('auth-error');

    errDiv.classList.add('hidden');

    try {
      let res;
      if (state.authMode === 'login') {
        res = await request('login', { username, password });
      } else {
        res = await request('register', { username, email, password });
      }

      state.user = res.user;
      hideAuthModal();

      // Load the user's private data and render the full app.
      await loadData();
      render();
    } catch (err) {
      // Show the error message inside the modal (wrong password, etc.).
      errDiv.textContent = err.message || 'Authentication failed.';
      errDiv.classList.remove('hidden');
    }
  });
}

// handleLogout — confirms with the user, calls logout on the backend,
// clears all state, and shows the login modal again.
async function handleLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  try {
    await request('logout', {});
    state.user = null;
    state.projects = [];
    state.tasks = [];
    showAuthModal();
    document.getElementById('tab-content').innerHTML = '';
  } catch (err) {
    alert('Sign out failed: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION 11: ORCHESTRATOR & INIT
// render() is the main function that rebuilds the whole UI.
// init() is the entry point — it checks for an active session
// and either loads the app or shows the login screen.
// ─────────────────────────────────────────────────────────────

// render — rebuilds all visible UI: header, tab nav, and the active tab content.
// Called after any data change (create, update, delete, filter, login, logout).
function render() {
  renderHeader();
  renderTabNav();
  if (state.activeTab === 'board')     renderKanbanBoard();
  if (state.activeTab === 'deadlines') renderDeadlines();

  // Re-bind the logout button every render since the header is rebuilt each time.
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
}

// init — runs once on page load.
// Checks if the user already has a valid session (e.g. returning after a refresh).
// If yes: loads their data and renders the app.
// If no: shows the login modal.
async function init() {
  try {
    const session = await request('check_session');
    if (session.logged_in) {
      state.user = session.user;
      await loadData();
    } else {
      showAuthModal();
      bindAuthEvents();
      return;
    }
  } catch (e) {
    // If not logged in, request() triggers 401 and calls showAuthModal.
    bindAuthEvents();
    return;
  }
  
  bindAuthEvents();
  render();
}

// Start the app as soon as the page's HTML is fully loaded.
document.addEventListener('DOMContentLoaded', init);
