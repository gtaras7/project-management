export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string; // YYYY-MM-DD format
  createdAt: string;
}

export interface PHPDatabaseConfig {
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbHost: string;
  phpVersion: string;
  tableNameProjects: string;
  tableNameTasks: string;
}

export interface WebLogEntry {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'INFO';
  path: string;
  statusCode: number;
  message: string;
}
