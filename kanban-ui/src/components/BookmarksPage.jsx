import { useState, useEffect } from 'react'
import api from '../api.js'
import TicketModal from './TicketModal.jsx'

const PRIORITY_COLOR = { low: '#36b37e', medium: '#ff991f', high: '#de350b' }
const STATUS_LABEL   = { backlog: 'Backlog', todo: 'Todo', in_progress: 'In Progress', done: 'Done' }

const S = {
  page: { minHeight: '100vh', background: '#f4f5f7' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1.5rem', background: '#0052cc', color: '#fff',
  },
  headerTitle: { fontSize: '1.1rem', fontWeight: 700 },
  headerRight: { display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.875rem' },
  btn: (bg, color = '#fff') => ({
    padding: '0.35rem 0.9rem', background: bg, color,
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  }),
  content: { padding: '1.25rem 1.5rem' },
  section: { marginBottom: '2rem' },
  sectionTitle: {
    fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#6b778c', marginBottom: '0.75rem',
    paddingBottom: '0.4rem', borderBottom: '2px solid #dfe1e6',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: '0.55rem' },
  newsCard: {
    background: '#fff', borderRadius: 8, padding: '0.9rem 1.1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e8e8e8',
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
  },
  newsCardLeft: { flex: 1, minWidth: 0 },
  newsTitle: (isRead) => ({
    fontWeight: 600, fontSize: '0.9rem',
    color: isRead ? '#b91c1c' : '#0052cc',
    textDecoration: 'none', lineHeight: 1.4,
    display: 'block', marginBottom: '0.25rem',
  }),
  newsMeta: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: '#6b778c' },
  ticketCard: {
    background: '#fff', borderRadius: 8, padding: '0.9rem 1.1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e8e8e8',
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  ticketCardLeft: { flex: 1, minWidth: 0 },
  ticketTitle: { fontWeight: 600, fontSize: '0.9rem', color: '#172b4d', lineHeight: 1.4 },
  ticketMeta: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: '#6b778c', marginTop: '0.2rem' },
  badge: (color) => ({
    padding: '0.1rem 0.45rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700,
    background: color + '20', color, border: `1px solid ${color}40`,
  }),
  removeBtn: {
    flexShrink: 0, fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 4,
    border: '1px solid #de350b', color: '#de350b', background: 'transparent',
    cursor: 'pointer', fontWeight: 600,
  },
  viewBtn: {
    flexShrink: 0, fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 4,
    border: '1px solid #6554c0', color: '#6554c0', background: 'transparent',
    cursor: 'pointer', fontWeight: 600,
  },
  empty: { color: '#6b778c', fontSize: '0.875rem', padding: '0.75rem 0' },
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

export default function BookmarksPage({ user, onBack, onLogout }) {
  const [news,       setNews]       = useState([])
  const [tickets,    setTickets]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [viewTicket, setViewTicket] = useState(null)

  useEffect(() => {
    api.get('/bookmarks')
      .then(r => { setNews(r.data.news); setTickets(r.data.tickets) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const removeNewsBookmark = async (id) => {
    setNews(prev => prev.filter(a => a.id !== id))
    try { await api.put(`/news/${id}/state`, { is_bookmarked: 0 }) } catch {}
  }

  const removeTicketBookmark = async (id) => {
    setTickets(prev => prev.filter(t => t.id !== id))
    try { await api.delete(`/tickets/${id}/bookmark`) } catch {}
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button style={S.btn('#1565c0')} onClick={onBack}>← Projects</button>
          <span style={S.headerTitle}>Bookmarks</span>
        </div>
        <div style={S.headerRight}>
          <span>Hi, {user.name}</span>
          <button style={S.btn('#de350b')} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div style={S.content}>
        {loading ? <div style={S.empty}>Loading…</div> : (
          <>
            {/* ── News bookmarks ── */}
            <div style={S.section}>
              <div style={S.sectionTitle}>News Bookmarks ({news.length})</div>
              {news.length === 0 ? (
                <div style={S.empty}>No bookmarked articles yet. Bookmark articles from the AI News page.</div>
              ) : (
                <div style={S.grid}>
                  {news.map(a => (
                    <div key={a.id} style={S.newsCard}>
                      <div style={S.newsCardLeft}>
                        <a href={a.url} target="_blank" rel="noreferrer" style={S.newsTitle(a.is_read)}>
                          {a.title}
                        </a>
                        <div style={S.newsMeta}>
                          <span>{a.source}</span>
                          {a.is_agentic === 1 && <span style={{ color: '#006644', fontWeight: 700 }}>· Agentic</span>}
                          {a.published_at && <span>· {fmtDate(a.published_at)}</span>}
                          {a.is_read ? <span style={{ color: '#b91c1c' }}>· Read</span> : <span style={{ color: '#36b37e' }}>· Unread</span>}
                        </div>
                        {a.ai_summary && (
                          <div style={{ fontSize: '0.8rem', color: '#6b778c', marginTop: '0.3rem', lineHeight: 1.4 }}>
                            {a.ai_summary}
                          </div>
                        )}
                      </div>
                      <button style={S.removeBtn} onClick={() => removeNewsBookmark(a.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Ticket bookmarks ── */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Ticket Bookmarks ({tickets.length})</div>
              {tickets.length === 0 ? (
                <div style={S.empty}>No bookmarked tickets yet. Bookmark tickets from the Kanban board.</div>
              ) : (
                <div style={S.grid}>
                  {tickets.map(t => (
                    <div key={t.id} style={S.ticketCard}>
                      <div style={S.ticketCardLeft}>
                        <div style={S.ticketTitle}>
                          <span style={{ color: '#6b778c', fontWeight: 400 }}>#{t.id}</span> {t.title}
                        </div>
                        <div style={S.ticketMeta}>
                          <span style={S.badge(PRIORITY_COLOR[t.priority] || '#999')}>
                            {t.priority}
                          </span>
                          <span style={S.badge('#6b778c')}>{STATUS_LABEL[t.status] || t.status}</span>
                          {t.assignee_name && <span>@ {t.assignee_name}</span>}
                          {t.due_date && <span>Due {t.due_date.slice(0, 10)}</span>}
                        </div>
                      </div>
                      <button style={S.viewBtn} onClick={() => setViewTicket(t)}>View</button>
                      <button style={S.removeBtn} onClick={() => removeTicketBookmark(t.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {viewTicket && (
        <TicketModal
          ticket={viewTicket}
          user={user}
          readOnly
          onClose={() => setViewTicket(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
