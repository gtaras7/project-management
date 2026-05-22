<?php
/**
 * backend.php — REST endpoint for DevBoard Project Tracker with Authentication
 * All responses are JSON. Routes via ?action= query param.
 */

// ─────────────────────────────────────────────────────────────
// SECTION 1: CORS HEADERS
// Allows the browser to talk to this file from any origin.
// If the request comes from a known origin, we echo it back;
// otherwise we just allow everything with a wildcard (*).
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

// ─────────────────────────────────────────────────────────────
// SECTION 2: PREFLIGHT CHECK
// Browsers send an OPTIONS request before the real request
// to check if CORS is allowed. We just say 200 OK and stop.
// ─────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

// ─────────────────────────────────────────────────────────────
// SECTION 3: SESSION + DB + ROUTING SETUP
// Start the user session so we can track who is logged in.
// Connect to the database, grab the action from the URL (?action=),
// and figure out if it's a GET or POST request.
// ─────────────────────────────────────────────────────────────
session_start();

require_once 'db_connect.php';
$action = $_GET['action'] ?? '';
$db     = DatabaseConnection::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// ─────────────────────────────────────────────────────────────
// SECTION 4: AUTH HELPER
// This function is called on any route that needs a logged-in user.
// If there's no session, it sends back a 401 Unauthorized error
// and stops the script. Otherwise it returns the user's ID.
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
// SECTION 5: MAIN ROUTER
// Splits the logic depending on the HTTP method (GET or POST).
// ─────────────────────────────────────────────────────────────
switch ($method) {

    // ─────────────────────────────────────────────────────────
    // GET REQUESTS
    // ─────────────────────────────────────────────────────────
    case 'GET':

        // check_session — public route, no login needed.
        // Returns whether the user is currently logged in.
        if ($action === 'check_session') {
            if (isset($_SESSION['user_id'])) {
                echo json_encode([
                    'logged_in' => true,
                    'user' => [
                        'id' => $_SESSION['user_id'],
                        'username' => $_SESSION['username']
                    ]
                ]);
            } else {
                echo json_encode(['logged_in' => false]);
            }
            exit();
        }

        // All other GET routes require the user to be logged in.
        $userId = requireAuth();

        // projects — fetch all projects that belong to this user,
        // newest first.
        if ($action === 'projects') {
            $stmt = $db->prepare('SELECT * FROM `projects` WHERE user_id = :user_id ORDER BY created_at DESC');
            $stmt->execute([':user_id' => $userId]);
            echo json_encode($stmt->fetchAll());

        // tasks — fetch all tasks that belong to this user's projects,
        // sorted by deadline (soonest first), then newest first.
        } elseif ($action === 'tasks') {
            $stmt = $db->prepare('SELECT t.* FROM `tasks` t 
                                  INNER JOIN `projects` p ON t.project_id = p.id 
                                  WHERE p.user_id = :user_id 
                                  ORDER BY t.deadline ASC, t.created_at DESC');
            $stmt->execute([':user_id' => $userId]);
            echo json_encode($stmt->fetchAll());

        } else {
            // Unknown action — send back a 400 error.
            http_response_code(400);
            echo json_encode(['error' => 'Unknown GET action.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // POST REQUESTS
    // ─────────────────────────────────────────────────────────
    case 'POST':
        // Read the JSON body the frontend sent us.
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        // ── LOGIN ──────────────────────────────────────────────
        // Validates the username/password, checks the DB,
        // and starts a session if credentials are correct.
        if ($action === 'login') {
            $username = trim($data['username'] ?? '');
            $password = $data['password'] ?? '';

            if (empty($username)) {
                http_response_code(400); echo json_encode(['error' => 'Username is required.']); exit();
            }
            if (empty($password)) {
                http_response_code(400); echo json_encode(['error' => 'Password is required.']); exit();
            }

            // Look up the user by username.
            $stmt = $db->prepare('SELECT * FROM `users` WHERE username = :username');
            $stmt->execute([':username' => $username]);
            $user = $stmt->fetch();

            if ($user) {
                // Use crypt() to verify the password against the stored hash.
                $salt = $user['password'];
                if (crypt($password, $salt) === $salt) {
                    // Correct password — save user info to session.
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    echo json_encode([
                        'status' => 'logged_in',
                        'user' => [
                            'id' => $user['id'],
                            'username' => $user['username']
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
        // Validates new user input, checks for duplicate accounts,
        // hashes the password, saves to DB, then auto-logs them in.
        } elseif ($action === 'register') {
            $username = trim(strip_tags($data['username'] ?? ''));
            $email = trim(strip_tags($data['email'] ?? ''));
            $password = $data['password'] ?? '';

            // Basic validation checks.
            if (empty($username)) {
                http_response_code(400); echo json_encode(['error' => 'Username is required.']); exit();
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400); echo json_encode(['error' => 'Valid email is required.']); exit();
            }
            if (empty($password) || strlen($password) < 6) {
                http_response_code(400); echo json_encode(['error' => 'Password must be at least 6 characters.']); exit();
            }

            // Make sure the username or email isn't already taken.
            $stmt = $db->prepare('SELECT COUNT(*) FROM `users` WHERE username = :username OR email = :email');
            $stmt->execute([':username' => $username, ':email' => $email]);
            if ($stmt->fetchColumn() > 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Username or email already registered.']);
                exit();
            }

            // Generate a secure random salt and hash the password using Blowfish (bcrypt).
            $salt = '$2y$10$' . bin2hex(random_bytes(11)) . '$';
            $hashedPassword = crypt($password, $salt);

            // Create a unique ID and insert the new user into the DB.
            $id = uniqid('user_', true);
            $stmt = $db->prepare('INSERT INTO `users` (id, username, email, password) VALUES (:id, :username, :email, :password)');
            $stmt->execute([':id' => $id, ':username' => $username, ':email' => $email, ':password' => $hashedPassword]);

            // Auto-login: save the new user's info to the session right away.
            $_SESSION['user_id'] = $id;
            $_SESSION['username'] = $username;

            echo json_encode([
                'status' => 'registered',
                'user' => [
                    'id' => $id,
                    'username' => $username
                ]
            ]);
            exit();

        // ── LOGOUT ─────────────────────────────────────────────
        // Destroys the session, effectively logging the user out.
        } elseif ($action === 'logout') {
            session_destroy();
            echo json_encode(['status' => 'logged_out']);
            exit();
        }

        // All other POST routes below require the user to be logged in.
        $userId = requireAuth();

        // ── CREATE PROJECT ─────────────────────────────────────
        // Inserts a new project row into the DB linked to this user.
        if ($action === 'create_project') {
            if (empty($data['name'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'name' required."]); exit();
            }
            $id   = $data['id'] ?? uniqid('proj_', true);
            $name = trim(strip_tags($data['name']));
            $desc = trim(strip_tags($data['description'] ?? ''));
            $db->prepare('INSERT INTO `projects` (id,user_id,name,description) VALUES (:id,:user_id,:name,:description)')
               ->execute([':id'=>$id,':user_id'=>$userId,':name'=>$name,':description'=>$desc]);
            http_response_code(201);
            echo json_encode(['status'=>'created','id'=>$id]);

        // ── CREATE TASK ────────────────────────────────────────
        // Adds a new task to a project. First checks that the project
        // actually belongs to this user (ownership check), then validates
        // the status/priority values before inserting.
        } elseif ($action === 'create_task') {
            if (empty($data['projectId']) || empty($data['title'])) {
                http_response_code(400); echo json_encode(['error' => "Fields 'projectId' and 'title' required."]); exit();
            }

            // Make sure the project belongs to this user before adding a task to it.
            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['projectId'], ':user_id' => $userId]);
            if ($checkProj->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your project.']); exit();
            }

            $id       = $data['id'] ?? uniqid('task_', true);
            $title    = trim(strip_tags($data['title']));
            $desc     = trim(strip_tags($data['description'] ?? ''));
            $status   = $data['status']   ?? 'todo';
            $priority = $data['priority'] ?? 'low';

            // Only allow known status and priority values — reject anything else.
            $allowed_statuses   = ['todo', 'in_progress', 'review', 'done'];
            $allowed_priorities = ['low', 'medium', 'high'];
            if (!in_array($status, $allowed_statuses) || !in_array($priority, $allowed_priorities)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid status or priority value.']);
                exit();
            }
            $deadline = !empty($data['deadline']) ? $data['deadline'] : null;
            $db->prepare('INSERT INTO `tasks` (id,project_id,title,description,status,priority,deadline)
                          VALUES (:id,:project_id,:title,:description,:status,:priority,:deadline)')
               ->execute([':id'=>$id,':project_id'=>$data['projectId'],':title'=>$title,
                          ':description'=>$desc,':status'=>$status,':priority'=>$priority,':deadline'=>$deadline]);
            http_response_code(201);
            echo json_encode(['status'=>'created','id'=>$id]);

        // ── UPDATE TASK ────────────────────────────────────────
        // Updates one or more fields on an existing task.
        // Only updates the fields that were actually sent in the request
        // (builds the SQL dynamically). Ownership is checked first.
        } elseif ($action === 'update_task') {
            if (empty($data['id'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'id' required."]); exit();
            }

            // Check that this task belongs to a project owned by this user.
            $checkTask = $db->prepare('SELECT COUNT(*) FROM `tasks` t 
                                       INNER JOIN `projects` p ON t.project_id = p.id 
                                       WHERE t.id = :id AND p.user_id = :user_id');
            $checkTask->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkTask->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your task.']); exit();
            }

            $allowed_statuses = ['todo', 'in_progress', 'review', 'done'];
            $allowed_priorities = ['low', 'medium', 'high'];
            
            // Grab each field from the request if it was provided.
            $title    = isset($data['title']) ? trim(strip_tags($data['title'])) : null;
            $desc     = isset($data['description']) ? trim(strip_tags($data['description'])) : null;
            $status   = $data['status'] ?? null;
            $priority = $data['priority'] ?? null;
            $deadline = !empty($data['deadline']) ? $data['deadline'] : null;
            
            // Build the UPDATE query dynamically — only include fields that were sent.
            $updates = [];
            $params = [':id' => $data['id']];
            
            if ($title !== null) { $updates[] = 'title=:title'; $params[':title'] = $title; }
            if ($desc !== null) { $updates[] = 'description=:description'; $params[':description'] = $desc; }
            if ($status !== null) {
                if (!in_array($status, $allowed_statuses)) {
                    http_response_code(400); echo json_encode(['error' => 'Invalid status value.']); exit();
                }
                $updates[] = 'status=:status'; $params[':status'] = $status;
            }
            if ($priority !== null) {
                if (!in_array($priority, $allowed_priorities)) {
                    http_response_code(400); echo json_encode(['error' => 'Invalid priority value.']); exit();
                }
                $updates[] = 'priority=:priority'; $params[':priority'] = $priority;
            }
            if (isset($data['deadline'])) { 
                $updates[] = 'deadline=:deadline'; $params[':deadline'] = $deadline; 
            }
            
            // Run the update only if there's at least one field to change.
            if (!empty($updates)) {
                $sql = 'UPDATE `tasks` SET ' . implode(', ', $updates) . ' WHERE id=:id';
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
            }
            echo json_encode(['status'=>'updated']);

        // ── DELETE TASK ────────────────────────────────────────
        // Deletes a task from the DB after verifying the user owns it.
        } elseif ($action === 'delete_task') {
            if (empty($data['id'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'id' required."]); exit();
            }

            // Ownership check — make sure this task belongs to this user.
            $checkTask = $db->prepare('SELECT COUNT(*) FROM `tasks` t 
                                       INNER JOIN `projects` p ON t.project_id = p.id 
                                       WHERE t.id = :id AND p.user_id = :user_id');
            $checkTask->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkTask->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your task.']); exit();
            }

            $db->prepare('DELETE FROM `tasks` WHERE id=:id')->execute([':id'=>$data['id']]);
            echo json_encode(['status'=>'deleted']);

        // ── UPDATE PROJECT ─────────────────────────────────────
        // Updates the name and description of a project.
        // Checks ownership before making any changes.
        } elseif ($action === 'update_project') {
            if (empty($data['id']) || empty($data['name'])) {
                http_response_code(400); echo json_encode(['error' => "Fields 'id' and 'name' required."]); exit();
            }

            // Make sure this project belongs to the logged-in user.
            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkProj->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your project.']); exit();
            }

            $name = trim(strip_tags($data['name']));
            $desc = trim(strip_tags($data['description'] ?? ''));
            $db->prepare('UPDATE `projects` SET name=:name, description=:description WHERE id=:id')
               ->execute([':id'=>$data['id'], ':name'=>$name, ':description'=>$desc]);
            echo json_encode(['status'=>'updated']);

        // ── DELETE PROJECT ─────────────────────────────────────
        // Deletes a project from the DB after verifying ownership.
        // (Tasks linked to this project will also be removed via DB cascade.)
        } elseif ($action === 'delete_project') {
            if (empty($data['id'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'id' required."]); exit();
            }

            // Make sure this project belongs to the logged-in user.
            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkProj->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your project.']); exit();
            }

            $db->prepare('DELETE FROM `projects` WHERE id=:id')->execute([':id'=>$data['id']]);
            echo json_encode(['status'=>'deleted']);

        } else {
            // Unknown POST action — send back a 400 error.
            http_response_code(400); echo json_encode(['error' => 'Unknown POST action.']);
        }
        break;

    // ─────────────────────────────────────────────────────────
    // CATCH-ALL: Any other HTTP method (PUT, DELETE, etc.)
    // is not supported — respond with 405 Method Not Allowed.
    // ─────────────────────────────────────────────────────────
    default:
        http_response_code(405); echo json_encode(['error' => 'Method not allowed.']);
}
