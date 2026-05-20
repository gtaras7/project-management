import React from 'react';
import { Project, Task } from '../types';
import { Calendar, AlertCircle, Clock, CheckCircle, Flame } from 'lucide-react';

interface TimelineCalProps {
  projects: Project[];
  tasks: Task[];
}

export default function TimelineCal({ projects, tasks }: TimelineCalProps) {
  // Extract all tasks with specified deadlines and sort them chronologically
  const sortedDeadlineTasks = tasks
    .filter((task) => !!task.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const categorizeTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue: Task[] = [];
    const activeSoon: Task[] = []; // next 7 days
    const future: Task[] = [];
    const completed: Task[] = [];

    sortedDeadlineTasks.forEach((task) => {
      if (task.status === 'done') {
        completed.push(task);
        return;
      }

      const taskDate = new Date(task.deadline);
      taskDate.setHours(0, 0, 0, 0);

      const diffTime = taskDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        overdue.push(task);
      } else if (diffDays <= 7) {
        activeSoon.push(task);
      } else {
        future.push(task);
      }
    });

    return { overdue, activeSoon, future, completed };
  };

  const { overdue, activeSoon, future, completed } = categorizeTasks();

  const getDaysDiffString = (deadlineStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadlineStr);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  const renderTimelineItem = (task: Task, typeClass: string, countdownText: string) => {
    const proj = projects.find((p) => p.id === task.projectId);
    return (
      <div 
        id={`timeline-item-${task.id}`}
        key={task.id} 
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150/70 rounded-xl transition-all gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${typeClass}`}>
              {countdownText}
            </span>
            {proj && (
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                {proj.name}
              </span>
            )}
          </div>
          <h4 className="text-xs font-bold text-slate-800">{task.title}</h4>
          {task.description && (
            <p className="text-[11px] text-slate-500 line-clamp-1">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono font-medium text-slate-600 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-lg flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {task.deadline}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${
            task.status === 'in_progress' ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' :
            task.status === 'review' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
            task.status === 'done' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
            'bg-slate-100 border border-slate-200 text-slate-600'
          }`}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div id="timeline-deadlines-section" className="bg-white rounded-xl shadow-sm border border-slate-150 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-700" />
          Critical Milestones & Deadlines Tracker
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Chronologically monitors active items to ensure coursework requirements are never submitted overdue.
        </p>
      </div>

      <div className="space-y-6">
        {/* Category: OVERDUE */}
        {overdue.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-rose-700 flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 w-max">
              <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
              Overdue Actions ({overdue.length})
            </h3>
            <div className="space-y-2">
              {overdue.map((task) =>
                renderTimelineItem(task, 'bg-rose-500 text-white border-rose-600', getDaysDiffString(task.deadline))
              )}
            </div>
          </div>
        )}

        {/* Category: DUE SOON */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-amber-700 flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 w-max">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Due This Week ({activeSoon.length})
          </h3>
          {activeSoon.length === 0 ? (
            <p className="text-xs text-slate-400 italic pl-2 py-2">No deadlines active within the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {activeSoon.map((task) =>
                renderTimelineItem(task, 'bg-amber-500 text-white border-amber-600', getDaysDiffString(task.deadline))
              )}
            </div>
          )}
        </div>

        {/* Category: FUTURE DEADLINES */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 w-max">
            <Calendar className="w-4 h-4 text-slate-500" />
            Future Deadlines ({future.length})
          </h3>
          {future.length === 0 ? (
            <p className="text-xs text-slate-400 italic pl-2 py-2">No other future deadlines configured.</p>
          ) : (
            <div className="space-y-2">
              {future.map((task) =>
                renderTimelineItem(task, 'bg-indigo-100 text-indigo-800 border-indigo-200', getDaysDiffString(task.deadline))
              )}
            </div>
          )}
        </div>

        {/* Category: COMPLETED WITH DEADLINE */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100/80 rounded-lg px-3 py-1.5 w-max">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Saved / Completed ({completed.length})
          </h3>
          {completed.length === 0 ? (
            <p className="text-xs text-slate-400 italic pl-2 py-2">Completed tasks with deadlines will settle here.</p>
          ) : (
            <div className="space-y-2">
              {completed.map((task) =>
                renderTimelineItem(task, 'bg-emerald-500 text-white border-emerald-600', 'Completed')
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
