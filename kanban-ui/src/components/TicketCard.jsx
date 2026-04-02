import { useSortable } from '@dnd-kit/sortable'
import { CSS }         from '@dnd-kit/utilities'

const PRIORITY_COLORS = {
  low:    { bg: '#e3fcef', text: '#006644' },
  medium: { bg: '#fff7d6', text: '#974f0c' },
  high:   { bg: '#ffebe6', text: '#bf2600' },
}

const S = {
  card: (isDragging) => ({
    background: '#fff',
    borderRadius: 6,
    padding: '0.75rem',
    marginBottom: '0.5rem',
    boxShadow: isDragging
      ? '0 8px 24px rgba(0,0,0,0.18)'
      : '0 1px 4px rgba(0,0,0,0.08)',
    cursor: 'grab',
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid #dfe1e6',
    transition: 'box-shadow 0.15s',
  }),
  title: { fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: '#172b4d' },
  badge: (priority) => ({
    display: 'inline-block',
    padding: '0.1rem 0.45rem',
    borderRadius: 3,
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    background: PRIORITY_COLORS[priority]?.bg || '#eee',
    color:      PRIORITY_COLORS[priority]?.text || '#333',
    marginRight: '0.4rem',
  }),
  meta: { fontSize: '0.78rem', color: '#6b778c', marginTop: '0.4rem' },
  actions: { marginTop: '0.5rem', display: 'flex', gap: '0.4rem' },
  btn: (color) => ({
    fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 3,
    border: `1px solid ${color}`, color, background: 'transparent', cursor: 'pointer',
  }),
}

export default function TicketCard({ ticket, isBookmarked, onView, onEdit, onDelete, onToggleBookmark }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ticket.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={{ ...S.card(isDragging), ...style }}
         {...attributes} {...listeners}>
      <div style={S.title}><span style={{ color: '#6b778c', fontWeight: 400 }}>#{ticket.id}</span> {ticket.title}</div>
      <div>
        <span style={S.badge(ticket.priority)}>{ticket.priority}</span>
        {ticket.assignee_name && (
          <span style={{ fontSize: '0.78rem', color: '#6b778c' }}>@ {ticket.assignee_name}</span>
        )}
      </div>
      {ticket.due_date && (
        <div style={S.meta}>Due: {ticket.due_date.slice(0, 10)}</div>
      )}
      <div style={S.actions}>
        <button style={S.btn('#6554c0')}
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onView(ticket) }}>View</button>
        <button style={S.btn('#0052cc')}
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onEdit(ticket) }}>Edit</button>
        <button
                style={{
                  ...S.btn(isBookmarked ? '#ff991f' : 'transparent'),
                  color: isBookmarked ? '#fff' : '#ff991f',
                  border: '1px solid #ff991f',
                }}
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleBookmark(ticket.id) }}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this ticket'}
        >{isBookmarked ? '★' : '☆'}</button>
        <button style={S.btn('#de350b')}
                onPointerDown={e => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(ticket.id) }}>Delete</button>
      </div>
    </div>
  )
}
