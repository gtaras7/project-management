<?php
/**
 * delete_task.php — Process task deletion (DELETE)
 * DevBoard Project Tracker
 */
require_once 'db_connect.php';

$id = $_GET['id'] ?? '';
if (empty($id)) {
    header('Location: index.php');
    exit();
}

$db = DatabaseConnection::getConnection();

// Verify the task exists before deleting
$stmt = $db->prepare('SELECT id FROM `tasks` WHERE id = :id');
$stmt->execute([':id' => $id]);
if (!$stmt->fetch()) {
    header('Location: index.php');
    exit();
}

$db->prepare('DELETE FROM `tasks` WHERE id = :id')->execute([':id' => $id]);

header('Location: index.php?deleted=1');
exit();
