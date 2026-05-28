# DevBoard — Project Tracker

A single-page project and task management app built with PHP, MySQL, and vanilla JavaScript for CS325.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JS |
| Backend | PHP 8.2+ with PDO |
| Database | MySQL via MAMP |
| Auth | PHP sessions + HttpOnly cookies |

## Features

- **User accounts** — register, log in, and log out with Blowfish-hashed passwords
- **Remember Me** — optional 30-day persistent login via signed HttpOnly cookie
- **Kanban board** — four columns: To Do, In Progress, Under Review, Completed
- **Deadline tracker** — tasks grouped into Overdue, This Week, Future, and Completed sections
- **Projects** — create, edit, and delete projects; each user sees only their own data
- **Tasks** — create, edit, delete, and move tasks with title, description, priority, and deadline
- **Filtering** — filter tasks by project, free-text search, and priority level
- **Priority badges** — Low / Medium / High colour-coded labels on every task card

## Setup (MAMP)

1. Start MAMP and make sure Apache and MySQL are running.
2. Open `http://localhost:8888/phpmyadmin/`, click the **SQL** tab, paste the contents of `schema.sql`, and click **Go**.
3. Copy the project folder into `/Applications/MAMP/htdocs/` so the path becomes `/Applications/MAMP/htdocs/FINAL PROJECT CS325/project-management/`.
4. Open `http://localhost:8888/FINAL%20PROJECT%20CS325/project-management/` in your browser.

A seed user is included in `schema.sql`:

| Username | Password |
|----------|----------|
| `testuser` | `password` |

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | SPA shell — all markup, modals, and Tailwind classes |
| `app.js` | All client-side logic — state, rendering, API calls, auth flow |
| `backend.php` | REST API — routes handled via `?action=` query param |
| `db_connect.php` | PDO singleton that returns a shared database connection |
| `schema.sql` | Database schema (users, projects, tasks) and seed data |

## API Routes

All requests go to `backend.php`. GET routes read data; POST routes mutate it.

### GET
| `?action=` | Description |
|------------|-------------|
| `check_session` | Returns `{ logged_in, user }` — also validates remember-me cookie |
| `projects` | Returns all projects for the logged-in user |
| `tasks` | Returns all tasks across the user's projects |

### POST
| `?action=` | Description |
|------------|-------------|
| `login` | Authenticates credentials, starts session, sets remember-me cookie if requested |
| `register` | Creates a new user and auto-logs them in |
| `logout` | Destroys session and clears remember-me cookie |
| `create_project` | Inserts a new project |
| `update_project` | Edits a project's name and description |
| `delete_project` | Deletes a project and cascades to its tasks |
| `create_task` | Inserts a new task linked to a project |
| `update_task` | Moves a task to a new status (quick update) |
| `full_update_task` | Edits all task fields |
| `delete_task` | Deletes a task |

## Database Schema

**users** — `id`, `username`, `email`, `password`, `created_at`

**projects** — `id`, `user_id` (FK → users), `name`, `description`, `created_at`

**tasks** — `id`, `project_id` (FK → projects), `title`, `description`, `status`, `priority`, `deadline`, `created_at`

Cascade deletes are set on both foreign keys: deleting a user removes their projects, and deleting a project removes its tasks.

## Auth Flow

1. On page load, `check_session` is called. If the PHP session is active, the user is logged straight in.
2. If no session exists, the backend checks for a `remember_me` cookie. The cookie contains `user_id:hmac_sha256(user_id, secret)`. If the signature is valid and the user exists, the session is restored automatically.
3. On explicit logout, both the session and the cookie are cleared.
