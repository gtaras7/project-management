<?php
/**
 * index.php — List all projects (READ)
 * DevBoard Project Tracker
 */
require_once 'db_connect.php';
$db = DatabaseConnection::getConnection();

$projects = $db->query('SELECT * FROM `projects` ORDER BY created_at DESC')->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevBoard — Project Tracker</title>
    <meta name="description" content="Manage all your projects and tasks in one place with DevBoard Project Tracker.">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #0f1117;
            color: #e2e8f0;
            min-height: 100vh;
            padding: 2rem 1rem;
        }
        .container { max-width: 900px; margin: 0 auto; }
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #2d3748;
        }
        h1 {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-links { display: flex; gap: 1rem; }
        .btn {
            display: inline-block;
            padding: 0.55rem 1.2rem;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
        .btn-secondary { background: #2d3748; color: #e2e8f0; }
        .btn-danger { background: #e53e3e; color: #fff; font-size: 0.8rem; padding: 0.35rem 0.8rem; }
        .btn-edit { background: #3182ce; color: #fff; font-size: 0.8rem; padding: 0.35rem 0.8rem; }
        .alert-success {
            background: #276749; color: #c6f6d5; padding: 0.75rem 1rem;
            border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem;
        }
        .projects-table {
            width: 100%;
            border-collapse: collapse;
            background: #1a202c;
            border-radius: 12px;
            overflow: hidden;
        }
        .projects-table th {
            background: #2d3748;
            padding: 0.9rem 1rem;
            text-align: left;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #a0aec0;
        }
        .projects-table td {
            padding: 0.9rem 1rem;
            border-top: 1px solid #2d3748;
            vertical-align: middle;
        }
        .projects-table tr:hover td { background: #242c3a; }
        .project-name { font-weight: 600; color: #e2e8f0; }
        .project-desc { font-size: 0.85rem; color: #718096; }
        .project-date { font-size: 0.82rem; color: #718096; white-space: nowrap; }
        .actions { display: flex; gap: 0.5rem; }
        .empty-state {
            text-align: center; padding: 3rem 1rem;
            color: #718096; background: #1a202c; border-radius: 12px;
        }
        .kanban-link {
            margin-top: 2rem; text-align: center;
            padding: 1rem; background: #1a202c; border-radius: 12px;
            font-size: 0.9rem; color: #a0aec0;
        }
        .kanban-link a { color: #667eea; font-weight: 600; text-decoration: none; }
        .kanban-link a:hover { text-decoration: underline; }
    </style>
</head>
<body>
<div class="container">
    <header>
        <h1>🗂 DevBoard</h1>
        <div class="nav-links">
            <a href="add_project.php" class="btn btn-primary">+ New Project</a>
            <a href="index.html" class="btn btn-secondary">Kanban Board</a>
        </div>
    </header>

    <?php if (isset($_GET['deleted'])): ?>
        <div class="alert-success">✅ Project deleted successfully.</div>
    <?php elseif (isset($_GET['added'])): ?>
        <div class="alert-success">✅ Project added successfully.</div>
    <?php elseif (isset($_GET['updated'])): ?>
        <div class="alert-success">✅ Project updated successfully.</div>
    <?php endif; ?>

    <?php if (empty($projects)): ?>
        <div class="empty-state">
            <p style="font-size:1.2rem; margin-bottom:0.5rem;">No projects yet.</p>
            <p><a href="add_project.php" style="color:#667eea;">Create your first project →</a></p>
        </div>
    <?php else: ?>
        <table class="projects-table">
            <thead>
                <tr>
                    <th>Project Name</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($projects as $project): ?>
                <tr>
                    <td class="project-name"><?= htmlspecialchars($project['name']) ?></td>
                    <td class="project-desc"><?= htmlspecialchars($project['description'] ?: '—') ?></td>
                    <td class="project-date"><?= date('M j, Y', strtotime($project['created_at'])) ?></td>
                    <td>
                        <div class="actions">
                            <a href="edit_project.php?id=<?= urlencode($project['id']) ?>" class="btn btn-edit">Edit</a>
                            <a href="delete_project.php?id=<?= urlencode($project['id']) ?>"
                               class="btn btn-danger"
                               onclick="return confirm('Delete project &quot;<?= htmlspecialchars(addslashes($project['name'])) ?>&quot; and all its tasks?')">Delete</a>
                        </div>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>

    <div class="kanban-link">
        View your tasks visually → <a href="index.html">Open Kanban Board</a> &nbsp;|&nbsp;
        <a href="add_task.php">Add a Task</a>
    </div>
</div>
</body>
</html>
