<?php
/**
 * db_connect.php — PDO singleton
 * MAMP default MySQL password is 'root'. Change if you set a custom password.
 */
class DatabaseConnection {
    private static string $host     = 'localhost';  // MAMP free (v5+): use 'localhost:/Applications/MAMP/tmp/mysql/mysql.sock' if port 3306 fails
    private static string $db_name  = 'project_tracker';
    private static string $username = 'root';
    private static string $password = 'root';
    private static ?PDO   $conn     = null;

    public static function getConnection(): PDO {
        if (self::$conn === null) {
            try {
                $dsn = "mysql:host=".self::$host.";dbname=".self::$db_name.";charset=utf8mb4";
                self::$conn = new PDO($dsn, self::$username, self::$password, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'DB connection failed. Check MAMP is running and credentials are correct.']);
                exit();
            }
        }
        return self::$conn;
    }
}
