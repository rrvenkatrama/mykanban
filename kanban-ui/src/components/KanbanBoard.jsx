import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import api          from '../api.js'
import TicketCard   from './TicketCard.jsx'
import TicketModal  from './TicketModal.jsx'
import SprintModal  from './SprintModal.jsx'

const COLUMNS = [
  { id: 'backlog',     label: 'Backlog' },
  { id: 'todo',        label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done',        label: 'Done' },
]

const COLUMN_COLORS = {
  backlog:     '#dfe1e6',
  todo:        '#deebff',
  in_progress: '#fff7d6',
  done:        '#e3fcef',
}

const SPRINT_STATUS_COLORS = {
  planned:   { bg: '#deebff', color: '#0747a6', border: '#0052cc' },
  active:    { bg: '#e3fcef', color: '#006644', border: '#36b37e' },
  completed: { bg: '#dfe1e6', color: '#42526e', border: '#6b778c' },
}

const S = {
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1.5rem', background: '#0052cc', color: '#fff',
  },
  headerTitle: { fontSize: '1.1rem', fontWeight: 700 },
  headerRight: { display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.875rem' },
  btn: (bg, color='#fff') => ({
    padding: '0.35rem 0.9rem', background: bg, color,
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  }),
  sprintBar: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 1rem', background: '#172b4d', flexWrap: 'wrap',
  },
  sprintBarLabel: { fontSize: '0.78rem', fontWeight: 700, color: '#8993a4', textTransform: 'uppercase', marginRight: '0.25rem' },
  sprintTab: (active, status) => {
    const c = status ? SPRINT_STATUS_COLORS[status] || SPRINT_STATUS_COLORS.planned : null
    return {
      padding: '0.25rem 0.75rem', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
      cursor: 'pointer', border: 'none',
      background: active ? (c ? c.bg : '#fff')       : 'rgba(255,255,255,0.1)',
      color:      active ? (c ? c.color : '#172b4d') : '#c1c7d0',
      outline:    active && c ? `2px solid ${c.border}` : 'none',
      outlineOffset: '-2px',
    }
  },
  filterBar: {
    display: 'flex', gap: '0.75rem', alignItems: 'center',
    padding: '0.6rem 1rem', background: '#f4f5f7', borderBottom: '1px solid #dfe1e6',
    flexWrap: 'wrap',
  },
  filterInput: {
    padding: '0.35rem 0.65rem', borderRadius: 4,
    border: '1px solid #dfe1e6', fontSize: '0.85rem', minWidth: 180,
  },
  filterSelect: {
    padding: '0.35rem 0.65rem', borderRadius: 4,
    border: '1px solid #dfe1e6', fontSize: '0.85rem', background: '#fff',
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    padding: '1rem',
    minHeight: 'calc(100vh - 120px)',
    alignItems: 'start',
  },
  col: (status) => ({
    background: COLUMN_COLORS[status],
    borderRadius: 8,
    padding: '0.75rem',
    minHeight: 200,
  }),
  colHeader: {
    fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
    letterSpacing: '0.05em', color: '#172b4d', marginBottom: '0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  badge: {
    background: 'rgba(0,0,0,0.12)', color: '#172b4d',
    borderRadius: 10, padding: '0.05rem 0.45rem', fontSize: '0.75rem', fontWeight: 700,
  },
}

function DroppableColumn({ col, children }) {
  const { setNodeRef } = useDroppable({ id: col.id })
  return (
    <div ref={setNodeRef} id={col.id} style={S.col(col.id)}>
      {children}
    </div>
  )
}

