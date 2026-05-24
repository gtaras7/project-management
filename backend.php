<?php
/**
 * backend.php — REST API endpoint for the DevBoard Project Tracker.
 * All responses are JSON. Routes are handled via the ?action= query parameter.
 */

// ─────────────────────────────────────────────────────────────
// CORS HEADERS
// Allows the browser to send requests to this file from any origin.
// ─────────────────────────────────────────────────────────────
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle preflight OPTIONS request sent by the browser before the actual request.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

// ─────────────────────────────────────────────────────────────
// SESSION + DB + ROUTING SETUP
// ─────────────────────────────────────────────────────────────
session_start();

require_once 'db_connect.php';
$action = $_GET['action'] ?? '';
$db     = DatabaseConnection::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// ─────────────────────────────────────────────────────────────
// RECURSIVE INPUT SANITIZER
// Walks through any value — or any nested array of values — and
// applies trim() and strip_tags() to every string it finds.
// This ensures all incoming data is clean before it's used.
// ─────────────────────────────────────────────────────────────
function sanitizeInput(mixed $data): mixed {
    if (is_array($data)) {
        foreach ($data as $field => $value) {
            $data[$field] = sanitizeInput($value);
        }
        return $data;
    }
    return trim(strip_tags((string)$data));
}


// ─────────────────────────────────────────────────────────────
// PROJECT VALIDATOR CLASS
// Validates and cleans fields for projects and tasks.
// The constructor accepts the raw data array and a mode
// ('project' or 'task') and runs all validation up front.
// Use the getter methods to retrieve the cleaned values.
// ─────────────────────────────────────────────────────────────
class ProjectValidator {

    // Private properties — only accessible through the getter methods.
    private string  $name        = '';
    private string  $description = '';
    private string  $status      = '';
    private string  $priority    = '';
    private ?string $deadline    = null;
    private bool    $isValid     = false;
    private string  $errorMsg    = '';

    // Lists of accepted values for status and priority.
    private array $allowedStatuses   = ['todo', 'in_progress', 'review', 'done'];
    private array $allowedPriorities = ['low', 'medium', 'high'];

    // Constructor — validates all fields immediately on instantiation.
    public function __construct(array $data, string $mode = 'project') {

        // Validate the name field — required for both projects and tasks.
        $name = trim(strip_tags($data['name'] ?? ''));
        if (empty($name)) {
            $this->errorMsg = "Field 'name' is required.";
            return;
        }
        $this->name = $name;

        // Clean the optional description field.
        $this->description = trim(strip_tags($data['description'] ?? ''));

        // Task-specific field validation.
        if ($mode === 'task') {

            // Validate status against the allowed list.
            $status = $data['status'] ?? 'todo';
            if (!in_array($status, $this->allowedStatuses)) {
                $this->errorMsg = "Invalid status value. Allowed: " .
                    implode(', ', $this->allowedStatuses);
                return;
            }
            $this->status = $status;

            // Validate priority against the allowed list.
            $priority = $data['priority'] ?? 'low';
            if (!in_array($priority, $this->allowedPriorities)) {
                $this->errorMsg = "Invalid priority value. Allowed: " .
                    implode(', ', $this->allowedPriorities);
                return;
            }
            $this->priority = $priority;

            // Validate the deadline date if one was provided.
            if (!empty($data['deadline'])) {
                $deadlineStr = trim($data['deadline']);

                // Split the date string (YYYY-MM-DD) into its parts.
                $dateParts = explode('-', $deadlineStr);

                // Make sure the string split into exactly 3 parts.
                if (count($dateParts) !== 3) {
                    $this->errorMsg = "Invalid deadline format. Expected YYYY-MM-DD.";
                    return;
                }

                $year  = (int)$dateParts[0];
                $month = (int)$dateParts[1];
                $day   = (int)$dateParts[2];

                // Check that the date is a real calendar date.
                if (!checkdate($month, $day, $year)) {
                    $this->errorMsg = "Invalid deadline date. Please enter a real calendar date.";
                    return;
                }

                // Check that the deadline is not in the past.
                $deadlineTs = strtotime($deadlineStr);
                $todayTs    = strtotime('today');

                if ($deadlineTs < $todayTs) {
                    $this->errorMsg = "Deadline must be today or a future date.";
                    return;
                }

                $this->deadline = $deadlineStr;
            }
        }

        // All checks passed.
        $this->isValid = true;
    }

