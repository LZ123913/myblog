import { db } from '../../../database/scripts/init.js'

export function indexArticle(article) {
  const existing = db.prepare('SELECT id FROM articles WHERE slug = ? AND status = ?').get(article.slug, 'deleted')
  if (existing) {
    removeFromIndex(article.slug)
    return
  }

  const tags = JSON.parse(article.tags || '[]')
  const keywords = `${article.title} ${article.content || ''} ${tags.join(' ')}`.toLowerCase()

  db.prepare(`
    INSERT INTO articles (id, slug, title, content, summary)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      summary = excluded.summary
  `).run(article.id, article.slug, article.title, keywords, article.summary)
}

export function removeFromIndex(slug) {
  db.prepare('UPDATE articles SET status = ? WHERE slug = ?').run('deleted', slug)
}

export function searchArticles(keyword, page = 1, pageSize = 10, sortBy = 'hot') {
  const offset = (page - 1) * pageSize
  const keywordLower = keyword.toLowerCase()

  let query = `
    SELECT a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
      a.likes, a.bookmarks, a.views, a.tags, a.category_id,
      (a.likes * 2 + a.bookmarks * 3 + a.views) as hot_score
    FROM articles a
    WHERE a.status = 'published'
      AND (LOWER(a.title) LIKE ? OR LOWER(a.content) LIKE ?)
  `
  const params = [`%${keywordLower}%`, `%${keywordLower}%`]

  if (sortBy === 'date') {
    query += ' ORDER BY a.published_at DESC'
  } else {
    query += ' ORDER BY hot_score DESC'
  }

  const countQuery = `
    SELECT COUNT(*) as total
    FROM articles
    WHERE status = 'published'
      AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ?)
  `
  const countResult = db.prepare(countQuery).get(`%${keywordLower}%`, `%${keywordLower}%`)

  query += ' LIMIT ? OFFSET ?'
  params.push(pageSize, offset)

  const results = db.prepare(query).all(...params)

  return {
    items: results,
    total: countResult.total,
    page,
    pageSize,
    totalPages: Math.ceil(countResult.total / pageSize)
  }
}
