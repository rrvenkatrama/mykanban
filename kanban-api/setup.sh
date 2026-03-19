#!/usr/bin/env bash
# setup.sh — Run on Ubuntu server (as root or sudo) to install kanban-api + build the UI.
# Usage: sudo bash ~/kanban-setup.sh
set -e

API_DIR=/home/rajramani/kanban-api
UI_DIR=/home/rajramani/kanban-ui

echo "==> Ensuring Node.js is available"
node --version || { echo "ERROR: Node.js not found. Install it first."; exit 1; }
npm  --version

echo "==> Creating directories"
mkdir -p "$API_DIR/public"
mkdir -p "$UI_DIR/src/components"

echo "==> Installing API dependencies"
cd "$API_DIR"
npm install --omit=dev

echo "==> Installing UI dependencies"
cd "$UI_DIR"
npm install

echo "==> Building React frontend (output → $API_DIR/public)"
npm run build

echo "==> Installing systemd service"
cp /home/rajramani/kanban-api.service /etc/systemd/system/kanban-api.service
systemctl daemon-reload
systemctl enable kanban-api
systemctl restart kanban-api

echo ""
echo "==> Done. Service status:"
systemctl status kanban-api --no-pager
echo ""
echo "Open http://192.168.1.150:3002 in your browser."
