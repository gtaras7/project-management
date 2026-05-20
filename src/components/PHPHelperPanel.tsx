import React, { useState } from 'react';
import { PHPDatabaseConfig, WebLogEntry } from '../types';
import { Database, FileCode, CheckCircle2, Copy, AlertCircle, RefreshCw, Terminal, HelpCircle } from 'lucide-react';

interface PHPHelperPanelProps {
  dbConfig: PHPDatabaseConfig;
  setDbConfig: React.Dispatch<React.SetStateAction<PHPDatabaseConfig>>;
  webLogs: WebLogEntry[];
  clearLogs: () => void;
}

export default function PHPHelperPanel({
  dbConfig,
  setDbConfig,
  webLogs,
  clearLogs,
}: PHPHelperPanelProps) {
  const [activeTab, setActiveTab] = useState<'sql' | 'connect' | 'api' | 'setup'>('setup');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const dbHost = dbConfig.dbHost;
  const dbName = dbConfig.dbName;
  const dbUser = dbConfig.dbUser;
  const dbPassword = dbConfig.dbPassword || "YOUR_PASSWORD_HERE";
  const tblProj = dbConfig.tableNameProjects;
  const tblTask = dbConfig.tableNameTasks;

  // Generate dynamic MySQL DB Schema SQL Script
  const getSQLSchema = () => {
    return `-- ==========================================
-- PHP CLASS PROJECT: MySQL Schema Setup
-- Generated dynamically by DevBoard Project Manager
-- ==========================================

-- 1. Create the database statement (Execute in phpMyAdmin / Adminer)
CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`${dbName}\`;

-- 2. Projects Table Statement
CREATE TABLE IF NOT EXISTS \`${tblProj}\` (
  \`id\` VARCHAR(50) NOT NULL,
  \`name\` VARCHAR(100) NOT NULL,
  \`description\` TEXT,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;

-- 3. Tasks Table Statement (Includes Relational Foreign Key)
CREATE TABLE IF NOT EXISTS \`${tblTask}\` (
  \`id\` VARCHAR(50) NOT NULL,
  \`project_id\` VARCHAR(50) NOT NULL,
  \`title\` VARCHAR(150) NOT NULL,
  \`description\` TEXT,
  \`status\` ENUM('todo', 'in_progress', 'review', 'done') NOT NULL DEFAULT 'todo',
  \`priority\` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
  \`deadline\` DATE DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_project_relation\` 
    FOREIGN KEY (\`project_id\`) 
    REFERENCES \`${tblProj}\` (\`id\`) 
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Sample Seed Data for testing
INSERT INTO \`${tblProj}\` (\`id\`, \`name\`, \`description\`) VALUES
('proj-1', 'PHP Backend Portfolio', 'Coursework Project #1: Integrating PHP PDO and responsive templates.'),
('proj-2', 'Relational Database Schema', 'Coursework Project #2: Defining SQL entities, relational constraints & constraints.');

INSERT INTO \`${tblTask}\` (\`id\`, \`project_id\`, \`title\`, \`description\`, \`status\`, \`priority\`, \`deadline\`) VALUES
('task-1', 'proj-1', 'Configure PDO DB connection', 'Set up and test connection parameters securely using standard PHP PDO wrapper.', 'done', 'high', '2026-05-25'),
('task-2', 'proj-1', 'Write contact form handler', 'Perform sanitation, construct POST validation pipelines, and print confirmation logs.', 'in_progress', 'medium', '2026-05-28'),
('task-3', 'proj-2', 'MySQL relationships overview', 'Draw simple entity relationship mapping matching schema commands.', 'done', 'low', '2026-05-22');
`;
  };

  // Generate PDO Database Connection Class in PHP
  const getPHPDBConnect = () => {
    return `<?php
/**
 * db_connect.php
 * Database connection wrapper utilizing modern PHP PDO (PHP Data Objects).
 * 
 * Target PHP Version: ${dbConfig.phpVersion}
 * Standard practice for high grade projects to avoid SQL-injection.
 */

class DatabaseConnection {
    private static $host = '${dbHost}';
    private static $db_name = '${dbName}';
    private static $username = '${dbUser}';
    private static $password = '${dbPassword}';
    private static $conn = null;

    /**
     * Retrieve the active lazy-loaded database connection instance.
     * @return PDO
     */
    public static function getConnection() {
        if (self::$conn === null) {
            try {
                // Generate secure PDO connection string
                $dsn = "mysql:host=" . self::$host . ";dbname=" . self::$db_name . ";charset=utf8mb4";
                
                // Construct standard connection object
                self::$conn = new PDO($dsn, self::$username, self::$password, [
                    // Raise exceptions on database script syntax errors to simplify debugging
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    // Return rows indexed by column-name for structural integrity
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    // Disable emulation of prepared statements to use native driver capabilities 
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $exception) {
                // Return secure error response to keep database details safe from target inspectors
                http_response_code(500);
                echo json_encode([
                    "error" => "Database connection failed. Please inspect setting fields.",
                    "debug" => $exception->getMimeLine() // In production environment, hide detailed logs!
                ]);
                exit();
            }
        }
        return self::$conn;
    }
}
?>`;
  };

  // Generate Unified REST Controller Router in PHP
  const getPHPApi = () => {
    return `<?php
/**
 * api.php
 * Unified REST API controller for interacting with client dashboards.
 * Receives JSON requests and responds in application/json format.
 * Includes CORS Preflight triggers to coordinate visual web dashboard.
 */

// 1. Set required API JSON & CORS header values
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Auto respond immediately to standard CORS Preflight checks
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Load the database connection module
require_once "db_connect.php";

$action = isset($_GET['action']) ? $_GET['action'] : '';
$db = DatabaseConnection::getConnection();

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        if ($action === 'projects') {
            try {
                $stmt = $db->query("SELECT * FROM \`${tblProj}\` ORDER BY created_at DESC");
                $projects = $stmt->fetchAll();
                echo json_encode($projects);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "Failed fetching projects", "debug" => $e->getMessage()]);
            }
        } elseif ($action === 'tasks') {
            try {
                $stmt = $db->query("SELECT * FROM \`${tblTask}\` ORDER BY deadline ASC, created_at DESC");
                $tasks = $stmt->fetchAll();
                echo json_encode($tasks);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "Failed fetching tasks", "debug" => $e->getMessage()]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["error" => "Unknown GET action target. Specify ?action=projects or ?action=tasks."]);
        }
        break;

    case 'POST':
        // Read raw JSON post request input
        $inputData = json_decode(file_get_contents("php://input"), true);
        
        if ($action === 'create_project') {
            if (empty($inputData['name'])) {
                http_response_code(400);
                echo json_encode(["error" => "Required data 'name' is missing."]);
                exit();
            }
            try {
                $id = $inputData['id'] ?? uniqid('proj_', true);
                $name = htmlspecialchars(strip_tags($inputData['name']));
                $description = htmlspecialchars(strip_tags($inputData['description'] ?? ''));

                $stmt = $db->prepare("INSERT INTO \`${tblProj}\` (id, name, description) VALUES (:id, :name, :description)");
                $stmt->execute([
                    ':id' => $id,
                    ':name' => $name,
                    ':description' => $description
                ]);
                
                http_response_code(201);
                echo json_encode(["status" => "project created successfully", "id" => $id]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "DB creation error occurred", "debug" => $e->getMessage()]);
            }
        } elseif ($action === 'create_task') {
            if (empty($inputData['projectId']) || empty($inputData['title'])) {
                http_response_code(400);
                echo json_encode(["error" => "Required fields title/projectId missing."]);
                exit();
            }
            try {
                $id = $inputData['id'] ?? uniqid('task_', true);
                $projectId = $inputData['projectId'];
                $title = htmlspecialchars(strip_tags($inputData['title']));
                $description = htmlspecialchars(strip_tags($inputData['description'] ?? ''));
                $status = $inputData['status'] ?? 'todo';
                $priority = $inputData['priority'] ?? 'low';
                $deadline = !empty($inputData['deadline']) ? $inputData['deadline'] : null;

                $stmt = $db->prepare("INSERT INTO \`${tblTask}\` (id, project_id, title, description, status, priority, deadline) VALUES (:id, :project_id, :title, :description, :status, :priority, :deadline)");
                $stmt->execute([
                    ':id' => $id,
                    ':project_id' => $projectId,
                    ':title' => $title,
                    ':description' => $description,
                    ':status' => $status,
                    ':priority' => $priority,
                    ':deadline' => $deadline
                ]);

                http_response_code(201);
                echo json_encode(["status" => "task created successfully", "id" => $id]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "DB error tracking new task insertion", "debug" => $e->getMessage()]);
            }
        } elseif ($action === 'update_task') {
            if (empty($inputData['id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Task ID parameter is required for updates."]);
                exit();
            }
            try {
                $id = $inputData['id'];
                $status = $inputData['status'];
                
                // Allow simple Kanban status edits or full updates
                if (isset($inputData['title'])) {
                    $title = htmlspecialchars(strip_tags($inputData['title']));
                    $description = htmlspecialchars(strip_tags($inputData['description'] ?? ''));
                    $uid = $inputData['projectId'];
                    $prio = $inputData['priority'];
                    $dead = !empty($inputData['deadline']) ? $inputData['deadline'] : null;

                    $query = "UPDATE \`${tblTask}\` SET title = :title, description = :description, project_id = :project_id, status = :status, priority = :priority, deadline = :deadline WHERE id = :id";
                    $stmt = $db->prepare($query);
                    $stmt->execute([
                        ':title' => $title,
                        ':description' => $description,
                        ':project_id' => $uid,
                        ':status' => $status,
                        ':priority' => $prio,
                        ':deadline' => $dead,
                        ':id' => $id
                    ]);
                } else {
                    // Quick status edit (Kanban Drag and scale updates)
                    $stmt = $db->prepare("UPDATE \`${tblTask}\` SET status = :status WHERE id = :id");
                    $stmt->execute([':status' => $status, ':id' => $id]);
                }

                echo json_encode(["status" => "task updated successfully"]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "Failed saving updates to task", "debug" => $e->getMessage()]);
            }
        } elseif ($action === 'delete_task') {
            if (empty($inputData['id'])) {
                http_response_code(400);
                echo json_encode(["error" => "Task ID parameter is required for deletion."]);
                exit();
            }
            try {
                $id = $inputData['id'];
                $stmt = $db->prepare("DELETE FROM \`${tblTask}\` WHERE id = :id");
                $stmt->execute([':id' => $id]);
                echo json_encode(["status" => "task deleted successfully"]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(["error" => "Failed executing task deletion", "debug" => $e->getMessage()]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["error" => "Unknown POST request parameter."]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not permitted. Supported: GET, POST."]);
        break;
}
?>`;
  };

  return (
    <div id="php-helper-panel" className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            PHP Class Workspace Companion
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic database configuration parameters. Copy and drop code blocks into XAMPP / MAMP to connect.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-slate-150 p-1 rounded-lg">
          {(['setup', 'sql', 'connect', 'api'] as const).map((tab) => (
            <button
              id={`php-tab-${tab}`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tab === 'setup' && '1. Setup Config'}
              {tab === 'sql' && '2. Schema.sql'}
              {tab === 'connect' && '3. db_connect.php'}
              {tab === 'api' && '4. api.php'}
            </button>
          ))}
        </div>
      </div>

      <div className="py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[420px]">
        {/* Dynamic Parameter Settings Panel */}
        {activeTab === 'setup' ? (
          <div className="lg:col-span-12 space-y-6">
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200/60 flex gap-3 text-amber-800 text-xs leading-relaxed">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block mb-1">How This Custom Companion works:</span>
                Changes made to the parameters below dynamically update the database scripts in real-time under the other tabs. Drop these files directly into your local local server directory (e.g. <code className="bg-amber-100/80 px-1 rounded font-mono font-medium">htdocs/project-tracker/</code>) to create a real SQL backend!
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Database Host</label>
                <input
                  id="cfg-db-host"
                  type="text"
                  value={dbConfig.dbHost}
                  onChange={(e) => setDbConfig({ ...dbConfig, dbHost: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Database Name</label>
                <input
                  id="cfg-db-name"
                  type="text"
                  value={dbConfig.dbName}
                  onChange={(e) => setDbConfig({ ...dbConfig, dbName: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">DB Username (e.g. root)</label>
                <input
                  id="cfg-db-user"
                  type="text"
                  value={dbConfig.dbUser}
                  onChange={(e) => setDbConfig({ ...dbConfig, dbUser: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">DB Password (blank for XAMPP)</label>
                <input
                  id="cfg-db-password"
                  type="text"
                  placeholder="Leave empty or input password"
                  value={dbConfig.dbPassword}
                  onChange={(e) => setDbConfig({ ...dbConfig, dbPassword: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Projects Table Name</label>
                <input
                  id="cfg-tbl-projects"
                  type="text"
                  value={dbConfig.tableNameProjects}
                  onChange={(e) => setDbConfig({ ...dbConfig, tableNameProjects: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Tasks Table Name</label>
                <input
                  id="cfg-tbl-tasks"
                  type="text"
                  value={dbConfig.tableNameTasks}
                  onChange={(e) => setDbConfig({ ...dbConfig, tableNameTasks: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/60 mt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Complete Implementation Checklist for School Project:</h3>
              <ol className="text-xs text-slate-600 space-y-2.5 list-decimal pl-4">
                <li>Start your local workspace engine, typically <strong>XAMPP</strong> or <strong>MAMP</strong>, turning on Apache and MySQL components.</li>
                <li>Go to <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono">http://localhost/phpmyadmin/</code> and create database <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono">{dbConfig.dbName}</code>.</li>
                <li>Navigate to the <span className="font-semibold text-slate-800">2. Schema.sql</span> tab above, click copy, click the SQL menu in phpMyAdmin, and run the SQL query to generate the exact database tables with proper constraints.</li>
                <li>Open your code editor of choice in your Apache htdocs root, and write two files: <span className="font-semibold text-slate-800">db_connect.php</span> and <span className="font-semibold text-slate-800">api.php</span> (Copy their contents respectively from tabs 3 & 4 above).</li>
                <li>Now you have a professional REST JSON backend API running on PHP! Test accessing it directly with your browser at <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono">http://localhost/api.php?action=projects</code>.</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-12 flex flex-col h-full">
            <div className="flex justify-between items-center bg-slate-800 text-slate-300 px-4 py-3 rounded-t-xl text-xs font-semibold">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-slate-400">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                {activeTab === 'sql' && `${dbConfig.dbName}.sql`}
                {activeTab === 'connect' && 'db_connect.php'}
                {activeTab === 'api' && 'api.php'}
              </span>
              <button
                id="copy-code-btn"
                onClick={() => {
                  const code = activeTab === 'sql' 
                    ? getSQLSchema() 
                    : activeTab === 'connect' 
                      ? getPHPDBConnect() 
                      : getPHPApi();
                  handleCopy(code, activeTab);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 text-white hover:bg-indigo-600 transition-colors"
              >
                {copiedText === activeTab ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-indigo-200 p-4 rounded-b-xl text-[11px] leading-relaxed font-mono overflow-auto max-h-[400px] border border-t-0 border-slate-950">
              <code>
                {activeTab === 'sql' && getSQLSchema()}
                {activeTab === 'connect' && getPHPDBConnect()}
                {activeTab === 'api' && getPHPApi()}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* Simulator Terminal Log output */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-2.5 w-2.5 relative items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Simulated PHP/Apache Local Server Logs
            </h3>
          </div>
          <button
            id="clear-logs-btn"
            onClick={clearLogs}
            className="text-[11px] text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 h-6"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            Reset Logs
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 max-h-[160px] overflow-y-auto font-mono text-[10px] space-y-1.5 text-slate-300">
          {webLogs.length === 0 ? (
            <div className="text-slate-500 italic py-4 text-center">
              No active PHP API requests tracked yet. Modify, add or delete items on the task board above to run simulated endpoints and inspect SQL logs!
            </div>
          ) : (
            webLogs.map((log) => {
              let methodColor = 'text-sky-400';
              if (log.method === 'POST') methodColor = 'text-emerald-400';
              if (log.method === 'PUT') methodColor = 'text-amber-400';
              if (log.method === 'DELETE') methodColor = 'text-rose-400';
              if (log.method === 'INFO') methodColor = 'text-purple-400';

              const logStatusClass = log.statusCode === 200 || log.statusCode === 201 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20';

              return (
                <div key={log.id} className="flex gap-2 items-start justify-between py-1 border-b border-slate-900/40 last:border-0 hover:bg-slate-900/20 px-1 rounded">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-slate-500 text-[9px] shrink-0 mt-0.5">{log.timestamp}</span>
                    <span className={`font-bold shrink-0 ${methodColor}`}>[{log.method}]</span>
                    <span className="text-indigo-300 select-all font-semibold shrink-0">{log.path}</span>
                    <span className="text-slate-200 truncate">{log.message}</span>
                  </div>
                  <span className={`px-1 rounded text-[9px] shrink-0 ${logStatusClass}`}>
                    {log.statusCode}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
