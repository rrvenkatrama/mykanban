import { useState, useEffect } from 'react'
import LoginPage    from './components/LoginPage.jsx'
import KanbanBoard  from './components/KanbanBoard.jsx'

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('kanban_user')
    return raw ? JSON.parse(raw) : null
  })

  const handleLogin = (token, userData) => {
    localStorage.setItem('kanban_token', token)
    localStorage.setItem('kanban_user',  JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('kanban_token')
    localStorage.removeItem('kanban_user')
    setUser(null)
  }

  if (!user) return <LoginPage onLogin={handleLogin} />
  return <KanbanBoard user={user} onLogout={handleLogout} />
}
