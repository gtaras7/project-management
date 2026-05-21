<?php
/**
 * delete_project.php — Process project deletion (DELETE)
 * Cascades to tasks via FK ON DELETE CASCADE.
 * DevBoard Project Tracker
 */
require_once 'db_connect.php';

$id = $_GET['id'] ?? '';
if (empty($id)) {
    header('Location: index.php');
    exit();
}

$db = DatabaseConnection::getConnection();

// Verify the project exists before deleting
$stmt = $db->prepare('SELECT id FROM `projects` WHERE id = :id');
$stmt->execute([':id' => $id]);
if (!$stmt->fetch()) {
    header('Location: index.php');
    exit();
}

// Delete — tasks cascade automatically via FK constraint
$db->prepare('DELETE FROM `projects` WHERE id = :id')->execute([':id' => $id]);

header('Location: index.php?deleted=1');
exit();
