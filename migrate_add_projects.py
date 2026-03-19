#!/usr/bin/env python3
"""Migration: add projects table and project_id to tickets."""
import os
import mysql.connector

conn = mysql.connector.connect(
    host=os.getenv('DB_HOST', '127.0.0.1'),
    port=int(os.getenv('DB_PORT', 3306)),
    user=os.getenv('DB_USER', 'ailab'),
    password=os.getenv('DB_PASSWORD', 'ailab'),
    database=os.getenv('DB_NAME', 'kanban'),
)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS projects (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  description        TEXT,
  priority           ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status             ENUM('planning','active','on_hold','completed') NOT NULL DEFAULT 'planning',
  planned_start_date DATE,
  planned_end_date   DATE,
  actual_start_date  DATE,
  actual_end_date    DATE,
  created_by         INT UNSIGNED,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
)
""")
print("projects table created (or already exists)")

# Add project_id to tickets if not already present
cur.execute("""
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tickets'
    AND COLUMN_NAME = 'project_id'
""")
(count,) = cur.fetchone()
if count == 0:
    cur.execute("""
      ALTER TABLE tickets
        ADD COLUMN project_id INT UNSIGNED NULL,
        ADD CONSTRAINT fk_tickets_project
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    """)
    print("project_id column added to tickets")
else:
    print("project_id column already exists in tickets")

conn.commit()
cur.close()
conn.close()
print("Migration complete.")
