#!/usr/bin/env python3
"""
setup_db.py — Creates the 'kanban' database and all tables on 192.168.1.150.
Run locally: python3 setup_db.py

Tables created:
  users, projects, tickets, comments, sprints,
  ai_news, news_user_state, ticket_bookmarks
"""

import sys
import yaml
import mysql.connector
from mysql.connector import errorcode

CONFIG_FILE = "config.yaml"

with open(CONFIG_FILE) as f:
    cfg = yaml.safe_load(f)["mysql"]

# ── Connect without selecting a database so we can CREATE DATABASE ────────────
try:
    conn = mysql.connector.connect(
        host=cfg["host"],
        port=cfg["port"],
        user=cfg["user"],
        password=cfg["password"],
    )
except mysql.connector.Error as err:
    print(f"Connection error: {err}")
    sys.exit(1)

cursor = conn.cursor()

DB_NAME = cfg["database"]  # "kanban"

# ── Create database ───────────────────────────────────────────────────────────
cursor.execute(
    f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
)
print(f"Database '{DB_NAME}' ready.")

cursor.execute(f"USE `{DB_NAME}`")

# ── Tables (order matters — respect foreign key dependencies) ─────────────────
TABLES = {}

TABLES["users"] = """
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["projects"] = """
CREATE TABLE IF NOT EXISTS projects (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    priority           ENUM('low','medium','high')                       NOT NULL DEFAULT 'medium',
    status             ENUM('planning','active','on_hold','completed')   NOT NULL DEFAULT 'planning',
    planned_start_date DATE          NULL,
    planned_end_date   DATE          NULL,
    actual_start_date  DATE          NULL,
    actual_end_date    DATE          NULL,
    created_by         INT UNSIGNED  NULL,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_projects_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["sprints"] = """
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["tickets"] = """
CREATE TABLE IF NOT EXISTS tickets (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)  NOT NULL,
    description TEXT,
    status      ENUM('backlog','todo','in_progress','done') NOT NULL DEFAULT 'backlog',
    priority    ENUM('low','medium','high')                 NOT NULL DEFAULT 'medium',
    assignee_id INT UNSIGNED  NULL,
    due_date    DATE          NULL,
    project_id  INT UNSIGNED  NULL,
    sprint_id   INT UNSIGNED  NULL,
    created_by  INT UNSIGNED  NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
    CONSTRAINT fk_tickets_creator  FOREIGN KEY (created_by)  REFERENCES users(id),
    CONSTRAINT fk_tickets_project  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_sprint   FOREIGN KEY (sprint_id)   REFERENCES sprints(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["comments"] = """
CREATE TABLE IF NOT EXISTS comments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id   INT UNSIGNED  NOT NULL,
    user_id     INT UNSIGNED  NOT NULL,
    body        TEXT          NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user   FOREIGN KEY (user_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["ai_news"] = """
CREATE TABLE IF NOT EXISTS ai_news (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(500)  NOT NULL,
    url          VARCHAR(1000) NOT NULL,
    source       VARCHAR(100),
    summary      TEXT,
    ai_summary   TEXT,
    published_at DATETIME,
    fetched_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
    is_agentic   TINYINT(1)    NOT NULL DEFAULT 0,
    UNIQUE KEY unique_url (url(500))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["news_user_state"] = """
CREATE TABLE IF NOT EXISTS news_user_state (
    user_id       INT      NOT NULL,
    news_id       INT      NOT NULL,
    is_read       TINYINT(1) NOT NULL DEFAULT 0,
    is_bookmarked TINYINT(1) NOT NULL DEFAULT 0,
    updated_at    DATETIME   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, news_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

TABLES["ticket_bookmarks"] = """
CREATE TABLE IF NOT EXISTS ticket_bookmarks (
    user_id    INT      NOT NULL,
    ticket_id  INT      NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

for table_name, ddl in TABLES.items():
    try:
        cursor.execute(ddl)
        print(f"  Table '{table_name}' ready.")
    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_TABLE_EXISTS_ERROR:
            print(f"  Table '{table_name}' already exists.")
        else:
            print(f"  Error creating '{table_name}': {err}")
            sys.exit(1)

conn.commit()
cursor.close()
conn.close()
print("\nDone. kanban database is ready.")
