const mysql = require('mysql2/promise');
(async () => {
  const pool = await mysql.createPool({ host:'127.0.0.1', user:'ailab', password:'ailab', database:'kanban' });
  await pool.execute(`CREATE TABLE IF NOT EXISTS ai_news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    source VARCHAR(100),
    summary TEXT,
    published_at DATETIME,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_agentic TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY unique_url (url(500))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('ai_news table created.');
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
