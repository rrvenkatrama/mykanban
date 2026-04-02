# MyKanban — Claude Context

This is a Jira-like kanban board for small teams. Read this file to get up to speed instantly.

## Stack
- **Backend:** Node.js 20 / Express 4 — `kanban-api/server.js`
- **Frontend:** React 18 / Vite — `kanban-ui/src/`
- **Database:** MySQL 8.4, database `kanban`, user `ailab`, password `ailab`
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **DnD:** @dnd-kit/core
- **AI:** @anthropic-ai/sdk (claude-haiku-4-5 for news summarization and chat)

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
- Sprints: create/edit/delete per project, filter board by sprint
- Comments on tickets
- Navigation: Login → Projects list → click project → Kanban board → Back
- Ticket cards show `#ID` prefix in title
- View button on ticket cards: read-only popup with details + comments
- View button on project cards: read-only popup with description, badges, dates
- User management: create, edit, delete users (UsersModal, accessible from Projects header)
- AI News feed: RSS from 6 sources, Agentic/All tabs, per-user read+bookmark state
- AI Summary per article: on-demand via claude-haiku-4-5, cached in DB
- Interactive Q&A chat per article: "💬 Ask Questions" opens free-form chatbox (claude-haiku-4-5)
- Bookmarks page: news bookmarks + ticket bookmarks in two sections
- Ticket bookmarks: star button on ticket cards, persisted per user

## Database Schema
```sql
users            (id, name, email, password_hash, created_at)
projects         (id, name, description, priority, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, created_by, created_at)
tickets          (id, title, description, status, priority, assignee_id, due_date, project_id, sprint_id, created_by, created_at, updated_at)
comments         (id, ticket_id, user_id, body, created_at)
sprints          (id, project_id, name, status, start_date, end_date, created_at)
ai_news          (id, title, url, source, summary, ai_summary, published_at, fetched_at, is_agentic)
news_user_state  (user_id, news_id, is_read, is_bookmarked, updated_at) -- composite PK
ticket_bookmarks (user_id, ticket_id, created_at) -- composite PK
```

## Key Files
| File | Purpose |
|------|---------|
| `kanban-api/server.js` | All API routes |
| `kanban-api/fetch-news.js` | Standalone RSS fetcher (cron + manual) |
| `kanban-api/migrate_news.js` | Creates ai_news table |
| `kanban-api/migrate_bookmarks.js` | Creates news_user_state + ticket_bookmarks tables |
| `kanban-ui/src/App.jsx` | Auth + navigation state (page: projects/news/bookmarks) |
| `kanban-ui/src/components/ProjectsPage.jsx` | Project grid (home) + inline project view modal |
| `kanban-ui/src/components/ProjectModal.jsx` | Create/edit project |
| `kanban-ui/src/components/KanbanBoard.jsx` | Board + drag + filters |
| `kanban-ui/src/components/TicketCard.jsx` | Ticket card with #ID, View/Edit/Bookmark/Delete |
| `kanban-ui/src/components/TicketModal.jsx` | Ticket form + comments; `readOnly` prop for view mode |
| `kanban-ui/src/components/SprintModal.jsx` | Sprint management |
| `kanban-ui/src/components/UsersModal.jsx` | User management (create/edit/delete) |
| `kanban-ui/src/components/NewsPage.jsx` | AI news feed with tabs, AI summary, Q&A chat, read/bookmark |
| `kanban-ui/src/components/BookmarksPage.jsx` | Bookmarks: news + tickets |
| `setup_db.py` | Fresh DB install (core tables) |
| `migrate_add_comments.py` | Upgrade: adds comments table |
| `migrate_add_projects.py` | Upgrade: adds projects table + project_id on tickets |
| `container_plan.txt` | Docker plan (not yet implemented) |

## Deploy Workflow
```bash
cd kanban-ui && npm run build
rsync -avz --exclude node_modules kanban-api/ rajramani@192.168.1.150:/home/rajramani/kanban-api/
ssh rajramani@192.168.1.150 "systemctl --user restart kanban-api"
```

## News Cron (runs daily at 7am on server)
```
0 7 * * * /usr/bin/node /home/rajramani/kanban-api/fetch-news.js >> /home/rajramani/kanban-api/news-fetch.log 2>&1
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
- `ANTHROPIC_API_KEY` set in service file (required for AI news features)
- After enabling, verify: `ls ~/.config/systemd/user/default.target.wants/`
- See `NodeServiceRestartIssueFix.txt` for full diagnosis

## What's Next
- Docker containerization (see `container_plan.txt`)
