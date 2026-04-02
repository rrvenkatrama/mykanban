'use strict';
/**
 * fetch-news.js — fetches AI/agentic news from RSS feeds and stores in ai_news table.
 * Run directly: node fetch-news.js
 * Scheduled via cron: 0 7 * * * /usr/bin/node /home/rajramani/kanban-api/fetch-news.js >> /home/rajramani/kanban-api/news-fetch.log 2>&1
 */

const https  = require('https');
const http   = require('http');
const mysql  = require('mysql2/promise');

const SOURCES = [
  { name: 'TechCrunch AI',   url: 'https://techcrunch.com/tag/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI',  url: 'https://feeds.feedburner.com/venturebeat/SZYF' },
  { name: 'Ars Technica AI', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'HuggingFace',     url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'The AI Beat',     url: 'https://www.marktechpost.com/feed/' },
];

const AGENTIC_KEYWORDS = [
  'agent', 'agentic', 'autonomous', 'multi-agent', 'multiagent',
  'mcp', 'model context protocol', 'copilot', 'orchestrat',
  'tool use', 'tool call', 'function call', 'reasoning model',
  'workflow automation', 'ai assistant',
];

// ── RSS/Atom parser (no external deps) ───────────────────────────────────────

function stripCdata(s) {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : s.trim();
}

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function getTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? stripCdata(m[1]) : '';
}

function getAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function parseXml(xml, sourceName) {
  const articles = [];

  // RSS 2.0
  const rssItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  for (const m of rssItems) {
    const b = m[1];
    const title = stripHtml(getTag(b, 'title'));
    if (!title) continue;
    // <link> in RSS 2.0 is a plain text node (not self-closing)
    let url = getTag(b, 'link');
    if (!url) url = getAttr(b, 'link', 'href');
    if (!url || !url.startsWith('http')) continue;
    const pubRaw = getTag(b, 'pubDate') || getTag(b, 'dc:date');
    const published_at = pubRaw ? new Date(pubRaw) : null;
    const summary = stripHtml(getTag(b, 'description')).slice(0, 600);
    articles.push({ title, url: url.trim(), source: sourceName, summary, published_at });
  }

  // Atom
  if (articles.length === 0) {
    const atomEntries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
    for (const m of atomEntries) {
      const b = m[1];
      const title = stripHtml(getTag(b, 'title'));
      if (!title) continue;
      let url = getAttr(b, 'link', 'href');
      if (!url) url = getTag(b, 'id');
      if (!url || !url.startsWith('http')) continue;
      const pubRaw = getTag(b, 'published') || getTag(b, 'updated');
      const published_at = pubRaw ? new Date(pubRaw) : null;
      const summary = stripHtml(getTag(b, 'summary') || getTag(b, 'content')).slice(0, 600);
      articles.push({ title, url: url.trim(), source: sourceName, summary, published_at });
    }
  }

  return articles;
}

function isAgentic(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  return AGENTIC_KEYWORDS.some(kw => text.includes(kw)) ? 1 : 0;
}

// ── HTTP fetch with redirect following ───────────────────────────────────────

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KanbanNewsBot/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      timeout: 25000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        let loc = res.headers.location;
        // handle relative redirects
        if (loc.startsWith('/')) {
          const base = new URL(url);
          loc = `${base.protocol}//${base.host}${loc}`;
        }
        return resolve(fetchUrl(loc, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST     || '127.0.0.1',
    port: process.env.DB_PORT     || 3306,
    user: process.env.DB_USER     || 'ailab',
    password: process.env.DB_PASSWORD || 'ailab',
    database: process.env.DB_NAME || 'kanban',
    waitForConnections: true,
    connectionLimit: 3,
  });

  let totalInserted = 0;

  for (const src of SOURCES) {
    try {
      console.log(`Fetching ${src.name}...`);
      const xml = await fetchUrl(src.url);
      const articles = parseXml(xml, src.name);
      console.log(`  Parsed ${articles.length} articles`);

      for (const a of articles) {
        try {
          const [res] = await pool.execute(
            `INSERT IGNORE INTO ai_news (title, url, source, summary, published_at, is_agentic)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              a.title.slice(0, 490),
              a.url.slice(0, 990),
              a.source,
              a.summary || null,
              a.published_at && !isNaN(a.published_at) ? a.published_at : null,
              isAgentic(a.title, a.summary || ''),
            ]
          );
          if (res.affectedRows > 0) totalInserted++;
        } catch (err) {
          console.error(`  Insert error: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`  Error fetching ${src.name}: ${err.message}`);
    }
  }

  // Prune articles older than 30 days
  const [pruned] = await pool.execute(
    'DELETE FROM ai_news WHERE published_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
  );
  console.log(`Inserted ${totalInserted} new articles. Pruned ${pruned.affectedRows} old articles.`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
