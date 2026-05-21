<?php
/**
 * backend.php — REST endpoint for DevBoard Project Tracker with Authentication
 * All responses are JSON. Routes via ?action= query param.
 */
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

// Start secure session
session_start();

require_once 'db_connect.php';
$action = $_GET['action'] ?? '';
$db     = DatabaseConnection::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Helper to check authentication
function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized. Please log in.']);
        exit();
    }
    return $_SESSION['user_id'];
}

switch ($method) {
    case 'GET':
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

        // All other GET routes require authentication
        $userId = requireAuth();

        if ($action === 'projects') {
            $stmt = $db->prepare('SELECT * FROM `projects` WHERE user_id = :user_id ORDER BY created_at DESC');
            $stmt->execute([':user_id' => $userId]);
            echo json_encode($stmt->fetchAll());
        } elseif ($action === 'tasks') {
            $stmt = $db->prepare('SELECT t.* FROM `tasks` t 
                                  INNER JOIN `projects` p ON t.project_id = p.id 
                                  WHERE p.user_id = :user_id 
                                  ORDER BY t.deadline ASC, t.created_at DESC');
            $stmt->execute([':user_id' => $userId]);
            echo json_encode($stmt->fetchAll());
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Unknown GET action.']);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        // Authentication endpoints
        if ($action === 'login') {
            $username = trim($data['username'] ?? '');
            $password = $data['password'] ?? '';

            if (empty($username)) {
                http_response_code(400); echo json_encode(['error' => 'Username is required.']); exit();
            }
            if (empty($password)) {
                http_response_code(400); echo json_encode(['error' => 'Password is required.']); exit();
            }

            // ─── LOGIN CREDENTIALS CHECK MODELED AFTER mysqli_login.php ───
            $stmt = $db->prepare('SELECT * FROM `users` WHERE username = :username');
            $stmt->execute([':username' => $username]);
            $user = $stmt->fetch();

            if ($user) {
                $salt = $user['password'];
                // crypt verification logic
                if (crypt($password, $salt) === $salt) {
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

        } elseif ($action === 'register') {
            $username = trim(strip_tags($data['username'] ?? ''));
            $email = trim(strip_tags($data['email'] ?? ''));
            $password = $data['password'] ?? '';

            if (empty($username)) {
                http_response_code(400); echo json_encode(['error' => 'Username is required.']); exit();
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400); echo json_encode(['error' => 'Valid email is required.']); exit();
            }
            if (empty($password) || strlen($password) < 6) {
                http_response_code(400); echo json_encode(['error' => 'Password must be at least 6 characters.']); exit();
            }

            // Check if username or email already exists
            $stmt = $db->prepare('SELECT COUNT(*) FROM `users` WHERE username = :username OR email = :email');
            $stmt->execute([':username' => $username, ':email' => $email]);
            if ($stmt->fetchColumn() > 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Username or email already registered.']);
                exit();
            }

            // Generate secure Blowfish salt for crypt() matching standards
            $salt = '$2y$10$' . bin2hex(random_bytes(11)) . '$';
            $hashedPassword = crypt($password, $salt);

            $id = uniqid('user_', true);
            $stmt = $db->prepare('INSERT INTO `users` (id, username, email, password) VALUES (:id, :username, :email, :password)');
            $stmt->execute([':id' => $id, ':username' => $username, ':email' => $email, ':password' => $hashedPassword]);

            // Auto-login
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

        } elseif ($action === 'logout') {
            session_destroy();
            echo json_encode(['status' => 'logged_out']);
            exit();
        }

        // All other POST routes require authentication
        $userId = requireAuth();

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

        } elseif ($action === 'create_task') {
            if (empty($data['projectId']) || empty($data['title'])) {
                http_response_code(400); echo json_encode(['error' => "Fields 'projectId' and 'title' required."]); exit();
            }

            // Verify project belongs to user
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

        } elseif ($action === 'update_task') {
            if (empty($data['id'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'id' required."]); exit();
            }

            // Verify task belongs to a project owned by user
            $checkTask = $db->prepare('SELECT COUNT(*) FROM `tasks` t 
                                       INNER JOIN `projects` p ON t.project_id = p.id 
                                       WHERE t.id = :id AND p.user_id = :user_id');
            $checkTask->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkTask->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your task.']); exit();
            }

            $allowed_statuses = ['todo', 'in_progress', 'review', 'done'];
            $allowed_priorities = ['low', 'medium', 'high'];
            
            $title    = isset($data['title']) ? trim(strip_tags($data['title'])) : null;
            $desc     = isset($data['description']) ? trim(strip_tags($data['description'])) : null;
            $status   = $data['status'] ?? null;
            $priority = $data['priority'] ?? null;
            $deadline = !empty($data['deadline']) ? $data['deadline'] : null;
            
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
            
            if (!empty($updates)) {
                $sql = 'UPDATE `tasks` SET ' . implode(', ', $updates) . ' WHERE id=:id';
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
            }
            echo json_encode(['status'=>'updated']);

        } elseif ($action === 'delete_task') {
            if (empty($data['id'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'id' required."]); exit();
            }

            // Verify task ownership
            $checkTask = $db->prepare('SELECT COUNT(*) FROM `tasks` t 
                                       INNER JOIN `projects` p ON t.project_id = p.id 
                                       WHERE t.id = :id AND p.user_id = :user_id');
            $checkTask->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkTask->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your task.']); exit();
            }

            $db->prepare('DELETE FROM `tasks` WHERE id=:id')->execute([':id'=>$data['id']]);
            echo json_encode(['status'=>'deleted']);

        } elseif ($action === 'update_project') {
            if (empty($data['id']) || empty($data['name'])) {
                http_response_code(400); echo json_encode(['error' => "Fields 'id' and 'name' required."]); exit();
            }

            // Verify project ownership
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

        } elseif ($action === 'delete_project') {
            if (empty($data['id'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'id' required."]); exit();
            }

            // Verify project ownership
            $checkProj = $db->prepare('SELECT COUNT(*) FROM `projects` WHERE id = :id AND user_id = :user_id');
            $checkProj->execute([':id' => $data['id'], ':user_id' => $userId]);
            if ($checkProj->fetchColumn() == 0) {
                http_response_code(403); echo json_encode(['error' => 'Forbidden. Not your project.']); exit();
            }

            $db->prepare('DELETE FROM `projects` WHERE id=:id')->execute([':id'=>$data['id']]);
            echo json_encode(['status'=>'deleted']);

        } else {
            http_response_code(400); echo json_encode(['error' => 'Unknown POST action.']);
        }
        break;

    default:
        http_response_code(405); echo json_encode(['error' => 'Method not allowed.']);
}
