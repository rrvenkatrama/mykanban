import { useState } from 'react'
import api from '../api.js'

const S = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f0f2f5',
  },
  card: {
    background: '#fff', borderRadius: 8, padding: '2rem',
    width: 360, boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
  },
  h1: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', textAlign: 'center' },
  sub: { textAlign: 'center', color: '#6b778c', marginBottom: '1.5rem', fontSize: '0.875rem' },
  label: { display: 'block', fontWeight: 600, fontSize: '0.8rem',
           marginBottom: '0.25rem', color: '#172b4d' },
  input: {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 4, fontSize: '0.95rem',
    border: '2px solid #dfe1e6', outline: 'none', marginBottom: '1rem',
  },
  btn: {
    width: '100%', padding: '0.6rem', background: '#0052cc', color: '#fff',
    border: 'none', borderRadius: 4, fontSize: '1rem', fontWeight: 600,
    cursor: 'pointer', marginTop: '0.5rem',
  },
  toggle: { textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: '#6b778c' },
  toggleLink: { color: '#0052cc', cursor: 'pointer', fontWeight: 600 },
  error: { color: '#de350b', fontSize: '0.85rem', marginBottom: '0.5rem' },
}

export default function LoginPage({ onLogin }) {
  const [mode,     setMode]     = useState('login')  // 'login' | 'register'
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const payload  = mode === 'login' ? { email, password } : { name, email, password }
      const { data } = await api.post(endpoint, payload)
      onLogin(data.token, data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.h1}>Kanban Board</h1>
        <p style={S.sub}>{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
        {error && <div style={S.error}>{error}</div>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div>
              <label style={S.label}>Name</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)}
                     placeholder="Your name" required />
            </div>
          )}
          <div>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={email}
                   onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={password}
                   onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div style={S.toggle}>
          {mode === 'login' ? (
            <>No account? <span style={S.toggleLink} onClick={() => setMode('register')}>Register</span></>
          ) : (
            <>Have an account? <span style={S.toggleLink} onClick={() => setMode('login')}>Sign in</span></>
          )}
        </div>
      </div>
    </div>
  )
}
