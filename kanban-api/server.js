const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');

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

// ── Users route ───────────────────────────────────────────────────────────────
app.get('/api/users', authRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, email FROM users ORDER BY name');
    res.json(rows);
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
  const { title, description, status, priority, assignee_id, due_date } = req.body;
  try {
    await pool.execute(
      `UPDATE tickets
       SET title       = COALESCE(?, title),
           description = COALESCE(?, description),
           status      = COALESCE(?, status),
           priority    = COALESCE(?, priority),
           assignee_id = ?,
           due_date    = ?
       WHERE id = ?`,
      [
        title || null,
        description !== undefined ? description : null,
        status || null,
        priority || null,
        assignee_id !== undefined ? assignee_id : null,
        due_date !== undefined ? due_date : null,
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

// ── Serve React build ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Kanban API listening on port ${PORT}`));
