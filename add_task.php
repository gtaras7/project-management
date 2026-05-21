<?php
/**
 * add_task.php — HTML form + INSERT task (CREATE)
 * DevBoard Project Tracker
 */
require_once 'db_connect.php';
$db = DatabaseConnection::getConnection();

$projects = $db->query('SELECT id, name FROM `projects` ORDER BY name ASC')->fetchAll();

$errors = [];
$title = $description = $deadline = '';
$project_id = $_GET['project_id'] ?? '';
$status   = 'todo';
$priority = 'low';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $project_id  = $_POST['project_id']  ?? '';
    $title       = trim(strip_tags($_POST['title'] ?? ''));
    $description = trim(strip_tags($_POST['description'] ?? ''));
    $status      = $_POST['status']   ?? 'todo';
    $priority    = $_POST['priority'] ?? 'low';
    $deadline    = $_POST['deadline'] ?? '';

    $allowed_statuses   = ['todo', 'in_progress', 'review', 'done'];
    $allowed_priorities = ['low', 'medium', 'high'];

    if (empty($project_id))   $errors[] = 'Please select a project.';
    if ($title === '')         $errors[] = 'Task title is required.';
    elseif (strlen($title) > 150) $errors[] = 'Title must be 150 characters or fewer.';
    if (!in_array($status, $allowed_statuses))     $errors[] = 'Invalid status value.';
    if (!in_array($priority, $allowed_priorities)) $errors[] = 'Invalid priority value.';
    if (!empty($deadline) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline)) {
        $errors[] = 'Invalid deadline format.';
    }

    if (empty($errors)) {
        $id = uniqid('task_', true);
        $db->prepare(
            'INSERT INTO `tasks` (id, project_id, title, description, status, priority, deadline)
             VALUES (:id, :project_id, :title, :description, :status, :priority, :deadline)'
        )->execute([
            ':id'          => $id,
            ':project_id'  => $project_id,
            ':title'       => $title,
            ':description' => $description,
            ':status'      => $status,
            ':priority'    => $priority,
            ':deadline'    => $deadline ?: null,
        ]);
        header('Location: index.php?added=1');
        exit();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Task — DevBoard</title>
    <meta name="description" content="Create a new task for a project in DevBoard Project Tracker.">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #0f1117;
            color: #e2e8f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
        }
        .card {
            background: #1a202c;
            border-radius: 16px;
            padding: 2.5rem 2rem;
            width: 100%;
            max-width: 520px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        h1 {
            font-size: 1.6rem;
            font-weight: 700;
            margin-bottom: 0.4rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle { color: #718096; font-size: 0.9rem; margin-bottom: 2rem; }
        .form-group { margin-bottom: 1.3rem; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.3rem; }
        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 600;
            color: #a0aec0;
            margin-bottom: 0.4rem;
        }
        label span.required { color: #fc8181; margin-left: 2px; }
        input[type="text"], input[type="date"], textarea, select {
            width: 100%;
            background: #2d3748;
            border: 2px solid #2d3748;
            border-radius: 8px;
            color: #e2e8f0;
            padding: 0.65rem 0.9rem;
            font-size: 0.95rem;
            font-family: inherit;
            transition: border-color 0.2s;
            outline: none;
        }
        select option { background: #2d3748; }
        input[type="text"]:focus, input[type="date"]:focus,
        textarea:focus, select:focus { border-color: #667eea; }
        textarea { min-height: 90px; resize: vertical; }
        .error-list {
            background: #742a2a; color: #fed7d7;
            border-radius: 8px; padding: 0.75rem 1rem;
            margin-bottom: 1.4rem; font-size: 0.875rem;
        }
        .error-list ul { padding-left: 1.2rem; }
        .btn-row { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
        .btn {
            display: inline-block;
            padding: 0.65rem 1.4rem;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            font-family: inherit;
            transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
        .btn-secondary { background: #2d3748; color: #e2e8f0; }
    </style>
</head>
<body>
<div class="card">
    <h1>+ New Task</h1>
    <p class="subtitle">Assign a task to one of your projects.</p>

    <?php if (!empty($errors)): ?>
        <div class="error-list">
            <ul>
                <?php foreach ($errors as $e): ?>
                    <li><?= htmlspecialchars($e) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <form method="POST" action="add_task.php" novalidate>

        <div class="form-group">
            <label for="project_id">Project <span class="required">*</span></label>
            <select id="project_id" name="project_id" required>
                <option value="">— Select a project —</option>
                <?php foreach ($projects as $p): ?>
                    <option value="<?= htmlspecialchars($p['id']) ?>"
                        <?= $project_id === $p['id'] ? 'selected' : '' ?>>
                        <?= htmlspecialchars($p['name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="form-group">
            <label for="title">Task Title <span class="required">*</span></label>
            <input type="text"
                   id="title"
                   name="title"
                   maxlength="150"
                   required
                   placeholder="e.g. Set up database connection"
                   value="<?= htmlspecialchars($title) ?>">
        </div>

        <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" placeholder="Describe the task (optional)"><?= htmlspecialchars($description) ?></textarea>
        </div>

        <div class="form-row">
            <div>
                <label for="status">Status <span class="required">*</span></label>
                <select id="status" name="status">
                    <option value="todo"        <?= $status === 'todo'        ? 'selected' : '' ?>>To Do</option>
                    <option value="in_progress" <?= $status === 'in_progress' ? 'selected' : '' ?>>In Progress</option>
                    <option value="review"      <?= $status === 'review'      ? 'selected' : '' ?>>Review</option>
                    <option value="done"        <?= $status === 'done'        ? 'selected' : '' ?>>Done</option>
                </select>
            </div>
            <div>
                <label for="priority">Priority <span class="required">*</span></label>
                <select id="priority" name="priority">
                    <option value="low"    <?= $priority === 'low'    ? 'selected' : '' ?>>Low</option>
                    <option value="medium" <?= $priority === 'medium' ? 'selected' : '' ?>>Medium</option>
                    <option value="high"   <?= $priority === 'high'   ? 'selected' : '' ?>>High</option>
                </select>
            </div>
        </div>

        <div class="form-group">
            <label for="deadline">Deadline</label>
            <input type="date"
                   id="deadline"
                   name="deadline"
                   value="<?= htmlspecialchars($deadline) ?>">
        </div>

        <div class="btn-row">
            <a href="index.php" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary">Create Task</button>
        </div>
    </form>
</div>
</body>
</html>
