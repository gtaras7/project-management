# DevBoard Project Tracker — PHP Rebuild Design Spec
Date: 2026-05-21

## Overview
Port the existing React/TypeScript app to a plain HTML + Tailwind CDN + vanilla JS frontend backed by a real PHP/MySQL REST API. Target environment: MAMP on macOS.

## Files
```
/htdocs/project-tracker/
├── index.html       ← Single-page app
├── app.js           ← All state + DOM + fetch logic
├── db_connect.php   ← PDO singleton
├── api.php          ← REST endpoint
└── schema.sql       ← DDL + seed data
```

## Frontend
- Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`)
- State: plain JS objects `{ projects: [], tasks: [] }` populated from API on load
- DOM: functions render project tabs, kanban columns, timeline rows; no framework
- fetch() wraps every CRUD action; on success, re-render affected section

### Tabs (2 only — no PHP API Workspace, no AI Assistant)
1. **Task Kanban Board**
   - Project filter tabs (All + per-project) + "New Project" dashed button
   - Search input + priority dropdown filter + "Add Task" button
   - 4 columns: To Do / In Progress / Under Review / Completed (each scrollable, fixed height)
   - Task cards: priority badge, title, description snippet, deadline alert (overdue/due today/due tomorrow/N days), move-left/move-right arrows, delete button
   - Create Project modal: title (required) + description
   - Add Task modal: title (required), description, project select, deadline date, priority select, status select

2. **Urgent Deadlines Tracker**
   - 4 sections: Overdue (rose), Due This Week (amber), Future Deadlines (slate), Completed (emerald)
   - Each row: countdown badge, project name, task title, description snippet, deadline date chip, status badge

### Header (always visible)
- Dark slate-900 bar with Server icon + "DevBoard Project Tracker" title
- Stats pills: Projects count, Completed/Total, Overdue count (animated red dot when > 0)

## Backend
### db_connect.php
PDO singleton. Defaults: host=localhost, dbname=project_tracker, user=root, password=root (MAMP default).

### api.php
Single file, action-routed:
| Method | ?action | Description |
|--------|---------|-------------|
| GET | projects | SELECT * FROM projects |
| GET | tasks | SELECT * FROM tasks |
| POST | create_project | INSERT project |
| POST | create_task | INSERT task |
| POST | update_task | UPDATE status (or full fields) |
| POST | delete_task | DELETE task by id |

All responses: `Content-Type: application/json`. All mutations use PDO prepared statements with named params. Input sanitized with `htmlspecialchars` + `strip_tags`.

### schema.sql
```sql
projects (id VARCHAR(50) PK, name VARCHAR(100), description TEXT, created_at DATETIME)
tasks (id VARCHAR(50) PK, project_id FK→projects, title VARCHAR(150), description TEXT,
       status ENUM(todo/in_progress/review/done), priority ENUM(low/medium/high),
       deadline DATE, created_at DATETIME)
```
Foreign key: ON DELETE CASCADE. Includes 2 sample projects + 5 sample tasks.

## Validation
- Frontend: required fields checked before fetch; inline error messages shown
- Backend: missing required fields → 400 + JSON error; PDO exceptions → 500 + JSON error

## Out of scope
- Authentication/login
- PHP API Workspace tab
- AI Assistant tab
- Drag-and-drop (arrow buttons used instead)