export default function KanbanBoard({ user, project, onBack, onLogout, onShowBookmarks }) {
  const [tickets,         setTickets]         = useState([])
  const [users,           setUsers]           = useState([])
  const [sprints,         setSprints]         = useState([])
  const [bookmarkedIds,   setBookmarkedIds]   = useState(new Set())
  const [selectedSprint,  setSelectedSprint]  = useState('all')
  const [modal,           setModal]           = useState(null)
  const [viewTicket,      setViewTicket]      = useState(null)
  const [sprintModal,     setSprintModal]     = useState(false)
  const [activeTicket,    setActiveTicket]    = useState(null)
  const [search,          setSearch]          = useState('')
  const [filterPriority,  setFilterPriority]  = useState('')
  const [filterAssignee,  setFilterAssignee]  = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = () => {
    const url = project ? `/tickets?project_id=${project.id}` : '/tickets'
    api.get(url).then(r => setTickets(r.data)).catch(console.error)
  }

  const loadSprints = () => {
    if (!project) return
    api.get(`/sprints?project_id=${project.id}`)
      .then(r => setSprints(r.data))
      .catch(() => {})
  }

  useEffect(() => { load(); loadSprints() }, [project?.id])
  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {})
    api.get('/bookmarks').then(r => {
      setBookmarkedIds(new Set(r.data.tickets.map(t => t.id)))
    }).catch(() => {})
  }, [])

  const handleToggleBookmark = async (ticketId) => {
    const isBookmarked = bookmarkedIds.has(ticketId)
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      isBookmarked ? next.delete(ticketId) : next.add(ticketId)
      return next
    })
    try {
      if (isBookmarked) await api.delete(`/tickets/${ticketId}/bookmark`)
      else              await api.post(`/tickets/${ticketId}/bookmark`)
    } catch {
      // revert on failure
      setBookmarkedIds(prev => {
        const next = new Set(prev)
        isBookmarked ? next.add(ticketId) : next.delete(ticketId)
        return next
      })
    }
  }

  const byStatus = (status) => tickets
    .filter(t => t.status === status)
    .filter(t => {
      if (selectedSprint === 'all')        return true
      if (selectedSprint === 'unassigned') return !t.sprint_id
      return t.sprint_id === selectedSprint
    })
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
                 (t.description || '').toLowerCase().includes(search.toLowerCase()))
    .filter(t => !filterPriority || t.priority === filterPriority)
    .filter(t => !filterAssignee || String(t.assignee_id) === filterAssignee)

  const handleDragStart = ({ active }) => {
    setActiveTicket(tickets.find(t => t.id === active.id) || null)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveTicket(null)
    if (!over) return
    const targetTicket = tickets.find(t => t.id === over.id)
    const newStatus    = targetTicket ? targetTicket.status : over.id

    const dragged = tickets.find(t => t.id === active.id)
    if (!dragged || dragged.status === newStatus) return

    setTickets(prev => prev.map(t => t.id === dragged.id ? { ...t, status: newStatus } : t))
    try {
      await api.put(`/tickets/${dragged.id}`, {
        status:     newStatus,
        sprint_id:  dragged.sprint_id  ?? null,
        assignee_id: dragged.assignee_id ?? null,
        due_date:   dragged.due_date    ?? null,
      })
    } catch {
      load()
    }
  }

  const handleSaved = (savedTicket, isEdit) => {
    setTickets(prev =>
      isEdit
        ? prev.map(t => t.id === savedTicket.id ? savedTicket : t)
        : [savedTicket, ...prev]
    )
    setModal(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ticket?')) return
    setTickets(prev => prev.filter(t => t.id !== id))
    await api.delete(`/tickets/${id}`)
  }

  const handleSprintChanged = (action, sprint) => {
    if (action === 'create') {
      setSprints(prev => [...prev, sprint])
    } else if (action === 'update') {
      setSprints(prev => prev.map(s => s.id === sprint.id ? sprint : s))
    } else if (action === 'delete') {
      setSprints(prev => prev.filter(s => s.id !== sprint.id))
      if (selectedSprint === sprint.id) setSelectedSprint('all')
      // reload tickets so sprint_id is cleared on affected tickets
      load()
    }
  }

  const activeSprint = sprints.find(s => s.id === selectedSprint)

  return (
    <div>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBack && (
            <button style={S.btn('#1565c0')} onClick={onBack}>← Projects</button>
          )}
          <span style={S.headerTitle}>{project ? project.name : 'Kanban Board'}</span>
        </div>
        <div style={S.headerRight}>
          <span>Hi, {user.name}</span>
          {project && (
            <button style={S.btn('#6554c0')} onClick={() => setSprintModal(true)}>
              Sprints
            </button>
          )}
          <button style={S.btn('#1a73e8')} onClick={() => setModal('new')}>+ New Ticket</button>
          <button style={S.btn('#ff991f')} onClick={onShowBookmarks}>★ Bookmarks</button>
          <button style={S.btn('#de350b')} onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* Sprint selector bar */}
      {project && (
        <div style={S.sprintBar}>
          <span style={S.sprintBarLabel}>Sprint:</span>
          <button
            style={S.sprintTab(selectedSprint === 'all', null)}
            onClick={() => setSelectedSprint('all')}
          >
            All
          </button>
          <button
            style={S.sprintTab(selectedSprint === 'unassigned', null)}
            onClick={() => setSelectedSprint('unassigned')}
          >
            Unassigned
          </button>
          {sprints.map(s => (
            <button
              key={s.id}
              style={S.sprintTab(selectedSprint === s.id, s.status)}
              onClick={() => setSelectedSprint(s.id)}
            >
              {s.name}
              <span style={{ marginLeft: '0.35rem', opacity: 0.7, fontWeight: 400 }}>
                ({s.ticket_count})
              </span>
            </button>
          ))}
        </div>
      )}

      <div style={S.filterBar}>
        <input
          style={S.filterInput}
          placeholder="Search tickets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.filterSelect} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select style={S.filterSelect} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="">All Assignees</option>
          {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
        </select>
        {(search || filterPriority || filterAssignee) && (
          <button
            style={S.btn('#6b778c', '#fff')}
            onClick={() => { setSearch(''); setFilterPriority(''); setFilterAssignee('') }}
          >
            Clear
          </button>
        )}
        {activeSprint && (
          <span style={{
            marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600,
            color: SPRINT_STATUS_COLORS[activeSprint.status]?.color || '#172b4d',
          }}>
            {activeSprint.name}
            {activeSprint.start_date && ` · ${activeSprint.start_date.slice(0,10)}`}
            {activeSprint.end_date   && ` → ${activeSprint.end_date.slice(0,10)}`}
          </span>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
                  onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={S.board}>
          {COLUMNS.map(col => {
            const colTickets = byStatus(col.id)
            return (
              <DroppableColumn key={col.id} col={col}>
                <div style={S.colHeader}>
                  <span>{col.label}</span>
                  <span style={S.badge}>{colTickets.length}</span>
                </div>
                <SortableContext
                  items={colTickets.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {colTickets.map(t => (
                    <TicketCard key={t.id} ticket={t}
                                isBookmarked={bookmarkedIds.has(t.id)}
                                onView={() => setViewTicket(t)}
                                onEdit={() => setModal(t)}
                                onDelete={handleDelete}
                                onToggleBookmark={handleToggleBookmark} />
                  ))}
                </SortableContext>
              </DroppableColumn>
            )
          })}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} isBookmarked={false} onView={() => {}} onEdit={() => {}} onDelete={() => {}} onToggleBookmark={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {viewTicket && (
        <TicketModal
          ticket={viewTicket}
          user={user}
          projectId={project?.id}
          sprints={sprints}
          readOnly
          onClose={() => setViewTicket(null)}
          onSaved={() => {}}
        />
      )}

      {modal && (
        <TicketModal
          ticket={modal === 'new' ? null : modal}
          user={user}
          projectId={project?.id}
          sprints={sprints}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {sprintModal && (
        <SprintModal
          projectId={project.id}
          sprints={sprints}
          onClose={() => setSprintModal(false)}
          onChanged={handleSprintChanged}
        />
      )}
    </div>
  )
}
