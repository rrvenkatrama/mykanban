#!/usr/bin/env python3
"""
migrate_add_comments.py — Adds the comments table to the kanban database.
Run locally: python3 migrate_add_comments.py
"""

import sys
import yaml
import mysql.connector
from mysql.connector import errorcode

CONFIG_FILE = "config.yaml"

with open(CONFIG_FILE) as f:
    cfg = yaml.safe_load(f)["mysql"]

try:
    conn = mysql.connector.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["database"],
    )
except mysql.connector.Error as err:
    print(f"Connection error: {err}")
    sys.exit(1)

cursor = conn.cursor()

DDL = """
CREATE TABLE IF NOT EXISTS comments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  body        TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

try:
    cursor.execute(DDL)
    print("Table 'comments' ready.")
except mysql.connector.Error as err:
    if err.errno == errorcode.ER_TABLE_EXISTS_ERROR:
        print("Table 'comments' already exists.")
    else:
        print(f"Error creating 'comments': {err}")
        sys.exit(1)

conn.commit()
cursor.close()
conn.close()
print("Done.")
