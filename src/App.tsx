import React, { useState, useEffect } from 'react';
import { Project, Task, TaskStatus, TaskPriority, PHPDatabaseConfig, WebLogEntry } from './types';
import TaskBoard from './components/TaskBoard';
import TimelineCal from './components/TimelineCal';
import PHPHelperPanel from './components/PHPHelperPanel';
import GeminiAssistant from './components/GeminiAssistant';
import { LayoutDashboard, Clock, FileCode2, Sparkles, Terminal, CheckCircle, AlertCircle, Database, Server } from 'lucide-react';

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'PHP Backend Portfolio',
    description: 'Coursework Project #1: Integrating secure database wrappers, custom routes, and templates.',
    createdAt: '2026-05-18T10:00:00Z'
  },
  {
    id: 'proj-2',
    name: 'E-Commerce Database Schema',
    description: 'Coursework Project #2: Generating SQL entity diagrams, referential constraints, and seeding defaults.',
    createdAt: '2026-05-19T11:30:00Z'
  }
];

const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Configure PDO DB connection',
    description: 'Establish secure connection parameters utilizing parameterized PDO constructor within connection wrapper.',
    status: 'done',
    priority: 'high',
    deadline: '2026-05-25',
    createdAt: '2026-05-18T10:15:00Z'
  },
  {
    id: 'task-2',
    projectId: 'proj-1',
    title: 'Write POST contact form validator',
    description: 'Construct server-side validator utilizing PHP htmlspecialchars and filter_var routines to sanitize incoming payload.',
    status: 'in_progress',
    priority: 'medium',
    deadline: '2026-05-28',
    createdAt: '2026-05-18T10:45:00Z'
  },
  {
    id: 'task-3',
    projectId: 'proj-1',
    title: 'Implement hash verification middleware',
    description: 'Integrate security routines leveraging password_hash() and password_verify() callbacks.',
    status: 'todo',
    priority: 'high',
    deadline: '2026-06-01',
    createdAt: '2026-05-20T12:00:00Z'
  },
  {
    id: 'task-4',
    projectId: 'proj-2',
    title: 'Draw MySQL relational constraints mapping',
    description: 'Outline database entity fields, primary identifiers, and cascading update conditions.',
    status: 'done',
    priority: 'low',
    deadline: '2026-05-22',
    createdAt: '2026-05-19T11:45:00Z'
  },
  {
    id: 'task-5',
    projectId: 'proj-2',
    title: 'Refine SQL integrity indexes',
    description: 'Review index structures layout to accelerate query processing on order item lists.',
    status: 'todo',
    priority: 'medium',
    deadline: '2026-06-03',
    createdAt: '2026-05-20T08:30:00Z'
  }
];

const DEFAULT_DB_CONFIG: PHPDatabaseConfig = {
  dbHost: 'localhost',
  dbName: 'project_tracker',
  dbUser: 'root',
  dbPassword: '',
  phpVersion: 'PHP 8.2+ with PDO MySQL',
  tableNameProjects: 'projects',
  tableNameTasks: 'tasks',
};

