#!/usr/bin/env python3
"""
migrate_add_sprints.py — Adds sprints table and sprint_id column to tickets.
Run locally: python3 migrate_add_sprints.py
"""

import sys
import yaml
import mysql.connector

CONFIG_FILE = "config.yaml"

with open(CONFIG_FILE) as f:
    cfg = yaml.safe_load(f)["mysql"]

try:
    conn = mysql.connector.connect(
        host=cfg["host"], port=cfg["port"],
        user=cfg["user"], password=cfg["password"],
        database=cfg["database"],
    )
except mysql.connector.Error as err:
    print(f"Connection error: {err}")
    sys.exit(1)

cursor = conn.cursor()

# Step 1: Create sprints table
try:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sprints (
            id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name        VARCHAR(255) NOT NULL,
            project_id  INT UNSIGNED NOT NULL,
            status      ENUM('planned','active','completed') NOT NULL DEFAULT 'planned',
            start_date  DATE NULL,
            end_date    DATE NULL,
            created_by  INT UNSIGNED NULL,
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_sprints_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            CONSTRAINT fk_sprints_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    conn.commit()
    print("  OK: Create sprints table")
except mysql.connector.Error as err:
    print(f"  ERROR: Create sprints table: {err}")
    sys.exit(1)

# Step 2: Add sprint_id column to tickets (check first — MySQL 8.4 has no ADD COLUMN IF NOT EXISTS)
cursor.execute("""
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'sprint_id'
""", (cfg["database"],))
(col_exists,) = cursor.fetchone()

if col_exists:
    print("  SKIP (already done): Add sprint_id column to tickets")
else:
    try:
        cursor.execute("ALTER TABLE tickets ADD COLUMN sprint_id INT UNSIGNED NULL AFTER project_id")
        conn.commit()
        print("  OK: Add sprint_id column to tickets")
    except mysql.connector.Error as err:
        print(f"  ERROR: Add sprint_id column: {err}")
        sys.exit(1)

# Step 3: Add FK (idempotent via errno 1826 / 1061)
try:
    cursor.execute("""
        ALTER TABLE tickets
        ADD CONSTRAINT fk_tickets_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
    """)
    conn.commit()
    print("  OK: Add sprint_id foreign key")
except mysql.connector.Error as err:
    if err.errno in (1061, 1826):
        print("  SKIP (already done): Add sprint_id foreign key")
    else:
        print(f"  ERROR: Add sprint_id foreign key: {err}")
        sys.exit(1)

cursor.close()
conn.close()
print("\nDone. Sprints migration complete.")
