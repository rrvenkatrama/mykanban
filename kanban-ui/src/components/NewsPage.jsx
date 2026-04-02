import { useState, useEffect, useRef } from 'react'
import api from '../api.js'

const SOURCE_COLORS = {
  'TechCrunch AI':   '#0fba00',
  'VentureBeat AI':  '#e8542a',
  'The Verge AI':    '#fb1a21',
  'MIT Tech Review': '#a31f34',
  'HuggingFace':     '#ff9d00',
  'Ars Technica AI': '#f15a22',
  'The AI Beat':     '#6554c0',
}

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
  tabBar: {
    display: 'flex', gap: '0', borderBottom: '2px solid #dfe1e6',
    background: '#fff', padding: '0 1.5rem',
  },
  tab: (active) => ({
    padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.875rem',
    cursor: 'pointer', border: 'none', background: 'none',
    color: active ? '#0052cc' : '#6b778c',
    borderBottom: active ? '2px solid #0052cc' : '2px solid transparent',
    marginBottom: -2,
  }),
  content: { padding: '1.25rem 1.5rem' },
  grid: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  card: (isRead) => ({
    background: isRead ? '#f9f0f0' : '#fff',
    borderRadius: 8, padding: '1rem 1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: `1px solid ${isRead ? '#f0d0d0' : '#e8e8e8'}`,
  }),
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' },
  title: (isRead) => ({
    fontWeight: 600, fontSize: '0.95rem',
    color: isRead ? '#b91c1c' : '#0052cc',
    textDecoration: 'none', lineHeight: 1.4, flex: 1,
  }),
  meta: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap' },
  sourceBadge: (src) => ({
    padding: '0.1rem 0.5rem', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
    background: (SOURCE_COLORS[src] || '#6554c0') + '18',
    color: SOURCE_COLORS[src] || '#6554c0',
    border: `1px solid ${(SOURCE_COLORS[src] || '#6554c0')}40`,
    whiteSpace: 'nowrap',
  }),
  agenticBadge: {
    padding: '0.1rem 0.5rem', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
    background: '#e3fcef', color: '#006644', border: '1px solid #36b37e40', whiteSpace: 'nowrap',
  },
  date: { fontSize: '0.75rem', color: '#6b778c' },
  summary: { fontSize: '0.82rem', color: '#6b778c', marginTop: '0.4rem', lineHeight: 1.5 },
  empty: { color: '#6b778c', textAlign: 'center', padding: '3rem', fontSize: '0.95rem' },
  refreshRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' },
  refreshNote: { fontSize: '0.8rem', color: '#6b778c' },
  actionBtn: (active, color) => ({
    fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: 4,
    border: `1px solid ${color}`, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
    background: active ? color : 'transparent',
    color: active ? '#fff' : color,
  }),
  actionsRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' },
  aiSummaryBlock: {
    marginTop: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 6,
    background: '#f3f0ff', border: '1px solid #ddd2ff',
    fontSize: '0.82rem', color: '#2d1e6b', lineHeight: 1.55,
  },
  aiSummaryHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '0.35rem',
  },
  aiLabel: { fontWeight: 700, fontSize: '0.72rem', color: '#6554c0' },
  askBtn: {
    fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: 4,
    border: '1px solid #6554c0', cursor: 'pointer', fontWeight: 600,
    background: '#6554c0', color: '#fff',
  },
}