export default function App() {
  // Load initial states from LocalStorage or seed defaults safely
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('pm_projects');
      return saved ? JSON.parse(saved) : DEFAULT_PROJECTS;
    } catch {
      return DEFAULT_PROJECTS;
    }
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('pm_tasks');
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch {
      return DEFAULT_TASKS;
    }
  });

  const [dbConfig, setDbConfig] = useState<PHPDatabaseConfig>(() => {
    try {
      const saved = localStorage.getItem('pm_db_config');
      return saved ? JSON.parse(saved) : DEFAULT_DB_CONFIG;
    } catch {
      return DEFAULT_DB_CONFIG;
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string | 'all'>('all');
  const [viewTab, setViewTab] = useState<'board' | 'deadlines' | 'api' | 'chat'>('board');
  
  // Track mock network requests simulating Apache
  const [webLogs, setWebLogs] = useState<WebLogEntry[]>([]);

  // Synchronize storage updates
  useEffect(() => {
    localStorage.setItem('pm_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('pm_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('pm_db_config', JSON.stringify(dbConfig));
  }, [dbConfig]);

  // Log a virtual Apache access log message for educational feedback
  const logRequest = (method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'INFO', path: string, code: number, message: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newLog: WebLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      method,
      path,
      statusCode: code,
      message,
    };
    setWebLogs((prev) => [newLog, ...prev].slice(0, 40)); // keep last 40 logs
  };

  // Log standard initial setup signals on load
  useEffect(() => {
    logRequest('GET', `/api.php?action=projects`, 200, `Fetched ${projects.length} academic projects records successfully.`);
    logRequest('GET', `/api.php?action=tasks`, 200, `Fetched ${tasks.length} standard tasks successfully.`);
  }, []);

  // Creation Action Handlers
  const handleAddProject = (name: string, description: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => [...prev, newProj]);
    logRequest('POST', `/api.php?action=create_project`, 201, `SQL Insert Success: Registered project "${name}" in DB table \`${dbConfig.tableNameProjects}\`.`);
  };

  const handleAddTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    
    // Create rich log for insert parameters matching PHP prepared statement binders
    const payloadStr = JSON.stringify({
      id: newTask.id,
      project_id: newTask.projectId,
      title: newTask.title,
      status: newTask.status,
      priority: newTask.priority,
      deadline: newTask.deadline || null
    });
    logRequest(
      'POST', 
      `/api.php?action=create_task`, 
      201, 
      `SQL Prepared Insert: Binding params into \`${dbConfig.tableNameTasks}\`. Payload: ${payloadStr}`
    );
  };

  const handleUpdateStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      logRequest(
        'POST', 
        `/api.php?action=update_task`, 
        200, 
        `SQL Prepared Update: SET status = '${newStatus}' WHERE id = '${taskId}' inside \`${dbConfig.tableNameTasks}\`.`
      );
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    
    if (task) {
      logRequest(
        'POST', 
        `/api.php?action=delete_task`, 
        200, 
        `SQL Prepared Delete: Removed task entry matching secure PK bind :id = '${taskId}' from table \`${dbConfig.tableNameTasks}\`.`
      );
    }
  };

  const handleClearLogs = () => {
    setWebLogs([]);
    logRequest('INFO', 'System Reset', 200, 'Simulated Apache connection log terminal cleared.');
  };

  // Stats Calculator
  const getOverdueCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((t) => {
      if (t.status === 'done' || !t.deadline) return false;
      const deadlineDate = new Date(t.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      return deadlineDate.getTime() < today.getTime();
    }).length;
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = getOverdueCount();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12 antialiased">
      {/* Premium Dark Navigation Header */}
      <header className="bg-slate-900 text-white shadow-xl py-5 px-6 shrink-0 select-none border-b border-indigo-500/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow shadow-indigo-500/30">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 px-1.5 py-0.5 rounded">
                  {dbConfig.phpVersion}
                </span>
              </div>
              <h1 className="text-base font-extrabold tracking-tight mt-0.5 text-white">
                DevBoard Project Tracker
              </h1>
            </div>
          </div>

          {/* Real-time stats pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <span className="text-slate-400">Projects:</span>
              <span className="font-mono font-bold text-slate-200">{projects.length}</span>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-slate-400">Completed:</span>
              <span className="font-mono font-bold text-slate-200">{completedTasks}/{totalTasks}</span>
            </div>

            {overdueCount > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs text-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="font-semibold text-rose-300">Overdue:</span>
                <span className="font-mono font-bold text-rose-100">{overdueCount}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main View Controller Navigation Bar */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        <div className="flex overflow-x-auto pb-1 gap-2.5 border-b border-slate-200">
          <button
            id="tab-board"
            onClick={() => setViewTab('board')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
              viewTab === 'board'
                ? 'bg-white text-indigo-600 border border-slate-150 border-b-white font-extrabold shadow-sm -mb-[1px]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-500" />
            Task Kanban Board
          </button>

          <button
            id="tab-deadlines"
            onClick={() => setViewTab('deadlines')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
              viewTab === 'deadlines'
                ? 'bg-white text-indigo-600 border border-slate-150 border-b-white font-extrabold shadow-sm -mb-[1px]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            Urgent Deadlines Tracker
          </button>

          <button
            id="tab-api"
            onClick={() => setViewTab('api')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
              viewTab === 'api'
                ? 'bg-white text-indigo-600 border border-slate-150 border-b-white font-extrabold shadow-sm -mb-[1px]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-slate-500" />
            PHP API Workspace
          </button>

          <button
            id="tab-chat"
            onClick={() => setViewTab('chat')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
              viewTab === 'chat'
                ? 'bg-white text-indigo-600 border border-slate-150 border-b-white font-extrabold shadow-sm -mb-[1px]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Ask PHP Assistant
          </button>
        </div>

        {/* View content container routers */}
        <div className="space-y-6">
          {viewTab === 'board' && (
            <TaskBoard
              projects={projects}
              tasks={tasks}
              activeProjectId={activeProjectId}
              setActiveProjectId={setActiveProjectId}
              onAddTask={handleAddTask}
              onUpdateStatus={handleUpdateStatus}
              onDeleteTask={handleDeleteTask}
              onCreateProject={handleAddProject}
            />
          )}

          {viewTab === 'deadlines' && (
            <TimelineCal
              projects={projects}
              tasks={tasks}
            />
          )}

          {viewTab === 'api' && (
            <PHPHelperPanel
              dbConfig={dbConfig}
              setDbConfig={setDbConfig}
              webLogs={webLogs}
              clearLogs={handleClearLogs}
            />
          )}

          {viewTab === 'chat' && (
            <GeminiAssistant
              dbConfig={dbConfig}
              projectsCount={projects.length}
              tasksCount={tasks.length}
            />
          )}
        </div>
      </main>
    </div>
  );
}
