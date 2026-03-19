import { useState, useEffect } from 'react'
import api from '../api.js'

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 8, padding: '1.5rem',
    width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
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
  divider: { borderTop: '1px solid #dfe1e6', margin: '1.25rem 0 0.75rem' },
  commentList: { maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  comment: {
    background: '#f4f5f7', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem',
  },
  commentMeta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '0.75rem', color: '#6b778c', marginBottom: '0.25rem',
  },
  commentBody: { color: '#172b4d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  btnDelete: {
    background: 'none', border: 'none', color: '#de350b', cursor: 'pointer',
    fontSize: '0.75rem', padding: 0,
  },
  commentRow: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'flex-start' },
  btnAddComment: {
    padding: '0.4rem 0.9rem', background: '#0052cc', color: '#fff',
    border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer',
    fontSize: '0.82rem', whiteSpace: 'nowrap',
  },
}

const BLANK = { title: '', description: '', status: 'backlog', priority: 'medium', assignee_id: '', due_date: '' }

export default function TicketModal({ ticket, user, onClose, onSaved }) {
  const [form,           setForm]           = useState(ticket ? { ...ticket, assignee_id: ticket.assignee_id || '', due_date: ticket.due_date ? ticket.due_date.slice(0,10) : '' } : BLANK)
  const [users,          setUsers]          = useState([])
  const [error,          setError]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [comments,       setComments]       = useState([])
  const [newComment,     setNewComment]     = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!ticket) return
    api.get(`/tickets/${ticket.id}/comments`)
      .then(r => setComments(r.data))
      .catch(() => {})
  }, [ticket?.id])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        due_date:    form.due_date || null,
      }
      let res
      if (ticket) {
        res = await api.put(`/tickets/${ticket.id}`, payload)
      } else {
        res = await api.post('/tickets', payload)
      }
      onSaved(res.data, !!ticket)
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const addComment = async () => {
    const body = newComment.trim()
    if (!body) return
    setCommentLoading(true)
    try {
      const res = await api.post(`/tickets/${ticket.id}/comments`, { body })
      setComments(prev => [...prev, res.data])
      setNewComment('')
    } catch {
      // silently ignore — comment will just not appear
    } finally {
      setCommentLoading(false)
    }
  }

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/comments/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {}
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.h2}>{ticket ? 'Edit Ticket' : 'New Ticket'}</h2>
        <form onSubmit={submit}>
          <label style={S.label}>Title *</label>
          <input style={S.input} value={form.title} onChange={set('title')} required />

          <label style={S.label}>Description</label>
          <textarea style={S.textarea} value={form.description} onChange={set('description')} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={S.label}>Status</label>
              <select style={S.select} value={form.status} onChange={set('status')}>
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Priority</label>
              <select style={S.select} value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <label style={S.label}>Assignee</label>
          <select style={S.select} value={form.assignee_id} onChange={set('assignee_id')}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <label style={S.label}>Due Date</label>
          <input style={S.input} type="date" value={form.due_date} onChange={set('due_date')} />

          {error && <div style={S.error}>{error}</div>}

          <div style={S.footer}>
            <button type="button" style={S.btnCancel} onClick={onClose}>Cancel</button>
            <button type="submit"  style={S.btnSave}  disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>

        {ticket && (
          <>
            <div style={S.divider} />
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#172b4d', marginBottom: '0.6rem' }}>
              Comments ({comments.length})
            </div>
            <div style={S.commentList}>
              {comments.length === 0 && (
                <div style={{ fontSize: '0.82rem', color: '#6b778c' }}>No comments yet.</div>
              )}
              {comments.map(c => (
                <div key={c.id} style={S.comment}>
                  <div style={S.commentMeta}>
                    <span><strong>{c.author_name}</strong></span>
                    <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {formatDate(c.created_at)}
                      {user && c.user_id === user.id && (
                        <button style={S.btnDelete} onClick={() => deleteComment(c.id)}>Delete</button>
                      )}
                    </span>
                  </div>
                  <div style={S.commentBody}>{c.body}</div>
                </div>
              ))}
            </div>
            <div style={S.commentRow}>
              <textarea
                style={{ ...S.textarea, minHeight: 52, flex: 1 }}
                placeholder="Add a comment…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment() }}
              />
              <button style={S.btnAddComment} onClick={addComment} disabled={commentLoading || !newComment.trim()}>
                {commentLoading ? '…' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
