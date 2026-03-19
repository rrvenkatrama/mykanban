# MyKanban — Project Context

Quick reference for picking up where we left off.

## What This Is
A lightweight Jira-like kanban board for small teams (1–10 people).
Built and deployed in a single session, with projects feature added in a follow-up session.

## Stack
| Layer    | Tech                          |
|----------|-------------------------------|
| Runtime  | Node.js 20                    |
| API      | Express 4                     |
| Frontend | React 18 + Vite               |
| Database | MySQL 8.4                     |
| Auth     | JWT (jsonwebtoken + bcryptjs) |
| DnD      | @dnd-kit/core                 |
| OS       | Ubuntu 25.10                  |

## Live Server
- URL: http://192.168.1.150:3002
- SSH: `ssh rajramani@192.168.1.150`
- DB: MySQL on 127.0.0.1:3306, database `kanban`, user `ailab`, password `ailab`
- Service: `systemctl --user restart kanban-api`

## Features Built
- JWT auth (register/login)
- **Projects**: name, description, priority, status, planned/actual start+end dates
- **Tickets**: title, description, status, priority, assignee, due date, linked to a project
- 4-column kanban board per project: Backlog → Todo → In Progress → Done
- Drag-and-drop between columns (including empty columns)
- Filter bar: search, priority, assignee
- Comments on tickets (add/delete own)
- Navigation: Login → Projects list → click project → Kanban board → Back

## Database Schema
```sql
users       (id, name, email, password_hash, created_at)
projects    (id, name, description, priority, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, created_by, created_at)
tickets     (id, title, description, status, priority, assignee_id, due_date, project_id, created_by, created_at, updated_at)
comments    (id, ticket_id, user_id, body, created_at)
```

## Key Files
| File | Purpose |
|------|---------|
| `kanban-api/server.js` | All API routes (auth, projects, tickets, comments) |
| `kanban-ui/src/App.jsx` | Auth + project/board navigation state |
| `kanban-ui/src/components/ProjectsPage.jsx` | Project grid (home screen) |
| `kanban-ui/src/components/ProjectModal.jsx` | Create/edit project form |
| `kanban-ui/src/components/KanbanBoard.jsx` | Board + drag + filters |
| `kanban-ui/src/components/TicketModal.jsx` | Ticket form + comments |
| `kanban-ui/src/api.js` | Axios instance with JWT interceptor |
| `setup_db.py` | Fresh install: creates all 4 tables |
| `migrate_add_comments.py` | Upgrade: adds comments table |
| `migrate_add_projects.py` | Upgrade: adds projects table + project_id on tickets |
| `container_plan.txt` | Docker/docker-compose plan (not yet implemented) |

## API Routes
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/users

GET    /api/projects
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id

GET    /api/tickets?project_id=X
POST   /api/tickets
PUT    /api/tickets/:id
DELETE /api/tickets/:id

GET    /api/tickets/:id/comments
POST   /api/tickets/:id/comments
DELETE /api/comments/:id
```

## Deploy Workflow
```bash
# 1. Build frontend
cd kanban-ui && npm run build

# 2. Sync to server
rsync -avz --exclude node_modules kanban-api/ rajramani@192.168.1.150:/home/rajramani/kanban-api/

# 3. Restart service
ssh rajramani@192.168.1.150 "systemctl --user restart kanban-api"
```

## Adding Users (no admin UI)
```bash
curl -X POST http://192.168.1.150:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Name","email":"email@example.com","password":"password"}'
```

## What's Next (planned)
- Docker containerization (see `container_plan.txt`)
