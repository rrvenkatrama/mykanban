import { useState, useEffect } from 'react'
import api from '../api.js'
import ProjectModal from './ProjectModal.jsx'
import UsersModal from './UsersModal.jsx'

const PRIORITY_COLOR = { low: '#36b37e', medium: '#ff991f', high: '#de350b' }
const STATUS_COLOR   = { planning: '#6554c0', active: '#0052cc', on_hold: '#ff991f', completed: '#36b37e' }
const STATUS_LABEL   = { planning: 'Planning', active: 'Active', on_hold: 'On Hold', completed: 'Completed' }

const S = {
  page:   { minHeight: '100vh', background: '#f4f5f7' },
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
  content: { padding: '1.5rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: '#fff', borderRadius: 8, padding: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)', cursor: 'pointer',
    border: '2px solid transparent', transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  cardHover: { borderColor: '#0052cc', boxShadow: '0 2px 8px rgba(0,82,204,0.2)' },
  cardTitle: { fontWeight: 700, fontSize: '1rem', color: '#172b4d', marginBottom: '0.4rem' },
  cardDesc: { fontSize: '0.85rem', color: '#6b778c', marginBottom: '0.75rem', minHeight: 20 },
  badgeRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  badge: (color) => ({
    display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: 10,
    background: color + '20', color, fontSize: '0.75rem', fontWeight: 700,
    border: `1px solid ${color}40`,
  }),
  dateRow: { fontSize: '0.78rem', color: '#6b778c', lineHeight: 1.7 },
  cardFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.75rem',
    paddingTop: '0.75rem', borderTop: '1px solid #f0f0f0',
  },
  btnSmall: (bg, color = '#fff') => ({
    padding: '0.25rem 0.65rem', background: bg, color,
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
  }),
  empty: { color: '#6b778c', textAlign: 'center', padding: '3rem', fontSize: '0.95rem' },
}

const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—'

export default function ProjectsPage({ user, onLogout, onSelectProject, onShowNews, onShowBookmarks }) {
  const [projects,     setProjects]     = useState([])
  const [modal,        setModal]        = useState(null)   // null | 'new' | project-object
  const [viewProject,  setViewProject]  = useState(null)
  const [hovered,      setHovered]      = useState(null)
  const [showUsers,    setShowUsers]    = useState(false)

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(console.error)
  }, [])

  const handleSaved = (saved, isEdit) => {
    setProjects(prev =>
      isEdit ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]
    )
    setModal(null)
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Delete this project and unlink its tickets?')) return
    await api.delete(`/projects/${id}`)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <span style={S.headerTitle}>Projects</span>
        <div style={S.headerRight}>
          <span>Hi, {user.name}</span>
          <button style={S.btn('#1a73e8')} onClick={() => setModal('new')}>+ New Project</button>
          <button style={S.btn('#00875a')} onClick={onShowNews}>AI News</button>
          <button style={S.btn('#ff991f')} onClick={onShowBookmarks}>★ Bookmarks</button>
          <button style={S.btn('#6554c0')} onClick={() => setShowUsers(true)}>Manage Users</button>
          <button style={S.btn('#de350b')} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div style={S.content}>
        {projects.length === 0 ? (
          <div style={S.empty}>No projects yet. Create your first project to get started.</div>
        ) : (
          <div style={S.grid}>
            {projects.map(p => (
              <div
                key={p.id}
                style={{ ...S.card, ...(hovered === p.id ? S.cardHover : {}) }}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectProject(p)}
              >
                <div style={S.cardTitle}>{p.name}</div>
                <div style={S.cardDesc}>{p.description || <em>No description</em>}</div>

                <div style={S.badgeRow}>
                  <span style={S.badge(STATUS_COLOR[p.status])}>{STATUS_LABEL[p.status]}</span>
                  <span style={S.badge(PRIORITY_COLOR[p.priority])}>
                    {p.priority.charAt(0).toUpperCase() + p.priority.slice(1)} Priority
                  </span>
                </div>

                <div style={S.dateRow}>
                  <div><strong>Planned:</strong> {fmt(p.planned_start_date)} → {fmt(p.planned_end_date)}</div>
                  <div><strong>Actual: </strong> {fmt(p.actual_start_date)} → {fmt(p.actual_end_date)}</div>
                </div>

                <div style={S.cardFooter}>
                  <button
                    style={S.btnSmall('#6554c0')}
                    onClick={e => { e.stopPropagation(); setViewProject(p) }}
                  >
                    View
                  </button>
                  <button
                    style={S.btnSmall('#f4f5f7', '#172b4d')}
                    onClick={e => { e.stopPropagation(); setModal(p) }}
                  >
                    Edit
                  </button>
                  <button
                    style={S.btnSmall('#de350b')}
                    onClick={e => handleDelete(e, p.id)}
                  >
                    Delete
                  </button>
                  <button
                    style={S.btnSmall('#0052cc')}
                    onClick={() => onSelectProject(p)}
                  >
                    Open Board →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ProjectModal
          project={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {viewProject && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 8, padding: '1.5rem',
            width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', color: '#172b4d' }}>
              {viewProject.name}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={S.badge(STATUS_COLOR[viewProject.status])}>{STATUS_LABEL[viewProject.status]}</span>
              <span style={S.badge(PRIORITY_COLOR[viewProject.priority])}>
                {viewProject.priority.charAt(0).toUpperCase() + viewProject.priority.slice(1)} Priority
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#172b4d', marginBottom: '0.25rem' }}>Description</div>
            <div style={{
              padding: '0.45rem 0.65rem', borderRadius: 4, border: '1px solid #dfe1e6',
              fontSize: '0.9rem', minHeight: 60, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              color: viewProject.description ? '#172b4d' : '#6b778c', background: '#f4f5f7',
              marginBottom: '1rem',
            }}>
              {viewProject.description || 'No description.'}
            </div>
            <div style={S.dateRow}>
              <div><strong>Planned:</strong> {fmt(viewProject.planned_start_date)} → {fmt(viewProject.planned_end_date)}</div>
              <div><strong>Actual: </strong> {fmt(viewProject.actual_start_date)} → {fmt(viewProject.actual_end_date)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button style={S.btn('#f4f5f7', '#172b4d')} onClick={() => setViewProject(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showUsers && <UsersModal onClose={() => setShowUsers(false)} />}
    </div>
  )
}
