<?php
/**
 * add_project.php — HTML form + INSERT project (CREATE)
 * DevBoard Project Tracker
 */
require_once 'db_connect.php';

$errors = [];
$name = $description = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name        = trim(strip_tags($_POST['name'] ?? ''));
    $description = trim(strip_tags($_POST['description'] ?? ''));

    if ($name === '') {
        $errors[] = 'Project name is required.';
    } elseif (strlen($name) > 100) {
        $errors[] = 'Project name must be 100 characters or fewer.';
    }

    if (empty($errors)) {
        $db = DatabaseConnection::getConnection();
        $id = uniqid('proj_', true);
        $db->prepare('INSERT INTO `projects` (id, name, description) VALUES (:id, :name, :description)')
           ->execute([':id' => $id, ':name' => $name, ':description' => $description]);
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
    <title>Add Project — DevBoard</title>
    <meta name="description" content="Create a new project in DevBoard Project Tracker.">
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
            max-width: 480px;
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
        .subtitle {
            color: #718096; font-size: 0.9rem; margin-bottom: 2rem;
        }
        .form-group { margin-bottom: 1.4rem; }
        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 600;
            color: #a0aec0;
            margin-bottom: 0.4rem;
        }
        label span.required { color: #fc8181; margin-left: 2px; }
        input[type="text"], textarea {
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
            resize: vertical;
        }
        input[type="text"]:focus, textarea:focus {
            border-color: #667eea;
        }
        textarea { min-height: 100px; }
        .error-list {
            background: #742a2a; color: #fed7d7;
            border-radius: 8px; padding: 0.75rem 1rem;
            margin-bottom: 1.4rem; font-size: 0.875rem;
        }
        .error-list ul { padding-left: 1.2rem; }
        .btn-row {
            display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem;
        }
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
        .char-hint { font-size: 0.78rem; color: #718096; margin-top: 0.25rem; }
    </style>
</head>
<body>
<div class="card">
    <h1>+ New Project</h1>
    <p class="subtitle">Add a project to start tracking tasks.</p>

    <?php if (!empty($errors)): ?>
        <div class="error-list">
            <ul>
                <?php foreach ($errors as $e): ?>
                    <li><?= htmlspecialchars($e) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <form method="POST" action="add_project.php" novalidate>
        <div class="form-group">
            <label for="name">Project Name <span class="required">*</span></label>
            <input type="text"
                   id="name"
                   name="name"
                   maxlength="100"
                   required
                   placeholder="e.g. E-Commerce Backend"
                   value="<?= htmlspecialchars($name) ?>">
            <p class="char-hint">Maximum 100 characters.</p>
        </div>

        <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description"
                      name="description"
                      placeholder="What is this project about? (optional)"><?= htmlspecialchars($description) ?></textarea>
        </div>

        <div class="btn-row">
            <a href="index.php" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary">Create Project</button>
        </div>
    </form>
</div>
</body>
</html>
