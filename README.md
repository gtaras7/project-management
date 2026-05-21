# DevBoard Project Tracker

A PHP & MySQL project/task management web application built for a PHP coursework assignment.

## Stack

- **Frontend:** HTML5, Tailwind CSS (CDN), Vanilla JavaScript
- **Backend:** PHP 8.2+ with PDO
- **Database:** MySQL (via MAMP)

## Features

- Kanban board with 4 columns: To Do, In Progress, Under Review, Completed
- Filter tasks by project, search text, and priority level
- Create / delete projects and tasks via modal forms
- Move tasks forward and backward through statuses
- Urgent Deadlines Tracker with Overdue / This Week / Future / Completed sections

## Setup (MAMP)

1. Start MAMP and turn on Apache + MySQL.
2. Open `http://localhost:8888/phpmyadmin/`, click the **SQL** tab, paste the contents of `schema.sql`, and click **Go**.
3. Copy all project files into `/Applications/MAMP/htdocs/project-tracker/`.
4. Open `http://localhost:8888/project-tracker/` in your browser.

## File Structure

| File | Purpose |
|------|---------|
| `schema.sql` | Database schema and seed data |
| `db_connect.php` | PDO database connection singleton |
| `api.php` | REST API endpoint (GET + POST) |
| `index.html` | Single-page application shell |
| `app.js` | All JavaScript — state, rendering, API calls |

## Database Tables

**projects** — `id`, `name`, `description`, `created_at`

**tasks** — `id`, `project_id` (FK), `title`, `description`, `status`, `priority`, `deadline`, `created_at`
