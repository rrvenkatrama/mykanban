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
    minHeight: 'calc(100vh - 88px)',
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

export default function KanbanBoard({ user, project, onBack, onLogout }) {
  const [tickets,        setTickets]        = useState([])
  const [users,          setUsers]          = useState([])
  const [modal,          setModal]          = useState(null)   // null | 'new' | ticket-object
  const [activeTicket,   setActiveTicket]   = useState(null)
  const [search,         setSearch]         = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = () => {
    const url = project ? `/tickets?project_id=${project.id}` : '/tickets'
    api.get(url).then(r => setTickets(r.data)).catch(console.error)
  }
  useEffect(() => { load() }, [project?.id])
  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {})
  }, [])

  const byStatus = (status) => tickets
    .filter(t => t.status === status)
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
    // 'over' can be a ticket id OR a column id
    const targetTicket = tickets.find(t => t.id === over.id)
    const newStatus    = targetTicket ? targetTicket.status : over.id

    const dragged = tickets.find(t => t.id === active.id)
    if (!dragged || dragged.status === newStatus) return

    // Optimistic update
    setTickets(prev => prev.map(t => t.id === dragged.id ? { ...t, status: newStatus } : t))
    try {
      await api.put(`/tickets/${dragged.id}`, { status: newStatus })
    } catch {
      load() // revert on failure
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
          <button style={S.btn('#1a73e8')} onClick={() => setModal('new')}>+ New Ticket</button>
          <button style={S.btn('#de350b')} onClick={onLogout}>Logout</button>
        </div>
      </header>

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
                                onEdit={() => setModal(t)}
                                onDelete={handleDelete} />
                  ))}
                </SortableContext>
              </DroppableColumn>
            )
          })}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <TicketCard ticket={activeTicket} onEdit={() => {}} onDelete={() => {}} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {modal && (
        <TicketModal
          ticket={modal === 'new' ? null : modal}
          user={user}
          projectId={project?.id}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
