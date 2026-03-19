import { useState } from 'react'
import LoginPage    from './components/LoginPage.jsx'
import ProjectsPage from './components/ProjectsPage.jsx'
import KanbanBoard  from './components/KanbanBoard.jsx'

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('kanban_user')
    return raw ? JSON.parse(raw) : null
  })
  const [selectedProject, setSelectedProject] = useState(null)

  const handleLogin = (token, userData) => {
    localStorage.setItem('kanban_token', token)
    localStorage.setItem('kanban_user',  JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('kanban_token')
    localStorage.removeItem('kanban_user')
    setUser(null)
    setSelectedProject(null)
  }

  if (!user) return <LoginPage onLogin={handleLogin} />

  if (selectedProject) {
    return (
      <KanbanBoard
        user={user}
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <ProjectsPage
      user={user}
      onLogout={handleLogout}
      onSelectProject={setSelectedProject}
    />
  )
}
