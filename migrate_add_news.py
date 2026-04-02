#!/usr/bin/env python3
"""Migration: create ai_news table"""
import mysql.connector

conn = mysql.connector.connect(
    host='127.0.0.1', port=3306,
    user='ailab', password='ailab', database='kanban'
)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS ai_news (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(500) NOT NULL,
  url          VARCHAR(1000) NOT NULL,
  source       VARCHAR(100),
  summary      TEXT,
  published_at DATETIME,
  fetched_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_agentic   TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY unique_url (url(500))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

conn.commit()
cur.close()
conn.close()
print("ai_news table created (or already exists).")
