#!/usr/bin/env python3
"""
setup_sprints.py — Creates sprints for AI Engineering Readiness (Project 3)
and assigns all tickets to their correct sprint.
"""

import sys
import requests

BASE = "http://192.168.1.150:3002/api"
PROJECT_ID = 3

# ── Auth ──────────────────────────────────────────────────────────────────────
r = requests.post(f"{BASE}/auth/login", json={"email": "rajramani@msn.com", "password": "yanni123"})
token = r.json()["token"]
H = {"Authorization": f"Bearer {token}"}

# ── Sprint definitions ────────────────────────────────────────────────────────
# Each sprint: (name, start, end, status, [ticket_ids])
SPRINTS = [
    {
        "name":       "Sprint 1 — P1 ToolBot",
        "start_date": "2026-03-30",
        "end_date":   "2026-04-12",
        "status":     "active",
        "tickets":    [17, 18, 19, 20],
    },
    {
        "name":       "Sprint 2 — P2 DocTalk",
        "start_date": "2026-04-13",
        "end_date":   "2026-04-26",
        "status":     "planned",
        "tickets":    [21, 22, 23, 24],
    },
    {
        "name":       "Sprint 3 — P3 ResearchBot",
        "start_date": "2026-04-27",
        "end_date":   "2026-05-10",
        "status":     "planned",
        "tickets":    [25, 26, 27, 28],
    },
    {
        "name":       "Sprint 4 — P4 StockSage",
        "start_date": "2026-05-11",
        "end_date":   "2026-06-07",
        "status":     "planned",
        "tickets":    [29, 30, 31, 32, 33],
    },
    {
        "name":       "Sprint 5 — P5 ReviewCrew",
        "start_date": "2026-06-08",
        "end_date":   "2026-06-21",
        "status":     "planned",
        "tickets":    [34, 35, 36],
    },
    {
        "name":       "Sprint 6 — P6 MCP++",
        "start_date": "2026-06-22",
        "end_date":   "2026-07-05",
        "status":     "planned",
        "tickets":    [37, 38, 39],
    },
    {
        "name":       "Sprint 7 — P7 ObservableAgent",
        "start_date": "2026-07-06",
        "end_date":   "2026-07-19",
        "status":     "planned",
        "tickets":    [40, 41, 42],
    },
    {
        "name":       "Sprint 8 — P8 AgentPlatform",
        "start_date": "2026-07-20",
        "end_date":   "2026-08-02",
        "status":     "planned",
        "tickets":    [43, 44, 45],
    },
]

# ── Delete existing sprints for project 3 (clean slate) ─────────────────────
existing = requests.get(f"{BASE}/sprints?project_id={PROJECT_ID}", headers=H).json()
for s in existing:
    requests.delete(f"{BASE}/sprints/{s['id']}", headers=H)
    print(f"  Deleted old sprint: {s['name']}")

# ── Create sprints and assign tickets ────────────────────────────────────────
for sprint in SPRINTS:
    payload = {
        "name":       sprint["name"],
        "project_id": PROJECT_ID,
        "status":     sprint["status"],
        "start_date": sprint["start_date"],
        "end_date":   sprint["end_date"],
    }
    res = requests.post(f"{BASE}/sprints", json=payload, headers=H)
    if res.status_code != 201:
        print(f"  ERROR creating sprint '{sprint['name']}': {res.text}")
        sys.exit(1)

    sprint_id = res.json()["id"]
    print(f"\n  Created: {sprint['name']} (id={sprint_id})")

    for tid in sprint["tickets"]:
        tr = requests.put(f"{BASE}/tickets/{tid}", json={"sprint_id": sprint_id}, headers=H)
        if tr.status_code == 200:
            t = tr.json()
            print(f"    → #{tid} {t['title'][:60]}")
        else:
            print(f"    ERROR on ticket #{tid}: {tr.text}")

# ── Close redundant weekly plan tickets #46 and #47 ──────────────────────────
print("\n  Closing redundant weekly plan tickets #46 and #47...")
for tid in [46, 47]:
    requests.put(f"{BASE}/tickets/{tid}", json={"status": "done", "sprint_id": None}, headers=H)
    print(f"    → #{tid} marked done (superseded by sprints)")

print("\nDone. All sprints created and tickets assigned.")
