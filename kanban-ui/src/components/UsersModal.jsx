import { useState, useEffect } from 'react'
import api from '../api.js'

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 8, padding: '1.5rem', width: 520,
    maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1rem',
  },
  title: { fontWeight: 700, fontSize: '1.1rem', color: '#172b4d' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b778c',
  },
  list: { overflowY: 'auto', flex: 1, marginBottom: '1rem' },
  userRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0',
  },
  userInfo: { display: 'flex', flexDirection: 'column' },
  userName: { fontWeight: 600, fontSize: '0.9rem', color: '#172b4d' },
  userEmail: { fontSize: '0.78rem', color: '#6b778c' },
  actions: { display: 'flex', gap: '0.4rem' },
  btnSmall: (bg, color = '#fff') => ({
    padding: '0.25rem 0.65rem', background: bg, color,
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
  }),
  divider: { borderTop: '2px solid #f0f0f0', paddingTop: '1rem' },
  formTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#172b4d', marginBottom: '0.75rem' },
  row: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' },
  input: {
    flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #dfe1e6', borderRadius: 4,
    fontSize: '0.85rem',
  },
  btnPrimary: {
    padding: '0.4rem 1rem', background: '#0052cc', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  },
  btnCancel: {
    padding: '0.4rem 1rem', background: '#f4f5f7', color: '#172b4d',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
  },
  error: { color: '#de350b', fontSize: '0.8rem', marginTop: '0.25rem' },
}

const emptyForm = { name: '', email: '', password: '' }

export default function UsersModal({ onClose }) {
  const [users, setUsers]     = useState([])
  const [editing, setEditing] = useState(null)   // user object being edited, or null for new
  const [form, setForm]       = useState(emptyForm)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(console.error)
  }, [])

  const startEdit = (u) => {
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '' })
    setError('')
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (!editing && !form.password.trim()) {
      setError('Password is required for new users.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email }
        if (form.password.trim()) payload.password = form.password
        const { data } = await api.put(`/users/${editing.id}`, payload)
        setUsers(prev => prev.map(u => u.id === editing.id ? data : u))
      } else {
        const { data } = await api.post('/users', form)
        setUsers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      }
      cancelEdit()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? Their tickets will become unassigned and move to To Do.`)) return
    try {
      await api.delete(`/users/${u.id}`)
      setUsers(prev => prev.filter(x => x.id !== u.id))
      if (editing?.id === u.id) cancelEdit()
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.')
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <span style={S.title}>Manage Users</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.list}>
          {users.length === 0 && <div style={{ color: '#6b778c', fontSize: '0.85rem' }}>No users found.</div>}
          {users.map(u => (
            <div key={u.id} style={S.userRow}>
              <div style={S.userInfo}>
                <span style={S.userName}>{u.name}</span>
                <span style={S.userEmail}>{u.email}</span>
              </div>
              <div style={S.actions}>
                <button style={S.btnSmall('#f4f5f7', '#172b4d')} onClick={() => startEdit(u)}>Edit</button>
                <button style={S.btnSmall('#de350b')} onClick={() => handleDelete(u)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div style={S.divider}>
          <div style={S.formTitle}>{editing ? `Edit: ${editing.name}` : 'Add New User'}</div>
          <div style={S.row}>
            <input
              style={S.input}
              placeholder="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              style={S.input}
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div style={S.row}>
            <input
              style={S.input}
              placeholder={editing ? 'New password (leave blank to keep)' : 'Password'}
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          {error && <div style={S.error}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
            </button>
            {editing && <button style={S.btnCancel} onClick={cancelEdit}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
