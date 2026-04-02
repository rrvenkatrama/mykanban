const express    = require('express');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const path       = require('path');
const https      = require('https');
const http       = require('http');
const Anthropic  = require('@anthropic-ai/sdk').default;

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

app.use(cors());
app.use(express.json());

// ── MySQL connection pool ─────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'ailab',
  password: process.env.DB_PASSWORD || 'ailab',
  database: process.env.DB_NAME     || 'kanban',
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function authRequired(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    const token = jwt.sign({ id: result.insertId, name, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: result.insertId, name, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Users routes ──────────────────────────────────────────────────────────────
app.get('/api/users', authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email FROM users ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authRequired, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    res.status(201).json({ id: result.insertId, name, email });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), password_hash = ? WHERE id = ?',
        [name || null, email || null, hash, id]
      );
    } else {
      await pool.execute(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
        [name || null, email || null, id]
      );
    }
    const [rows] = await pool.execute('SELECT id, name, email FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    // Unassign tickets and move them back to todo
    await pool.execute(
      "UPDATE tickets SET assignee_id = NULL, status = 'todo' WHERE assignee_id = ?",
      [id]
    );
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Projects routes ───────────────────────────────────────────────────────────
app.get('/api/projects', authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, u.name AS creator_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/projects', authRequired, async (req, res) => {
  const { name, description, priority, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const [result] = await pool.execute(
      `INSERT INTO projects (name, description, priority, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, priority || 'medium', status || 'planning',
       planned_start_date || null, planned_end_date || null,
       actual_start_date || null, actual_end_date || null,
       req.user.id]
    );
    const [rows] = await pool.execute(
      'SELECT p.*, u.name AS creator_name FROM projects p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/projects/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, description, priority, status, planned_start_date, planned_end_date, actual_start_date, actual_end_date } = req.body;
  try {
    await pool.execute(
      `UPDATE projects SET
         name               = COALESCE(?, name),
         description        = ?,
         priority           = COALESCE(?, priority),
         status             = COALESCE(?, status),
         planned_start_date = ?,
         planned_end_date   = ?,
         actual_start_date  = ?,
         actual_end_date    = ?
       WHERE id = ?`,
      [name || null,
       description !== undefined ? description : null,
       priority || null, status || null,
       planned_start_date !== undefined ? planned_start_date || null : null,
       planned_end_date   !== undefined ? planned_end_date   || null : null,
       actual_start_date  !== undefined ? actual_start_date  || null : null,
       actual_end_date    !== undefined ? actual_end_date    || null : null,
       id]
    );
    const [rows] = await pool.execute(
      'SELECT p.*, u.name AS creator_name FROM projects p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/projects/:id', authRequired, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM projects WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Tickets routes ────────────────────────────────────────────────────────────
app.get('/api/tickets', authRequired, async (req, res) => {
  const { project_id } = req.query;
  try {
    let sql = `
      SELECT t.*,
             u1.name AS assignee_name,
             u2.name AS creator_name
      FROM tickets t
      LEFT JOIN users u1 ON u1.id = t.assignee_id
      LEFT JOIN users u2 ON u2.id = t.created_by
    `;
    const params = [];
    if (project_id) {
      sql += ' WHERE t.project_id = ?';
      params.push(Number(project_id));
    }
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/tickets', authRequired, async (req, res) => {
  const { title, description, status, priority, assignee_id, due_date, project_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const [result] = await pool.execute(
      `INSERT INTO tickets (title, description, status, priority, assignee_id, due_date, project_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description || null,
        status || 'backlog',
        priority || 'medium',
        assignee_id || null,
        due_date || null,
        project_id || null,
        req.user.id,
      ]
    );
    const [rows] = await pool.execute(`
      SELECT t.*, u1.name AS assignee_name, u2.name AS creator_name
      FROM tickets t
      LEFT JOIN users u1 ON u1.id = t.assignee_id
      LEFT JOIN users u2 ON u2.id = t.created_by
      WHERE t.id = ?
    `, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tickets/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assignee_id, due_date, sprint_id } = req.body;
  try {
    await pool.execute(
      `UPDATE tickets
       SET title       = COALESCE(?, title),
           description = COALESCE(?, description),
           status      = COALESCE(?, status),
           priority    = COALESCE(?, priority),
           assignee_id = ?,
           due_date    = ?,
           sprint_id   = ?
       WHERE id = ?`,
      [
        title || null,
        description !== undefined ? description : null,
        status || null,
        priority || null,
        assignee_id !== undefined ? assignee_id : null,
        due_date !== undefined ? due_date : null,
        sprint_id !== undefined ? sprint_id || null : null,
        id,
      ]
    );
    const [rows] = await pool.execute(`
      SELECT t.*, u1.name AS assignee_name, u2.name AS creator_name
      FROM tickets t
      LEFT JOIN users u1 ON u1.id = t.assignee_id
      LEFT JOIN users u2 ON u2.id = t.created_by
      WHERE t.id = ?
    `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/tickets/:id', authRequired, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM tickets WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Comments routes ───────────────────────────────────────────────────────────
app.get('/api/tickets/:id/comments', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.ticket_id = ?
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/tickets/:id/comments', authRequired, async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, body.trim()]
    );
    const [rows] = await pool.execute(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/comments/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT user_id FROM comments WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await pool.execute('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Sprints routes ────────────────────────────────────────────────────────────
app.get('/api/sprints', authRequired, async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  try {
    const [rows] = await pool.execute(
      `SELECT s.*,
              u.name AS creator_name,
              COUNT(t.id) AS ticket_count
       FROM sprints s
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN tickets t ON t.sprint_id = s.id
       WHERE s.project_id = ?
       GROUP BY s.id
       ORDER BY s.start_date ASC, s.created_at ASC`,
      [Number(project_id)]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sprints', authRequired, async (req, res) => {
  const { name, project_id, status, start_date, end_date } = req.body;
  if (!name)       return res.status(400).json({ error: 'name is required' });
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  try {
    const [result] = await pool.execute(
      `INSERT INTO sprints (name, project_id, status, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, project_id, status || 'planned', start_date || null, end_date || null, req.user.id]
    );
    const [rows] = await pool.execute(
      `SELECT s.*, u.name AS creator_name, 0 AS ticket_count
       FROM sprints s LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sprints/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, status, start_date, end_date } = req.body;
  try {
    await pool.execute(
      `UPDATE sprints
       SET name       = COALESCE(?, name),
           status     = COALESCE(?, status),
           start_date = ?,
           end_date   = ?
       WHERE id = ?`,
      [name || null, status || null,
       start_date !== undefined ? start_date || null : null,
       end_date   !== undefined ? end_date   || null : null,
       id]
    );
    const [rows] = await pool.execute(
      `SELECT s.*, u.name AS creator_name, COUNT(t.id) AS ticket_count
       FROM sprints s
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN tickets t ON t.sprint_id = s.id
       WHERE s.id = ?
       GROUP BY s.id`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Sprint not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sprints/:id', authRequired, async (req, res) => {
  try {
    // Unassign tickets from this sprint before deleting
    await pool.execute('UPDATE tickets SET sprint_id = NULL WHERE sprint_id = ?', [req.params.id]);
    const [result] = await pool.execute('DELETE FROM sprints WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sprint not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── News routes ───────────────────────────────────────────────────────────────
app.get('/api/news', authRequired, async (req, res) => {
  const { agentic } = req.query;
  try {
    let sql = `
      SELECT n.id, n.title, n.url, n.source, n.summary, n.ai_summary, n.published_at, n.is_agentic,
             COALESCE(s.is_read, 0)       AS is_read,
             COALESCE(s.is_bookmarked, 0) AS is_bookmarked
      FROM ai_news n
      LEFT JOIN news_user_state s ON s.news_id = n.id AND s.user_id = ?`;
    if (agentic === '1') sql += ' WHERE n.is_agentic = 1';
    sql += ' ORDER BY n.published_at DESC, n.fetched_at DESC LIMIT 100';
    const [rows] = await pool.execute(sql, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/news/:id/state', authRequired, async (req, res) => {
  const { id } = req.params;
  const { is_read, is_bookmarked } = req.body;
  try {
    await pool.execute(
      `INSERT INTO news_user_state (user_id, news_id, is_read, is_bookmarked)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_read       = COALESCE(?, is_read),
         is_bookmarked = COALESCE(?, is_bookmarked)`,
      [
        req.user.id, id,
        is_read       !== undefined ? is_read       : 0,
        is_bookmarked !== undefined ? is_bookmarked : 0,
        is_read       !== undefined ? is_read       : null,
        is_bookmarked !== undefined ? is_bookmarked : null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/news/refresh', authRequired, (_req, res) => {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, [path.join(__dirname, 'fetch-news.js')], {
    detached: true, stdio: 'ignore', env: process.env,
  });
  child.unref();
  res.json({ message: 'Refresh started' });
});

// ── Ticket bookmarks ─────────────────────────────────────────────────────────
app.post('/api/tickets/:id/bookmark', authRequired, async (req, res) => {
  try {
    await pool.execute(
      'INSERT IGNORE INTO ticket_bookmarks (user_id, ticket_id) VALUES (?, ?)',
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/tickets/:id/bookmark', authRequired, async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM ticket_bookmarks WHERE user_id = ? AND ticket_id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Bookmarks (news + tickets) ────────────────────────────────────────────────
app.get('/api/bookmarks', authRequired, async (req, res) => {
  try {
    const [news] = await pool.execute(
      `SELECT n.id, n.title, n.url, n.source, n.summary, n.ai_summary,
              n.published_at, n.is_agentic,
              1 AS is_bookmarked,
              COALESCE(s.is_read, 0) AS is_read
       FROM news_user_state s
       JOIN ai_news n ON n.id = s.news_id
       WHERE s.user_id = ? AND s.is_bookmarked = 1
       ORDER BY n.published_at DESC`,
      [req.user.id]
    );
    const [tickets] = await pool.execute(
      `SELECT t.*, u1.name AS assignee_name, u2.name AS creator_name,
              b.created_at AS bookmarked_at
       FROM ticket_bookmarks b
       JOIN tickets t ON t.id = b.ticket_id
       LEFT JOIN users u1 ON u1.id = t.assignee_id
       LEFT JOIN users u2 ON u2.id = t.created_by
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ news, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Article chat ─────────────────────────────────────────────────────────────
app.post('/api/news/:id/chat', authRequired, async (req, res) => {
  const { id } = req.params;
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set on server' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT title, source, summary, ai_summary, published_at FROM ai_news WHERE id = ?', [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    const a = rows[0];

    const contextLines = [
      `Article: "${a.title}"`,
      `Source: ${a.source}`,
      a.published_at ? `Published: ${new Date(a.published_at).toDateString()}` : '',
      a.ai_summary  ? `\nAI Summary: ${a.ai_summary}` : '',
      a.summary     ? `\nExcerpt: ${a.summary}` : '',
    ].filter(Boolean).join('\n');

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: `You are an AI assistant helping the user understand and explore a news article. Answer questions concisely. Draw on your broader knowledge for context, comparisons, and practical advice. Be direct and opinionated when asked ("should I learn this?").\n\n${contextLines}`,
      messages: messages.slice(-10), // cap to last 10 turns to limit tokens
    });

    const reply = response.content.find(b => b.type === 'text')?.text?.trim() || '';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat failed' });
  }
});

// ── Article summarizer ────────────────────────────────────────────────────────
function fetchArticleText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KanbanNewsBot/1.0)' },
      timeout: 12000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        let loc = res.headers.location;
        if (loc.startsWith('/')) { const b = new URL(url); loc = `${b.protocol}//${b.host}${loc}`; }
        return resolve(fetchArticleText(loc));
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function extractReadableText(html) {
  if (!html) return '';
  // Try to get article/main content first
  const articleMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
  const src = articleMatch ? articleMatch[1] : html;
  return src
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

app.post('/api/news/:id/summarize', authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM ai_news WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    const article = rows[0];

    // Return cached AI summary if available
    if (article.ai_summary) return res.json({ summary: article.ai_summary });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set on server' });
    }

    // Fetch and extract article text; fall back to RSS snippet
    let text = '';
    const html = await fetchArticleText(article.url);
    if (html) {
      text = extractReadableText(html).slice(0, 3000);
    }
    if (text.length < 100 && article.summary) {
      text = article.summary; // fall back to RSS excerpt
    }
    if (!text) return res.status(422).json({ error: 'Could not extract article content' });

    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Summarize this article in 3 concise sentences. Cover: what was announced or discovered, why it matters for AI practitioners, and any key technical detail.\n\nTitle: ${article.title}\n\n${text}`,
      }],
    });

    const summary = message.content.find(b => b.type === 'text')?.text?.trim() || '';

    // Cache summary in DB
    await pool.execute('UPDATE ai_news SET ai_summary = ? WHERE id = ?', [summary, id]);

    // Auto-mark as read for this user
    await pool.execute(
      `INSERT INTO news_user_state (user_id, news_id, is_read, is_bookmarked) VALUES (?, ?, 1, 0)
       ON DUPLICATE KEY UPDATE is_read = 1`,
      [req.user.id, id]
    );

    res.json({ summary });
  } catch (err) {
    console.error('Summarize error:', err.message);
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// ── Serve React build ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Kanban API listening on port ${PORT}`));
