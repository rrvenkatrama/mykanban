# MyKanban — Claude Context

This is a Jira-like kanban board for small teams. Read this file to get up to speed instantly.

## Stack
- **Backend:** Node.js 20 / Express 4 — `kanban-api/server.js`
- **Frontend:** React 18 / Vite — `kanban-ui/src/`
- **Database:** MySQL 8.4, database `kanban`, user `ailab`, password `ailab`
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **DnD:** @dnd-kit/core

## Live Server
- URL: http://192.168.1.150:3002
- SSH: `ssh rajramani@192.168.1.150`
- Service: `systemctl --user restart kanban-api`
- UI is built into `kanban-api/public/` and served as static files by Express

## Features
- JWT auth (register/login)
- Projects: name, description, priority, status, planned/actual start+end dates
- Tickets: title, description, status, priority, assignee, due date, linked to a project
- 4-column kanban per project: Backlog → Todo → In Progress → Done
- Drag-and-drop (including empty columns)
- Filter bar: search, priority, assignee
- Comments on tickets
- Navigation: Login → Projects list → click project → Kanban board → Back

## Database Schema
```sql
users     (id, name, email, password_hash, created_at)
projects  (id, name, description, priority, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, created_by, created_at)
tickets   (id, title, description, status, priority, assignee_id, due_date, project_id, created_by, created_at, updated_at)
comments  (id, ticket_id, user_id, body, created_at)
```

## Key Files
| File | Purpose |
|------|---------|
| `kanban-api/server.js` | All API routes |
| `kanban-ui/src/App.jsx` | Auth + navigation state |
| `kanban-ui/src/components/ProjectsPage.jsx` | Project grid (home) |
| `kanban-ui/src/components/ProjectModal.jsx` | Create/edit project |
| `kanban-ui/src/components/KanbanBoard.jsx` | Board + drag + filters |
| `kanban-ui/src/components/TicketModal.jsx` | Ticket form + comments |
| `setup_db.py` | Fresh DB install (all 4 tables) |
| `migrate_add_comments.py` | Upgrade: adds comments table |
| `migrate_add_projects.py` | Upgrade: adds projects table + project_id on tickets |
| `container_plan.txt` | Docker plan (not yet implemented) |

## Deploy Workflow
```bash
cd kanban-ui && npm run build
rsync -avz --exclude node_modules kanban-api/ rajramani@192.168.1.150:/home/rajramani/kanban-api/
ssh rajramani@192.168.1.150 "systemctl --user restart kanban-api"
```

## Adding Users
```bash
curl -X POST http://192.168.1.150:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Name","email":"email@example.com","password":"password"}'
```

## systemd Service Notes (learned the hard way)
Both services now auto-start reliably after reboot. Key rules applied:
- `WantedBy=default.target` — user services must be in `default.target.wants/`, NOT `multi-user.target.wants/`
- `ExecStartPre=-/usr/bin/fuser -k PORT/tcp` — kills stale port holder before Node starts
- `ExecStartPre=/bin/sleep 5` — boot settle time
- `StartLimitIntervalSec=0` — prevents permanent blocking after repeated failures
- No system service references in `After=` (e.g. no `mysql.service`)
- After enabling, verify: `ls ~/.config/systemd/user/default.target.wants/`
- See `NodeServiceRestartIssueFix.txt` for full diagnosis

## What's Next
- Docker containerization (see `container_plan.txt`)
