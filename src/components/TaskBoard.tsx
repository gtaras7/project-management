import React, { useState } from 'react';
import { Project, Task, TaskStatus, TaskPriority, PHPDatabaseConfig } from '../types';
import { Calendar, AlertTriangle, Play, HelpCircle, Check, Loader2, Plus, Trash2, ArrowRight, ArrowLeft, Search, SlidersHorizontal } from 'lucide-react';

interface TaskBoardProps {
  projects: Project[];
  tasks: Task[];
  activeProjectId: string | 'all';
  setActiveProjectId: (id: string | 'all') => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateProject: (name: string, description: string) => void;
}

export default function TaskBoard({
  projects,
  tasks,
  activeProjectId,
  setActiveProjectId,
  onAddTask,
  onUpdateStatus,
  onDeleteTask,
  onCreateProject,
}: TaskBoardProps) {
  // Task filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');

  // Input creation dialog control states
  const [showProjModal, setShowProjModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // New Project Form variables
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  // New Task Form variables
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProjId, setNewTaskProjId] = useState(projects[0]?.id || '');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('low');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  // Helper inside modals to pre-fill tasks
  const handleOpenTaskModalWithProj = () => {
    if (activeProjectId !== 'all') {
      setNewTaskProjId(activeProjectId);
    } else if (projects.length > 0) {
      setNewTaskProjId(projects[0].id);
    }
    setShowTaskModal(true);
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    onCreateProject(newProjName.trim(), newProjDesc.trim());
    setNewProjName('');
    setNewProjDesc('');
    setShowProjModal(false);
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskProjId) return;
    onAddTask({
      projectId: newTaskProjId,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      status: newTaskStatus,
      priority: newTaskPriority,
      deadline: newTaskDeadline, // format is YYYY-MM-DD
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDeadline('');
    setShowTaskModal(false);
  };

  // Filter tasks based on selected project, search text query, and priority filter
  const filteredTasks = tasks.filter((task) => {
    const matchesProject = activeProjectId === 'all' || task.projectId === activeProjectId;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesProject && matchesSearch && matchesPriority;
  });

  const columns: { status: TaskStatus; label: string; headerBg: string; textColor: string }[] = [
    { status: 'todo', label: 'To Do', headerBg: 'bg-slate-100', textColor: 'text-slate-700' },
    { status: 'in_progress', label: 'In Progress', headerBg: 'bg-indigo-50/70 border border-indigo-100/50', textColor: 'text-indigo-800' },
    { status: 'review', label: 'Under Review', headerBg: 'bg-amber-50/70 border border-amber-100/50', textColor: 'text-amber-800' },
    { status: 'done', label: 'Completed', headerBg: 'bg-emerald-50/70 border border-emerald-100/50', textColor: 'text-emerald-800' },
  ];

  // Helper function to render priority styling
  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">High</span>;
      case 'medium':
        return <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Medium</span>;
      default:
        return <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Low</span>;
    }
  };

  // Helper date status calculator
  const getDeadlineAlert = (dateStr: string) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(dateStr);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">
          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0 animate-pulse" />
          Overdue by {Math.abs(diffDays)}d
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">
          <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
          Due Today
        </span>
      );
    } else if (diffDays === 1) {
      return (
        <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 font-semibold text-[10px]">
          <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
          Due Tomorrow
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-200/50 rounded-md px-1.5 py-0.5 text-[10px]">
          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
          {diffDays} days left ({dateStr})
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Search filters, Project select rows */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-150 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              id="proj-tab-all"
              onClick={() => setActiveProjectId('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${
                activeProjectId === 'all'
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Projects
            </button>
            {projects.map((proj) => (
              <button
                id={`proj-tab-${proj.id}`}
                key={proj.id}
                onClick={() => setActiveProjectId(proj.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-nowrap transition-all ${
                  activeProjectId === proj.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {proj.name}
              </button>
            ))}
            <button
              id="open-proj-modal-btn"
              onClick={() => setShowProjModal(true)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-dashed border-slate-300 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Search query box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="search-tasks-input"
                type="text"
                placeholder="Search board tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-48 text-slate-800"
              />
            </div>

            {/* Priority filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="priority-filter-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="bg-transparent border-0 text-xs font-semibold focus:outline-none focus:ring-0 text-slate-700 outline-none pr-1 select-none"
              >
                <option value="all">Any Priority</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>

            <button
              id="add-task-btn"
              onClick={handleOpenTaskModalWithProj}
              className="bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow px-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {activeProjectId !== 'all' && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-slate-600 leading-relaxed text-xs">
            {projects.find((p) => p.id === activeProjectId)?.description || 'No description provided.'}
          </div>
        )}
      </div>

      {/* Task Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.status);

          return (
            <div key={col.status} className="bg-white/80 border border-slate-150 rounded-xl p-4 flex flex-col h-[520px] max-h-[600px]">
              <div className={`p-3 rounded-lg flex justify-between items-center mb-4 ${col.headerBg}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${col.textColor}`}>{col.label}</span>
                <span className="bg-white/90 shadow-sm border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                  {colTasks.length}
                </span>
              </div>

              {/* Scrollable list content */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {colTasks.length === 0 ? (
                  <div className="text-slate-400 text-center py-10 text-[11px] select-none border border-dashed border-slate-100 rounded-xl">
                    No active tasks here.
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const taskProj = projects.find((p) => p.id === task.projectId);

                    return (
                      <div
                        key={task.id}
                        className="bg-white border border-slate-150 rounded-lg p-3 hover:shadow-md transition-all space-y-2 relative group"
                      >
                        <div className="flex justify-between items-start gap-1">
                          {taskProj && activeProjectId === 'all' && (
                            <span className="bg-indigo-50 text-indigo-600 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                              {taskProj.name}
                            </span>
                          )}
                          <div className="flex gap-1 items-center ml-auto">
                            {getPriorityBadge(task.priority)}
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug break-words">
                          {task.title}
                        </h4>

                        {task.description && (
                          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3 break-words">
                            {task.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50 items-center justify-between">
                          {getDeadlineAlert(task.deadline)}
                          <div className="flex gap-1.5">
                            {/* Direction controls */}
                            {col.status !== 'todo' && (
                              <button
                                id={`move-left-${task.id}`}
                                onClick={() => {
                                  const list: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
                                  const idx = list.indexOf(task.status);
                                  onUpdateStatus(task.id, list[idx - 1]);
                                }}
                                className="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                                title="Move Previous Status"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}
                            {col.status !== 'done' && (
                              <button
                                id={`move-right-${task.id}`}
                                onClick={() => {
                                  const list: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
                                  const idx = list.indexOf(task.status);
                                  onUpdateStatus(task.id, list[idx + 1]);
                                }}
                                className="p-1 border border-slate-200 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                                title="Move Next Status"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              id={`delete-btn-${task.id}`}
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 border border-slate-200 rounded text-red-500 hover:bg-red-50 transition-colors opacity-70 group-hover:opacity-100"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: CREATE PROJECT */}
      {showProjModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Create New Course Project</h3>
            <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Project Title</label>
                <input
                  id="new-projects-title-input"
                  type="text"
                  placeholder="e.g. php-contact-form"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Project Goal Description</label>
                <textarea
                  id="new-projects-desc-input"
                  rows={3}
                  placeholder="Review relational dependencies, custom parameter bindings..."
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  id="close-proj-modal-btn"
                  type="button"
                  onClick={() => setShowProjModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-proj-modal-btn"
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-lg shadow"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TASK */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-100 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Record New Tracked Task</h3>
            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Task Name</label>
                <input
                  id="new-task-title-input"
                  type="text"
                  placeholder="e.g. Code password validation middleware"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Description Details</label>
                <textarea
                  id="new-task-desc-input"
                  rows={3}
                  placeholder="Need to invoke standard filters and print PDO error output..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Associated Project</label>
                  <select
                    id="new-task-proj-select"
                    value={newTaskProjId}
                    onChange={(e) => setNewTaskProjId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Target Deadline</label>
                  <input
                    id="new-task-date-input"
                    type="date"
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Priority Level</label>
                  <select
                    id="new-task-priority-select"
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="low">⚪ Low priority</option>
                    <option value="medium">🟡 Medium priority</option>
                    <option value="high">🔴 High priority</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Starting Status</label>
                  <select
                    id="new-task-status-select"
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Under Review</option>
                    <option value="done">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  id="close-task-modal-btn"
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-task-modal-btn"
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-lg shadow"
                >
                  Save Task Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
