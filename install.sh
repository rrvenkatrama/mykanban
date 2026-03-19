#!/usr/bin/env bash
# install.sh — Full install of MyKanban on a fresh Ubuntu server
# Usage: bash install.sh
# Run as the target user (not root). Needs sudo for apt installs.
#
# What this does:
#   1. Installs Node.js 20 and MySQL 8
#   2. Creates the MySQL user + kanban database + all tables
#   3. Copies app files, installs npm deps
#   4. Sets up systemd user service with auto-start on reboot
#
# Edit the CONFIG section below before running.

set -e

# ── CONFIG ────────────────────────────────────────────────────────────────────
APP_DIR="$HOME/kanban-api"          # Where the app lives on the server
PORT=3002
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=kanban
DB_USER=ailab
DB_PASSWORD=ailab                   # Change this
JWT_SECRET=change_me_in_production  # Change this to a long random string
# ─────────────────────────────────────────────────────────────────────────────

echo "==> [1/5] Installing Node.js 20 and MySQL 8..."
sudo apt-get update -q
sudo apt-get install -y curl mysql-server

# Install Node.js 20 via NodeSource
if ! command -v node &>/dev/null || [[ $(node -e "process.exit(process.version.split('.')[0].slice(1) < 20 ? 1 : 0)" 2>/dev/null; echo $?) -ne 0 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"
echo "  MySQL: $(mysql --version)"

echo ""
echo "==> [2/5] Configuring MySQL..."
sudo systemctl start mysql

# Create DB user and database
sudo mysql <<SQL
CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASSWORD}';
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_HOST}';
FLUSH PRIVILEGES;
SQL

echo "  MySQL user '${DB_USER}' and database '${DB_NAME}' ready."

echo ""
echo "==> [3/5] Creating database tables..."
mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<SQL
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)  NOT NULL,
    description TEXT,
    status      ENUM('backlog','todo','in_progress','done') NOT NULL DEFAULT 'backlog',
    priority    ENUM('low','medium','high')                 NOT NULL DEFAULT 'medium',
    assignee_id INT UNSIGNED  NULL,
    due_date    DATE          NULL,
    created_by  INT UNSIGNED  NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users(id),
    CONSTRAINT fk_tickets_creator  FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ticket_id   INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    body        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

echo "  Tables: users, tickets, comments — ready."

echo ""
echo "==> [4/5] Installing app..."
mkdir -p "${APP_DIR}"

# Copy files — assumes this script is run from the project root
# or that kanban-api/ exists in the current directory
if [ -d "./kanban-api" ]; then
  cp -r ./kanban-api/. "${APP_DIR}/"
  echo "  Copied kanban-api/ to ${APP_DIR}"
else
  echo "  WARNING: ./kanban-api not found. Copy files manually to ${APP_DIR}"
fi

cd "${APP_DIR}"
npm install --omit=dev
echo "  npm dependencies installed."

echo ""
echo "==> [5/5] Setting up systemd user service..."
mkdir -p "${HOME}/.config/systemd/user"

cat > "${HOME}/.config/systemd/user/kanban-api.service" <<SERVICE
[Unit]
Description=Kanban API + Frontend
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=JWT_SECRET=${JWT_SECRET}
Environment=DB_HOST=${DB_HOST}
Environment=DB_PORT=${DB_PORT}
Environment=DB_USER=${DB_USER}
Environment=DB_PASSWORD=${DB_PASSWORD}
Environment=DB_NAME=${DB_NAME}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
systemctl --user enable kanban-api
loginctl enable-linger "${USER}"
systemctl --user restart kanban-api

sleep 2
systemctl --user status kanban-api --no-pager

echo ""
echo "============================================================"
echo "  MyKanban is running at http://$(hostname -I | awk '{print $1}'):${PORT}"
echo ""
echo "  Register your first user:"
echo "    curl -X POST http://localhost:${PORT}/api/auth/register \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"name\":\"Your Name\",\"email\":\"you@example.com\",\"password\":\"yourpassword\"}'"
echo ""
echo "  Service commands:"
echo "    systemctl --user status kanban-api"
echo "    systemctl --user restart kanban-api"
echo "    journalctl --user -u kanban-api -f"
echo "============================================================"
