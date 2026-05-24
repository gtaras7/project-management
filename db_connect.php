<?php
/**
 * db_connect.php — PDO singleton
 * MAMP default MySQL password is 'root'. Change if you set a custom password.
 */

// ─────────────────────────────────────────────────────────────
// DATABASE CONNECTION CLASS
// A singleton — only one database connection is ever created
// and reused throughout the app. Avoids opening duplicates.
// ─────────────────────────────────────────────────────────────
class DatabaseConnection {

    // Connection credentials — private so they can't be read from outside.
    private static string $host     = 'localhost';
    private static string $db_name  = 'project_tracker';
    private static string $username = 'root';
    private static string $password = 'root';

    // Holds the single PDO instance once created.
    private static ?PDO $conn = null;

    // Returns the database connection.
    // Creates it the first time; returns the existing one on subsequent calls.
    public static function getConnection(): PDO {
        if (self::$conn === null) {
            try {
                $dsn = "mysql:host=" . self::$host . ";dbname=" . self::$db_name . ";charset=utf8mb4";

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

    // Returns the host and database name as an array.
    public static function getStats(): array {
        return [
            'host'    => self::$host,
            'db_name' => self::$db_name,
        ];
    }
}