    // Getter methods — return the validated private field values.
    public function isValid(): bool        { return $this->isValid; }
    public function getError(): string     { return $this->errorMsg; }
    public function getName(): string      { return $this->name; }
    public function getDesc(): string      { return $this->description; }
    public function getStatus(): string    { return $this->status; }
    public function getPriority(): string  { return $this->priority; }
    public function getDeadline(): ?string { return $this->deadline; }
}

// ─────────────────────────────────────────────────────────────
// AUTH HELPER
// Checks that the user is logged in before allowing access to
// protected routes. Sends a 401 and stops the script if not.
// ─────────────────────────────────────────────────────────────
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. Please log in.']);
        exit();
    }
    return $_SESSION['user_id'];
}

// ─────────────────────────────────────────────────────────────
// MAIN ROUTER
// Dispatches the request based on the HTTP method (GET / POST).
// ─────────────────────────────────────────────────────────────
switch ($method) {

    // ─────────────────────────────────────────────────────────
    // GET REQUESTS
    // ─────────────────────────────────────────────────────────
    case 'GET':

        // check_session — public route, no login required.
        // Returns whether the user is currently logged in.
        if ($action === 'check_session') {
            if (isset($_SESSION['user_id'])) {
                echo json_encode([
                    'logged_in' => true,
                    'user' => [
                        'id'       => $_SESSION['user_id'],
                        'username' => htmlspecialchars($_SESSION['username'])
                    ]
                ]);
            } else {
                echo json_encode(['logged_in' => false]);
            }
            exit();
        }

        // All other GET routes require a logged-in user.
        $userId = requireAuth();

        // projects — returns all projects belonging to this user, newest first.
        if ($action === 'projects') {
            $stmt = $db->prepare('SELECT * FROM `projects` WHERE user_id = :user_id ORDER BY created_at DESC');
            $stmt->execute([':user_id' => $userId]);

            $projects     = $stmt->fetchAll();
            $safeProjects = [];
            foreach ($projects as $project) {
                $safeProjects[] = [
                    'id'          => $project['id'],
                    'user_id'     => $project['user_id'],
                    'name'        => htmlspecialchars($project['name']),
                    'description' => htmlspecialchars($project['description'] ?? ''),
                    'created_at'  => $project['created_at'],
                ];
            }
            echo json_encode($safeProjects);

        // tasks — returns all tasks in this user's projects,
        // ordered by deadline (soonest first), then creation date.
        } elseif ($action === 'tasks') {
            $stmt = $db->prepare('SELECT t.* FROM `tasks` t 
                                  INNER JOIN `projects` p ON t.project_id = p.id 
                                  WHERE p.user_id = :user_id 
                                  ORDER BY t.deadline ASC, t.created_at DESC');
            $stmt->execute([':user_id' => $userId]);

            $tasks     = $stmt->fetchAll();
            $safeTasks = [];
            foreach ($tasks as $task) {
                $safeTasks[] = [
                    'id'          => $task['id'],
                    'project_id'  => $task['project_id'],
                    'title'       => htmlspecialchars($task['title']),
                    'description' => htmlspecialchars($task['description'] ?? ''),
                    'status'      => $task['status'],
                    'priority'    => $task['priority'],
                    'deadline'    => $task['deadline'],
                    'created_at'  => $task['created_at'],
                ];
            }
            echo json_encode($safeTasks);

        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Unknown GET action.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // POST REQUESTS
    // ─────────────────────────────────────────────────────────
    case 'POST':
        // Read and decode the JSON body sent by the frontend.
        $rawData = json_decode(file_get_contents('php://input'), true) ?? [];

        // Run all string values in the input through the sanitizer.
        // Password is kept from rawData to avoid stripping special characters.
        $data = sanitizeInput($rawData);

        // ── LOGIN ──────────────────────────────────────────────
        // Checks the submitted credentials against the database.
        // Uses crypt() to compare the password against the stored hash.
        if ($action === 'login') {

            $username = trim($data['username'] ?? '');
            $password = $rawData['password'] ?? '';

            if (empty($username)) {
                http_response_code(400);
                echo json_encode(['error' => 'Username is required.']);
                exit();
            }
            if (empty($password)) {
                http_response_code(400);
                echo json_encode(['error' => 'Password is required.']);
                exit();
            }

            // Look up the user by username.
            $stmt = $db->prepare('SELECT * FROM `users` WHERE username = :username');
            $stmt->execute([':username' => $username]);
            $user = $stmt->fetch();

            if ($user) {
                // Verify the password by hashing it against the stored salt.
                $key = $user['password'];
                if (crypt($password, $key) === $key) {
                    $_SESSION['user_id']  = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    echo json_encode([
                        'status' => 'logged_in',
                        'user'   => [
                            'id'       => $user['id'],
                            'username' => htmlspecialchars($user['username'])
                        ]
                    ]);
                } else {
                    http_response_code(400);
                    echo json_encode(['error' => 'You entered an incorrect password.']);
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'You entered an incorrect username.']);
            }
            exit();

        // ── REGISTER ───────────────────────────────────────────
        // Validates the new user's fields, checks for duplicates,
        // hashes the password, inserts the record, and auto-logs them in.
        } elseif ($action === 'register') {

            $username = trim($data['username'] ?? '');
            $email    = trim($data['email'] ?? '');
            $password = $rawData['password'] ?? '';

            // Validate each required field in sequence.
            if (empty($username)) {
                http_response_code(400);
                echo json_encode(['error' => 'Username is required.']);
                exit();
            }
            if (empty($password) || strlen($password) < 6) {
                http_response_code(400);
                echo json_encode(['error' => 'Password must be at least 6 characters.']);
                exit();
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'Valid email is required.']);
                exit();
            }

            // Check that the username and email are not already in use.
            $stmt = $db->prepare('SELECT COUNT(*) FROM `users` WHERE username = :username OR email = :email');
            $stmt->execute([':username' => $username, ':email' => $email]);
            if ((int)$stmt->fetchColumn() > 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Username or email already registered.']);
                exit();
            }

            // Hash the password with a Blowfish key before storing it.
            $key            = '$2y$10$' . bin2hex(random_bytes(11)) . '$';
            $hashedPassword = crypt($password, $key);

            // Insert the new user.
            $id   = uniqid('user_', true);
            $stmt = $db->prepare('INSERT INTO `users` (id, username, email, password) VALUES (:id, :username, :email, :password)');
            $stmt->execute([':id' => $id, ':username' => $username, ':email' => $email, ':password' => $hashedPassword]);

            // Auto-login: save the new user to the session immediately.
            $_SESSION['user_id']  = $id;
            $_SESSION['username'] = $username;

            echo json_encode([
                'status' => 'registered',
                'user'   => [
                    'id'       => $id,
                    'username' => htmlspecialchars($username)
                ]
            ]);
            exit();

        // ── LOGOUT ─────────────────────────────────────────────
        // Destroys the session, logging the user out.
        } elseif ($action === 'logout') {
            session_destroy();
            echo json_encode(['status' => 'logged_out']);
            exit();
        }

        // All routes below this point require the user to be logged in.
        $userId = requireAuth();

        // ── CREATE PROJECT ─────────────────────────────────────
        // Inserts a new project linked to the current user.
        if ($action === 'create_project') {

            if (empty($data['name'])) {
                http_response_code(400);
                echo json_encode(['error' => "Field 'name' required."]);
                exit();
            }

            // Validate and clean the fields using the ProjectValidator class.
            $validator = new ProjectValidator($data, 'project');
            if (!$validator->isValid()) {
                http_response_code(400);
                echo json_encode(['error' => $validator->getError()]);
                exit();
            }

            $id   = $data['id'] ?? uniqid('proj_', true);
            $name = $validator->getName();
            $desc = $validator->getDesc();

            $db->prepare('INSERT INTO `projects` (id,user_id,name,description) VALUES (:id,:user_id,:name,:description)')
               ->execute([':id' => $id, ':user_id' => $userId, ':name' => $name, ':description' => $desc]);
            http_response_code(201);
            echo json_encode(['status' => 'created', 'id' => $id]);

        // ── CREATE TASK ────────────────────────────────────────
        // Adds a new task to a project after verifying the project
        // belongs to the current user.
        } elseif ($action === 'create_task') {

            if (empty($data['projectId']) || empty($data['title'])) {
                http_response_code(400);
                echo json_encode(['error' => "Fields 'projectId' and 'title' required."]);
                exit();
            }

            // Confirm the project belongs to this user before adding a task.
            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['projectId'], ':user_id' => $userId]);
            if ((int)$checkProj->fetchColumn() === 0) {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden. Not your project.']);
                exit();
            }

            // Validate the task fields (status, priority, deadline).
            $validator = new ProjectValidator($data, 'task');
            if (!$validator->isValid()) {
                http_response_code(400);
                echo json_encode(['error' => $validator->getError()]);
                exit();
            }

            $id       = $data['id'] ?? uniqid('task_', true);
            $title    = trim(strip_tags($data['title']));
            $desc     = $validator->getDesc();
            $status   = $validator->getStatus();
            $priority = $validator->getPriority();
            $deadline = $validator->getDeadline();

            $db->prepare('INSERT INTO `tasks` (id,project_id,title,description,status,priority,deadline)
                          VALUES (:id,:project_id,:title,:description,:status,:priority,:deadline)')
               ->execute([
                   ':id'          => $id,
                   ':project_id'  => $data['projectId'],
                   ':title'       => $title,
                   ':description' => $desc,
                   ':status'      => $status,
                   ':priority'    => $priority,
                   ':deadline'    => $deadline,
               ]);
            http_response_code(201);
            echo json_encode(['status' => 'created', 'id' => $id]);

        // ── UPDATE TASK ────────────────────────────────────────
        // Updates one or more fields on an existing task.
        // Only the fields actually included in the request are changed.
        // The SET clause is built dynamically from whatever fields were sent.
        } elseif ($action === 'update_task') {

            if (empty($data['id'])) {
                http_response_code(400);
                echo json_encode(['error' => "Field 'id' required."]);
                exit();
            }

            // Verify this task belongs to a project owned by the current user.
            $checkTask = $db->prepare('SELECT COUNT(*) FROM `tasks` t 
                                       INNER JOIN `projects` p ON t.project_id = p.id 
                                       WHERE t.id = :id AND p.user_id = :user_id');
            $checkTask->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ((int)$checkTask->fetchColumn() === 0) {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden. Not your task.']);
                exit();
            }

            $allowedStatuses   = ['todo', 'in_progress', 'review', 'done'];
            $allowedPriorities = ['low', 'medium', 'high'];

            // Only process fields that were included in the request.
            $title    = isset($data['title'])       ? trim(strip_tags($data['title']))       : null;
            $desc     = isset($data['description']) ? trim(strip_tags($data['description'])) : null;
            $status   = $data['status']   ?? null;
            $priority = $data['priority'] ?? null;
            $deadline = null;

            // Validate and accept the deadline if one was provided.
            if (!empty($data['deadline'])) {
                $deadlineStr = trim($data['deadline']);
                $dateParts   = explode('-', $deadlineStr);
                if (count($dateParts) === 3) {
                    $year  = (int)$dateParts[0];
                    $month = (int)$dateParts[1];
                    $day   = (int)$dateParts[2];
                    if (checkdate($month, $day, $year)) {
                        $deadline = $deadlineStr;
                    }
                }
            }

            // Build the SET clause dynamically — only include fields that were sent.
            $updates = [];
            $params  = [':id' => $data['id']];

            if ($title !== null)  { $updates[] = 'title=:title';             $params[':title']       = $title; }
            if ($desc  !== null)  { $updates[] = 'description=:description'; $params[':description'] = $desc; }

            if ($status !== null) {
                if (!in_array($status, $allowedStatuses)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid status. Allowed: ' . implode(', ', $allowedStatuses)]);
                    exit();
                }
                $updates[] = 'status=:status';
                $params[':status'] = $status;
            }

            if ($priority !== null) {
                if (!in_array($priority, $allowedPriorities)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid priority. Allowed: ' . implode(', ', $allowedPriorities)]);
                    exit();
                }
                $updates[] = 'priority=:priority';
                $params[':priority'] = $priority;
            }

            if (isset($data['deadline'])) {
                $updates[] = 'deadline=:deadline';
                $params[':deadline'] = $deadline;
            }

            // Run the update only if at least one field was provided.
            if (count($updates) > 0) {
                $sql  = 'UPDATE `tasks` SET ' . implode(', ', $updates) . ' WHERE id=:id';
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
            }
            echo json_encode(['status' => 'updated']);

        // ── DELETE TASK ────────────────────────────────────────
        // Deletes a task after confirming the current user owns it.
        } elseif ($action === 'delete_task') {

            if (empty($data['id'])) {
                http_response_code(400);
                echo json_encode(['error' => "Field 'id' required."]);
                exit();
            }

            $checkTask = $db->prepare('SELECT COUNT(*) FROM `tasks` t 
                                       INNER JOIN `projects` p ON t.project_id = p.id 
                                       WHERE t.id = :id AND p.user_id = :user_id');
            $checkTask->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ((int)$checkTask->fetchColumn() === 0) {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden. Not your task.']);
                exit();
            }

            $db->prepare('DELETE FROM `tasks` WHERE id=:id')->execute([':id' => $data['id']]);
            echo json_encode(['status' => 'deleted']);

        // ── UPDATE PROJECT ─────────────────────────────────────
        // Updates the name and description of an existing project.
        } elseif ($action === 'update_project') {

            if (empty($data['id']) || empty($data['name'])) {
                http_response_code(400);
                echo json_encode(['error' => "Fields 'id' and 'name' required."]);
                exit();
            }

            // Confirm the project belongs to this user.
            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ((int)$checkProj->fetchColumn() === 0) {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden. Not your project.']);
                exit();
            }

            $validator = new ProjectValidator($data, 'project');
            if (!$validator->isValid()) {
                http_response_code(400);
                echo json_encode(['error' => $validator->getError()]);
                exit();
            }

            $name = $validator->getName();
            $desc = $validator->getDesc();

            $db->prepare('UPDATE `projects` SET name=:name, description=:description WHERE id=:id')
               ->execute([':id' => $data['id'], ':name' => $name, ':description' => $desc]);
            echo json_encode(['status' => 'updated']);

        // ── DELETE PROJECT ─────────────────────────────────────
        // Deletes a project after confirming ownership.
        // Tasks under this project are removed automatically via the
        // ON DELETE CASCADE constraint defined in the schema.
        } elseif ($action === 'delete_project') {

            if (empty($data['id'])) {
                http_response_code(400);
                echo json_encode(['error' => "Field 'id' required."]);
                exit();
            }

            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ((int)$checkProj->fetchColumn() === 0) {
                http_response_code(403);
                echo json_encode(['error' => 'Forbidden. Not your project.']);
                exit();
            }

            $db->prepare('DELETE FROM `projects` WHERE id=:id')->execute([':id' => $data['id']]);
            echo json_encode(['status' => 'deleted']);

        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Unknown POST action.']);
        }
        break;

    // Any other HTTP method (PUT, PATCH, DELETE, etc.) is not supported.
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed.']);
}
