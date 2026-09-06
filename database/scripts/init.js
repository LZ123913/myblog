import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath, URL } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = process.env.DB_PATH || join(dataDir, 'blog.db')
const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'reader',
      status TEXT NOT NULL DEFAULT 'active',
      avatar TEXT DEFAULT '',
      liked_posts TEXT DEFAULT '[]',
      bookmarks TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT,
      reset_token TEXT,
      reset_token_expires TEXT
    );

    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      motto TEXT DEFAULT '',
      bio TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER REFERENCES authors(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      github_url TEXT DEFAULT '',
      image TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES categories(id),
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      author_id INTEGER REFERENCES authors(id),
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'published',
      likes INTEGER DEFAULT 0,
      bookmarks INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      cover_image TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      published_at TEXT,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT '',
      raw_content TEXT DEFAULT '',
      polished_content TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      category_id INTEGER REFERENCES categories(id),
      images TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'imported',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS polish_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER REFERENCES drafts(id) ON DELETE CASCADE,
      original_content TEXT DEFAULT '',
      polished_content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      parent_id INTEGER REFERENCES comments(id),
      is_valid INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      is_verified INTEGER DEFAULT 0,
      verify_token TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT DEFAULT '',
      text_body TEXT DEFAULT '',
      status TEXT DEFAULT 'disabled',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario TEXT NOT NULL,
      provider TEXT DEFAULT 'qwen',
      model TEXT DEFAULT 'qwen-plus',
      api_url TEXT DEFAULT '',
      api_key_encrypted TEXT DEFAULT '',
      timeout_ms INTEGER DEFAULT 3000,
      system_prompt TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES users(id),
      target_user_id INTEGER,
      action TEXT NOT NULL,
      result TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER REFERENCES subscriptions(id),
      article_id INTEGER REFERENCES articles(id),
      template_id INTEGER REFERENCES email_templates(id),
      status TEXT DEFAULT 'pending',
      error_message TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  const existingAiConfigs = db.prepare('SELECT COUNT(*) as count FROM ai_configs').get()
  if (existingAiConfigs.count === 0) {
    const defaultApiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    const seed = db.prepare(`
      INSERT INTO ai_configs (scenario, provider, model, api_url, api_key_encrypted, timeout_ms, system_prompt, enabled, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    seed.run('summary', 'qwen', 'qwen-plus', defaultApiUrl, '', 3000, '', 1, 1)
    seed.run('polish', 'qwen', 'qwen-plus', defaultApiUrl, '', 10000, '', 1, 1)
    seed.run('tag', 'qwen', 'qwen-plus', defaultApiUrl, '', 3000, '', 1, 1)
    seed.run('comment', 'qwen', 'qwen-plus', defaultApiUrl, '', 3000, '', 1, 1)
    console.log('[DB] AI configs seeded')
  }

  // 种子数据：站点设置
  const settingCount = db.prepare('SELECT COUNT(*) as count FROM site_settings').get()
  if (settingCount.count === 0) {
    const seedSetting = db.prepare(`
      INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
    `)
    seedSetting.run('blog_name', '拾光集')
    seedSetting.run('blog_subtitle', '记录每一束思想的光')
    seedSetting.run('author_avatar', '/avatar.jpg')
    seedSetting.run('author_name', '拾光者')
    seedSetting.run('mottos', JSON.stringify([
      '记录每一束思想的光',
      '生活不止眼前的苟且，还有诗和远方',
      '愿你走出半生，归来仍是少年',
      '星光不问赶路人，时光不负有心人',
      '所有的相遇，都是久别重逢',
      '人生没有白走的路，每一步都算数',
      '保持热爱，奔赴山海',
      '万物皆有裂痕，那是光照进来的地方'
    ]))
    console.log('[DB] Site settings seeded')
  }

  console.log('[DB] Database initialized successfully')
  return db
}

export { db }
export default db
