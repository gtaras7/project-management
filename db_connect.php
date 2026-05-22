<?php
/**
 * db_connect.php — PDO singleton
 * MAMP default MySQL password is 'root'. Change if you set a custom password.
 */

// ─────────────────────────────────────────────────────────────
// SECTION 1: DATABASE CONNECTION CLASS
// This is a "singleton" — meaning only ONE database connection
// is ever created and reused throughout the whole app.
// That keeps things efficient and avoids opening multiple connections.
// ─────────────────────────────────────────────────────────────
class DatabaseConnection {

    // ── Connection Settings ────────────────────────────────────
    // These are the credentials used to connect to your local
    // MAMP MySQL database. Change them if your setup is different.
    private static string $host     = 'localhost';  // MAMP free (v5+): use 'localhost:/Applications/MAMP/tmp/mysql/mysql.sock' if port 3306 fails
    private static string $db_name  = 'project_tracker'; // The name of the database we're connecting to
    private static string $username = 'root';             // MySQL username (MAMP default)
    private static string $password = 'root';             // MySQL password (MAMP default)

    // Holds the single connection instance once created.
    // Starts as null — nothing is connected yet.
    private static ?PDO   $conn     = null;

    // ── getConnection() ────────────────────────────────────────
    // Call this anywhere in the app to get the DB connection.
    // If a connection already exists, it just returns it (no duplicates).
    // If not, it creates one for the first time.
    public static function getConnection(): PDO {
        if (self::$conn === null) {
            try {
                // Build the DSN (Data Source Name) — basically the address of the DB.
                // Includes the host, database name, and character encoding (utf8mb4 supports emojis etc.).
                $dsn = "mysql:host=".self::$host.";dbname=".self::$db_name.";charset=utf8mb4";

                // Create the PDO connection with the credentials and a few options:
                // - ERRMODE_EXCEPTION: throw errors as exceptions instead of silently failing
                // - FETCH_ASSOC: return rows as key=>value arrays (not numbered arrays)
                // - EMULATE_PREPARES false: use real prepared statements for security
                self::$conn = new PDO($dsn, self::$username, self::$password, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);

            // ── Connection Error Handler ───────────────────────
            // If the connection fails (e.g. MAMP isn't running, wrong password),
            // send back a 500 error with a helpful message and stop the script.
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'DB connection failed. Check MAMP is running and credentials are correct.']);
                exit();
            }
        }

        // Return the existing (or newly created) connection.
        return self::$conn;
    }
}
