import { useState } from 'react'
import api from '../api.js'

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 8, padding: '1.5rem',
    width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  h2: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' },
  label: {
    display: 'block', fontWeight: 600, fontSize: '0.8rem',
    marginBottom: '0.25rem', color: '#172b4d', marginTop: '0.75rem',
  },
  input: {
    width: '100%', padding: '0.45rem 0.65rem', borderRadius: 4,
    border: '2px solid #dfe1e6', fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '0.45rem 0.65rem', borderRadius: 4,
    border: '2px solid #dfe1e6', fontSize: '0.9rem', background: '#fff',
    boxSizing: 'border-box',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' },
  btn: (bg, color = '#fff') => ({
    padding: '0.4rem 1rem', background: bg, color,
    border: bg === 'none' ? '1px solid #dfe1e6' : 'none',
    borderRadius: 4, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
  }),
  error: { color: '#de350b', fontSize: '0.85rem', marginTop: '0.5rem' },
  divider: { borderTop: '1px solid #dfe1e6', margin: '1.25rem 0 1rem' },
  sprintRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #dfe1e6',
    marginBottom: '0.5rem', background: '#f8f9fa',
  },
  sprintInfo: { flex: 1 },
  sprintName: { fontWeight: 600, fontSize: '0.9rem', color: '#172b4d' },
  sprintMeta: { fontSize: '0.75rem', color: '#6b778c', marginTop: '0.15rem' },
  sprintActions: { display: 'flex', gap: '0.4rem' },
  statusBadge: (status) => {
    const colors = {
      planned:   { bg: '#deebff', color: '#0747a6' },
      active:    { bg: '#e3fcef', color: '#006644' },
      completed: { bg: '#dfe1e6', color: '#42526e' },
    }
    const c = colors[status] || colors.planned
    return {
      padding: '0.1rem 0.5rem', borderRadius: 10, fontSize: '0.72rem',
      fontWeight: 700, background: c.bg, color: c.color,
    }
  },
}

const BLANK_FORM = { name: '', status: 'planned', start_date: '', end_date: '' }

const fmt = (d) => (d ? d.slice(0, 10) : '—')

export default function SprintModal({ projectId, sprints, onClose, onChanged }) {
  const [form,    setForm]    = useState(BLANK_FORM)
  const [editing, setEditing] = useState(null)   // sprint being edited
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const startEdit = (sprint) => {
    setEditing(sprint)
    setForm({
      name:       sprint.name,
      status:     sprint.status,
      start_date: sprint.start_date ? sprint.start_date.slice(0, 10) : '',
      end_date:   sprint.end_date   ? sprint.end_date.slice(0, 10)   : '',
    })
    setError('')
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(BLANK_FORM)
    setError('')
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Sprint name is required'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        name:       form.name.trim(),
        status:     form.status,
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
      }
      if (editing) {
        const res = await api.put(`/sprints/${editing.id}`, payload)
        onChanged('update', res.data)
      } else {
        const res = await api.post('/sprints', { ...payload, project_id: projectId })
        onChanged('create', res.data)
      }
      cancelEdit()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const deleteSprint = async (sprint) => {
    if (!window.confirm(`Delete sprint "${sprint.name}"? Tickets will be unassigned from this sprint.`)) return
    try {
      await api.delete(`/sprints/${sprint.id}`)
      onChanged('delete', sprint)
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.h2}>Manage Sprints</h2>

        {/* Existing sprints list */}
        {sprints.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: '#6b778c', marginBottom: '0.75rem' }}>
            No sprints yet. Create one below.
          </div>
        )}
        {sprints.map(sprint => (
          <div key={sprint.id} style={S.sprintRow}>
            <div style={S.sprintInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={S.sprintName}>{sprint.name}</span>
                <span style={S.statusBadge(sprint.status)}>{sprint.status}</span>
              </div>
              <div style={S.sprintMeta}>
                {fmt(sprint.start_date)} → {fmt(sprint.end_date)}
                {' · '}{sprint.ticket_count} ticket{sprint.ticket_count !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={S.sprintActions}>
              <button style={S.btn('#1a73e8')} onClick={() => startEdit(sprint)}>Edit</button>
              <button style={S.btn('#de350b')} onClick={() => deleteSprint(sprint)}>Delete</button>
            </div>
          </div>
        ))}

        <div style={S.divider} />

        {/* Create / Edit form */}
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#172b4d', marginBottom: '0.75rem' }}>
          {editing ? `Edit: ${editing.name}` : 'New Sprint'}
        </div>

        <form onSubmit={save}>
          <label style={S.label}>Sprint Name *</label>
          <input style={S.input} value={form.name} onChange={set('name')}
                 placeholder="e.g. Sprint 1 — Week of Apr 1" />

          <div style={S.grid2}>
            <div>
              <label style={S.label}>Start Date</label>
              <input style={S.input} type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div>
              <label style={S.label}>End Date</label>
              <input style={S.input} type="date" value={form.end_date} onChange={set('end_date')} />
            </div>
          </div>

          <label style={S.label}>Status</label>
          <select style={S.select} value={form.status} onChange={set('status')}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.footer}>
            {editing && (
              <button type="button" style={S.btn('none', '#172b4d')} onClick={cancelEdit}>
                Cancel Edit
              </button>
            )}
            <button type="button" style={S.btn('none', '#172b4d')} onClick={onClose}>Close</button>
            <button type="submit" style={S.btn('#0052cc')} disabled={loading}>
              {loading ? 'Saving…' : editing ? 'Update Sprint' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
