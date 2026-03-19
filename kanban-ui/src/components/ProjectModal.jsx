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
  label: { display: 'block', fontWeight: 600, fontSize: '0.8rem',
           marginBottom: '0.25rem', color: '#172b4d', marginTop: '0.75rem' },
  input: {
    width: '100%', padding: '0.45rem 0.65rem', borderRadius: 4,
    border: '2px solid #dfe1e6', fontSize: '0.9rem', outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '0.45rem 0.65rem', borderRadius: 4,
    border: '2px solid #dfe1e6', fontSize: '0.9rem', outline: 'none',
    minHeight: 80, resize: 'vertical', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '0.45rem 0.65rem', borderRadius: 4,
    border: '2px solid #dfe1e6', fontSize: '0.9rem', background: '#fff',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' },
  btnSave: {
    padding: '0.5rem 1.2rem', background: '#0052cc', color: '#fff',
    border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer',
  },
  btnCancel: {
    padding: '0.5rem 1.2rem', background: '#f4f5f7', color: '#172b4d',
    border: '1px solid #dfe1e6', borderRadius: 4, cursor: 'pointer',
  },
  error: { color: '#de350b', fontSize: '0.85rem', marginTop: '0.5rem' },
}

const toDateInput = (val) => (val ? val.slice(0, 10) : '')

const BLANK = {
  name: '', description: '', priority: 'medium', status: 'planning',
  planned_start_date: '', planned_end_date: '',
  actual_start_date: '', actual_end_date: '',
}

export default function ProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState(project ? {
    name: project.name,
    description: project.description || '',
    priority: project.priority,
    status: project.status,
    planned_start_date: toDateInput(project.planned_start_date),
    planned_end_date:   toDateInput(project.planned_end_date),
    actual_start_date:  toDateInput(project.actual_start_date),
    actual_end_date:    toDateInput(project.actual_end_date),
  } : BLANK)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        planned_start_date: form.planned_start_date || null,
        planned_end_date:   form.planned_end_date   || null,
        actual_start_date:  form.actual_start_date  || null,
        actual_end_date:    form.actual_end_date    || null,
      }
      let res
      if (project) {
        res = await api.put(`/projects/${project.id}`, payload)
      } else {
        res = await api.post('/projects', payload)
      }
      onSaved(res.data, !!project)
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.h2}>{project ? 'Edit Project' : 'New Project'}</h2>
        <form onSubmit={submit}>
          <label style={S.label}>Project Name *</label>
          <input style={S.input} value={form.name} onChange={set('name')} required />

          <label style={S.label}>Description</label>
          <textarea style={S.textarea} value={form.description} onChange={set('description')} />

          <div style={S.grid2}>
            <div>
              <label style={S.label}>Priority</label>
              <select style={S.select} value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Status</label>
              <select style={S.select} value={form.status} onChange={set('status')}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '0.8rem', color: '#6b778c' }}>
            Planned Dates
          </div>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Start Date</label>
              <input style={S.input} type="date" value={form.planned_start_date} onChange={set('planned_start_date')} />
            </div>
            <div>
              <label style={S.label}>End Date</label>
              <input style={S.input} type="date" value={form.planned_end_date} onChange={set('planned_end_date')} />
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '0.8rem', color: '#6b778c' }}>
            Actual Dates
          </div>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Start Date</label>
              <input style={S.input} type="date" value={form.actual_start_date} onChange={set('actual_start_date')} />
            </div>
            <div>
              <label style={S.label}>End Date</label>
              <input style={S.input} type="date" value={form.actual_end_date} onChange={set('actual_end_date')} />
            </div>
          </div>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.footer}>
            <button type="button" style={S.btnCancel} onClick={onClose}>Cancel</button>
            <button type="submit" style={S.btnSave} disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
