<?php
/**
 * api.php — REST endpoint for DevBoard Project Tracker
 * All responses are JSON. Routes via ?action= query param.
 */
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once 'db_connect.php';
$action = $_GET['action'] ?? '';
$db     = DatabaseConnection::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if ($action === 'projects') {
            $stmt = $db->query('SELECT * FROM `projects` ORDER BY created_at DESC');
            echo json_encode($stmt->fetchAll());
        } elseif ($action === 'tasks') {
            $stmt = $db->query('SELECT * FROM `tasks` ORDER BY deadline ASC, created_at DESC');
            echo json_encode($stmt->fetchAll());
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Use ?action=projects or ?action=tasks']);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if ($action === 'create_project') {
            if (empty($data['name'])) {
                http_response_code(400); echo json_encode(['error' => "Field 'name' required."]); exit();
            }
            $id   = $data['id'] ?? uniqid('proj_', true);
            $name = trim(strip_tags($data['name']));
            $desc = trim(strip_tags($data['description'] ?? ''));
            $db->prepare('INSERT INTO `projects` (id,name,description) VALUES (:id,:name,:description)')
               ->execute([':id'=>$id,':name'=>$name,':description'=>$desc]);
            http_response_code(201);
            echo json_encode(['status'=>'created','id'=>$id]);

        } elseif ($action === 'create_task') {
            if (empty($data['projectId']) || empty($data['title'])) {
                http_response_code(400); echo json_encode(['error' => "Fields 'projectId' and 'title' required."]); exit();
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
            $allowed_statuses = ['todo', 'in_progress', 'review', 'done'];
            $allowed_priorities = ['low', 'medium', 'high'];
            
            // Allow full update of task properties
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
            $db->prepare('DELETE FROM `tasks` WHERE id=:id')->execute([':id'=>$data['id']]);
            echo json_encode(['status'=>'deleted']);

        } elseif ($action === 'update_project') {
            if (empty($data['id']) || empty($data['name'])) {
                http_response_code(400); echo json_encode(['error' => "Fields 'id' and 'name' required."]); exit();
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
            $db->prepare('DELETE FROM `projects` WHERE id=:id')->execute([':id'=>$data['id']]);
            echo json_encode(['status'=>'deleted']);

        } else {
            http_response_code(400); echo json_encode(['error' => 'Unknown POST action.']);
        }
        break;

    default:
        http_response_code(405); echo json_encode(['error' => 'Method not allowed.']);
}
