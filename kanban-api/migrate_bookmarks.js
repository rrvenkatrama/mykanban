const mysql = require('mysql2/promise');
(async () => {
  const p = await mysql.createPool({ host: '127.0.0.1', user: 'ailab', password: 'ailab', database: 'kanban' });
  await p.execute(`CREATE TABLE IF NOT EXISTS news_user_state (
    user_id    INT NOT NULL,
    news_id    INT NOT NULL,
    is_read       TINYINT(1) NOT NULL DEFAULT 0,
    is_bookmarked TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, news_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await p.execute(`CREATE TABLE IF NOT EXISTS ticket_bookmarks (
    user_id   INT NOT NULL,
    ticket_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, ticket_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('news_user_state and ticket_bookmarks tables created.');
  await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });
