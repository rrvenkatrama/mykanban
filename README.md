# MyKanban — Jira-like Kanban Dashboard

A lightweight Kanban board for small teams (1–10 people). Node.js/Express REST API + React frontend, backed by MySQL.

---

## Stack

| Layer    | Tech                        | Version  |
|----------|-----------------------------|----------|
| Runtime  | Node.js                     | 20.x LTS |
| API      | Express                     | 4.x      |
| Frontend | React + Vite                | 18.x     |
| Database | MySQL                       | 8.x      |
| Auth     | JWT (jsonwebtoken + bcrypt) | —        |
| DnD      | @dnd-kit/core               | —        |
| OS       | Ubuntu 25.10                | —        |

---

## Project Structure

```
mykanban/
├── kanban-api/          # Express API + serves built frontend
│   ├── server.js        # All API routes
│   ├── public/          # Built React app (output of npm run build)
│   ├── package.json
│   └── kanban-api.service  # systemd service template
├── kanban-ui/           # React source (Vite)
│   └── src/
│       └── components/
│           ├── KanbanBoard.jsx   # Board, drag-and-drop, filters
│           └── TicketModal.jsx   # Create/edit ticket + comments
├── setup_db.py              # Creates users + tickets tables
├── migrate_add_comments.py  # Adds comments table
├── config.yaml              # DB connection config (local dev)
└── install.sh               # Full server install script
```

---

## Environment Variables (server.js reads these)

| Variable      | Default               | Description              |
|---------------|-----------------------|--------------------------|
| PORT          | 3002                  | HTTP port                |
| JWT_SECRET    | change_me_in_production | Sign/verify JWT tokens |
| DB_HOST       | 127.0.0.1             | MySQL host               |
| DB_PORT       | 3306                  | MySQL port               |
| DB_USER       | ailab                 | MySQL user               |
| DB_PASSWORD   | ailab                 | MySQL password           |
| DB_NAME       | kanban                | MySQL database name      |

Set these in the systemd service file before deploying to production.

---

## Local Development Build

```bash
# 1. Build the React frontend (outputs to kanban-api/public/)
cd kanban-ui && npm install && npm run build

# 2. Deploy to server
rsync -avz kanban-api/ rajramani@192.168.1.150:/home/rajramani/kanban-api/
```

---

## Deployment (Manual)

```bash
# On the server:
cd /home/rajramani/kanban-api && npm install --omit=dev

# Set up DB (first time only):
mysql -h 127.0.0.1 -u ailab -p kanban < /path/to/schema.sql
# or run: python3 setup_db.py && python3 migrate_add_comments.py

# Install and start service:
mkdir -p ~/.config/systemd/user
cp kanban-api.service ~/.config/systemd/user/
# Edit the service file: set JWT_SECRET and DB_PASSWORD
systemctl --user daemon-reload
systemctl --user enable kanban-api
loginctl enable-linger $USER
systemctl --user start kanban-api
```

---

## Service Management

```bash
systemctl --user status kanban-api     # check status
systemctl --user restart kanban-api    # restart
systemctl --user stop kanban-api       # stop
journalctl --user -u kanban-api -f     # live logs
journalctl --user -u kanban-api -n 50  # last 50 lines
```

---

## Adding Users

There is no admin UI. Register via the API:

```bash
curl -X POST http://<server>:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"you@example.com","password":"yourpassword"}'
```

---

## Database Schema

```sql
users       (id, name, email, password_hash, created_at)
tickets     (id, title, description, status, priority, assignee_id, due_date, created_by, created_at, updated_at)
comments    (id, ticket_id, user_id, body, created_at)
```

---

## Containerization Notes (for future Docker setup)

Everything needed to containerize this app:

**Single container (app only, external MySQL):**
- Base image: `node:20-alpine`
- Build stage: `node:20-alpine` → runs `npm run build` in `kanban-ui/`
- Run stage: copies `kanban-api/` + built `public/` folder
- Exposes port `3002`
- All config via environment variables (already supported)
- No file system state — fully stateless, safe to containerize as-is

**docker-compose (app + MySQL together):**
- Service 1: `node:20-alpine` running `server.js`
- Service 2: `mysql:8.4` with a bind-mounted init SQL or volume
- MySQL init script = the CREATE TABLE statements in `setup_db.py` + `migrate_add_comments.py`
- Connect them via a Docker network; set `DB_HOST=mysql` (service name)

**Key things to preserve for containerization:**
- JWT_SECRET must be set as a real secret (not the default)
- MySQL data volume must be persisted (`/var/lib/mysql`) or use an external managed DB
- The `public/` folder is the built frontend — it must be built before or during the Docker build

---

## Current Live Instance

- URL: `http://192.168.1.150:3002`
- Server OS: Ubuntu 25.10
- Node: v20.19.4
- MySQL: 8.4.8
- Service: systemd user service (`~/.config/systemd/user/kanban-api.service`)
- Auto-start: enabled via `loginctl enable-linger`