// ── Chat Modal ────────────────────────────────────────────────────────────────
function ChatModal({ article, onClose }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const updated = [...messages, { role: 'user', content: q }]
    setMessages(updated)
    setLoading(true)
    try {
      const res = await api.post(`/news/${article.id}/chat`, { messages: updated })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + (err.response?.data?.error || 'Request failed.') }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(9,30,66,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, width: 580, maxWidth: '96vw',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '0.75rem 1rem', background: '#6554c0', color: '#fff',
          borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem' }}>Ask about this article</div>
            <div style={{
              fontSize: '0.75rem', opacity: 0.85,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{article.title}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
            fontSize: '1.1rem', lineHeight: 1, padding: '0.1rem 0.25rem', flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0.75rem 1rem',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          minHeight: 200,
        }}>
          {messages.length === 0 && (
            <div style={{ color: '#9b8ec4', fontSize: '0.83rem', textAlign: 'center', marginTop: '1rem' }}>
              Ask anything about this article — the AI has read it and its summary as context.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              maxWidth: '85%', padding: '0.5rem 0.75rem', borderRadius: 8,
              fontSize: '0.85rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#6554c0' : '#f3f0ff',
              color: m.role === 'user' ? '#fff' : '#2d1e6b',
              border: m.role === 'user' ? 'none' : '1px solid #ddd2ff',
            }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{
              alignSelf: 'flex-start', fontSize: '0.8rem', color: '#9b8ec4', fontStyle: 'italic',
              padding: '0.3rem 0.5rem',
            }}>
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          display: 'flex', gap: '0.5rem', padding: '0.65rem 1rem',
          borderTop: '1px solid #e8e0ff',
        }}>
          <input
            ref={inputRef}
            style={{
              flex: 1, padding: '0.5rem 0.75rem', borderRadius: 6,
              border: '1.5px solid #c8b8ff', fontSize: '0.9rem', outline: 'none',
              fontFamily: 'inherit',
            }}
            placeholder="Ask a question…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={loading}
          />
          <button
            style={{
              padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem',
              border: 'none', cursor: loading || !input.trim() ? 'default' : 'pointer',
              background: loading || !input.trim() ? '#c8b8ff' : '#6554c0', color: '#fff',
            }}
            onClick={() => send()}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NewsPage({ user, onBack, onLogout }) {
  const [articles,      setArticles]      = useState([])
  const [tab,           setTab]           = useState('agentic')
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [lastFetch,     setLastFetch]     = useState(null)
  const [summarizing,   setSummarizing]   = useState({})
  const [summaryErrors, setSummaryErrors] = useState({})
  const [expanded,      setExpanded]      = useState({})
  const [chatArticle,   setChatArticle]   = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/news')
      setArticles(res.data)
      if (res.data.length > 0) setLastFetch(res.data[0].fetched_at)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setState = async (id, patch) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    try { await api.put(`/news/${id}/state`, patch) } catch {}
  }

  const handleLinkClick = (a) => {
    if (!a.is_read) setState(a.id, { is_read: 1 })
  }

  const handleSummarize = async (article) => {
    if (summarizing[article.id]) return
    if (article.ai_summary) {
      setExpanded(prev => ({ ...prev, [article.id]: !prev[article.id] }))
      if (!article.is_read) setState(article.id, { is_read: 1 })
      return
    }
    setSummarizing(prev => ({ ...prev, [article.id]: true }))
    setSummaryErrors(prev => ({ ...prev, [article.id]: null }))
    try {
      const res = await api.post(`/news/${article.id}/summarize`)
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, ai_summary: res.data.summary, is_read: 1 } : a
      ))
      setExpanded(prev => ({ ...prev, [article.id]: true }))
    } catch (err) {
      setSummaryErrors(prev => ({ ...prev, [article.id]: err.response?.data?.error || 'Failed' }))
    } finally {
      setSummarizing(prev => ({ ...prev, [article.id]: false }))
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.post('/news/refresh')
      setTimeout(() => { load(); setRefreshing(false) }, 8000)
    } catch { setRefreshing(false) }
  }

  const shown = tab === 'agentic' ? articles.filter(a => a.is_agentic) : articles
  const agenticCount = articles.filter(a => a.is_agentic).length

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button style={S.btn('#1565c0')} onClick={onBack}>← Projects</button>
          <span style={S.headerTitle}>AI News</span>
        </div>
        <div style={S.headerRight}>
          <span>Hi, {user.name}</span>
          <button style={S.btn('#de350b')} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div style={S.tabBar}>
        <button style={S.tab(tab === 'agentic')} onClick={() => setTab('agentic')}>
          Agentic AI {agenticCount > 0 && `(${agenticCount})`}
        </button>
        <button style={S.tab(tab === 'all')} onClick={() => setTab('all')}>
          All AI {articles.length > 0 && `(${articles.length})`}
        </button>
      </div>

      <div style={S.content}>
        <div style={S.refreshRow}>
          <button style={S.btn(refreshing ? '#6b778c' : '#0052cc')} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Fetching… (~8s)' : 'Refresh Now'}
          </button>
          {lastFetch && <span style={S.refreshNote}>Last fetched: {fmtDate(lastFetch)} · Updates daily at 7 AM</span>}
          {!lastFetch && !loading && <span style={S.refreshNote}>No articles yet — click Refresh Now to fetch.</span>}
        </div>

        {loading ? (
          <div style={S.empty}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={S.empty}>
            {tab === 'agentic' ? 'No agentic AI articles yet.' : 'No articles yet. Click Refresh Now to fetch.'}
          </div>
        ) : (
          <div style={S.grid}>
            {shown.map(a => {
              const isRead = !!a.is_read
              const isBookmarked = !!a.is_bookmarked
              return (
                <div key={a.id} style={S.card(isRead)}>
                  <div style={S.cardTop}>
                    <a
                      href={a.url} target="_blank" rel="noreferrer"
                      style={S.title(isRead)}
                      onClick={() => handleLinkClick(a)}
                    >
                      {a.title}
                    </a>
                  </div>

                  <div style={S.meta}>
                    <span style={S.sourceBadge(a.source)}>{a.source}</span>
                    {a.is_agentic === 1 && <span style={S.agenticBadge}>Agentic</span>}
                    {a.published_at && <span style={S.date}>{fmtDate(a.published_at)}</span>}
                  </div>

                  {a.summary && <div style={S.summary}>{a.summary}</div>}

                  <div style={S.actionsRow}>
                    <button
                      style={S.actionBtn(a.ai_summary && expanded[a.id], '#6554c0')}
                      onClick={() => handleSummarize(a)}
                      disabled={summarizing[a.id]}
                    >
                      {summarizing[a.id] ? '…' : a.ai_summary ? (expanded[a.id] ? 'Hide Summary' : 'AI Summary') : 'AI Summary'}
                    </button>

                    {isRead ? (
                      <button style={S.actionBtn(false, '#6b778c')} onClick={() => setState(a.id, { is_read: 0 })}>
                        Mark Unread
                      </button>
                    ) : (
                      <button style={S.actionBtn(false, '#36b37e')} onClick={() => setState(a.id, { is_read: 1 })}>
                        Mark Read
                      </button>
                    )}

                    <button
                      style={S.actionBtn(isBookmarked, '#ff991f')}
                      onClick={() => setState(a.id, { is_bookmarked: isBookmarked ? 0 : 1 })}
                    >
                      {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
                    </button>
                  </div>

                  {summaryErrors[a.id] && (
                    <div style={{ fontSize: '0.78rem', color: '#de350b', marginTop: '0.35rem' }}>
                      {summaryErrors[a.id]}
                    </div>
                  )}

                  {a.ai_summary && expanded[a.id] && (
                    <div style={S.aiSummaryBlock}>
                      <div style={S.aiSummaryHeader}>
                        <span style={S.aiLabel}>AI SUMMARY</span>
                        <button style={S.askBtn} onClick={() => setChatArticle(a)}>
                          💬 Ask Questions
                        </button>
                      </div>
                      {a.ai_summary}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {chatArticle && (
        <ChatModal article={chatArticle} onClose={() => setChatArticle(null)} />
      )}
    </div>
  )
}
