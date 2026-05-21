-- DevBoard Project Tracker — run this in phpMyAdmin › SQL tab

CREATE DATABASE IF NOT EXISTS `project_tracker`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `project_tracker`;

CREATE TABLE IF NOT EXISTS `projects` (
  `id`          VARCHAR(50)  NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id`          VARCHAR(50)  NOT NULL,
  `project_id`  VARCHAR(50)  NOT NULL,
  `title`       VARCHAR(150) NOT NULL,
  `description` TEXT,
  `status`      ENUM('todo','in_progress','review','done') NOT NULL DEFAULT 'todo',
  `priority`    ENUM('low','medium','high')                NOT NULL DEFAULT 'low',
  `deadline`    DATE         DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_project_relation`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO `projects` (`id`, `name`, `description`) VALUES
  ('proj-1', 'PHP Backend Portfolio',
   'Coursework Project #1: Integrating secure database wrappers, custom routes, and templates.'),
  ('proj-2', 'E-Commerce Database Schema',
   'Coursework Project #2: Generating SQL entity diagrams, referential constraints, and seeding defaults.');

INSERT INTO `tasks` (`id`, `project_id`, `title`, `description`, `status`, `priority`, `deadline`) VALUES
  ('task-1','proj-1','Configure PDO DB connection',
   'Establish secure connection parameters utilizing parameterized PDO constructor.','done','high','2026-05-25'),
  ('task-2','proj-1','Write POST contact form validator',
   'Construct server-side validator using htmlspecialchars and filter_var routines.','in_progress','medium','2026-05-28'),
  ('task-3','proj-1','Implement hash verification middleware',
   'Integrate password_hash() and password_verify() callbacks.','todo','high','2026-06-01'),
  ('task-4','proj-2','Draw MySQL relational constraints mapping',
   'Outline entity fields, primary identifiers, and cascading update conditions.','done','low','2026-05-22'),
  ('task-5','proj-2','Refine SQL integrity indexes',
   'Review index structures to accelerate query processing on order item lists.','todo','medium','2026-06-03');
