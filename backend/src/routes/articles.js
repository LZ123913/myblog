import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, optionalAuth, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { generateSummary, moderateComment } from '../services/aiService.js'
import { sendArticleNotifications } from '../services/emailService.js'
import { writeArticleFile, readArticleFile, moveToRecycle, deleteArticleFile, generateSlug, deleteFromRecycle, restoreFromRecycle } from '../services/fileService.js'

const router = Router()

router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const categoryId = req.query.categoryId
  const tag = req.query.tag
  const sortBy = req.query.sortBy || 'date'

  const offset = (page - 1) * pageSize
  const selectFields = `a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
    a.likes, a.bookmarks, a.views, a.tags, a.category_id`
  let whereClause = `a.status = 'published'`
  const params = []

  if (categoryId) {
    whereClause += ' AND a.category_id = ?'
    params.push(categoryId)
  }
  if (tag) {
    whereClause += ' AND a.tags LIKE ?'
    params.push(`%"${tag}"%`)
  }

  const orderBy = sortBy === 'date'
    ? 'a.published_at DESC'
    : '(a.likes * 2 + a.bookmarks * 3 + a.views * (1.0 / (1 + (julianday(\'now\') - julianday(a.published_at)) / 30))) DESC'

  const countResult = db.prepare(
    `SELECT COUNT(*) as total FROM articles a WHERE ${whereClause}`
  ).get(...params)

  const items = db.prepare(
    `SELECT ${selectFields} FROM articles a WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)

  res.json({
    items: items.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
    total: countResult.total,
    page,
    pageSize,
    totalPages: Math.ceil(countResult.total / pageSize)
  })
})

router.get('/archive/timeline', (req, res) => {
  const articles = db.prepare(`
    SELECT slug, title, published_at FROM articles
    WHERE status = 'published' ORDER BY published_at DESC
  `).all()

  const grouped = {}
  for (const a of articles) {
    if (!a.published_at) continue
    const date = new Date(a.published_at)
    const key = `${date.getFullYear()}年${date.getMonth() + 1}月`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  }

  res.json({ groups: Object.entries(grouped).map(([month, articles]) => ({ month, articles })) })
})

router.get('/recommendations', optionalAuth, (req, res) => {
  const userId = req.user?.id
  const tagsParam = req.query.tags
  const excludeParam = req.query.exclude
  const excludeIds = []
  const tagCounts = {}

  if (excludeParam) {
    try {
      const parsed = JSON.parse(decodeURIComponent(excludeParam))
      if (Array.isArray(parsed)) excludeIds.push(...parsed)
    } catch {}
  }

  if (tagsParam) {
    const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)
    for (const t of tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1
    }
  } else if (userId) {
    const user = db.prepare('SELECT liked_posts, bookmarks FROM users WHERE id = ?').get(userId)
    if (user) {
      const liked = JSON.parse(user.liked_posts || '[]')
      const marked = JSON.parse(user.bookmarks || '[]')
      const interactedIds = [...new Set([...liked, ...marked])]
      excludeIds.push(...interactedIds)

      for (const aid of interactedIds) {
        const art = db.prepare('SELECT tags FROM articles WHERE id = ?').get(aid)
        if (art) {
          const tags = JSON.parse(art.tags || '[]')
          for (const t of tags) {
            tagCounts[t] = (tagCounts[t] || 0) + 1
          }
        }
      }
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t)

  let items = []
  if (topTags.length > 0) {
    const tagConditions = topTags.map(() => 'a.tags LIKE ?').join(' OR ')
    const tagParams = topTags.map(t => `%"${t}"%`)
    let excludeClause = ''
    let excludeParams = []
    if (excludeIds.length > 0) {
      excludeClause = ` AND a.id NOT IN (${excludeIds.map(() => '?').join(',')})`
      excludeParams = excludeIds
    }
    items = db.prepare(`
      SELECT a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
        a.likes, a.bookmarks, a.views, a.tags, a.category_id
      FROM articles a
      WHERE a.status = 'published' ${excludeClause}
        AND (${tagConditions})
      ORDER BY (a.likes * 2 + a.bookmarks * 3 + a.views) DESC
      LIMIT 10
    `).all(...excludeParams, ...tagParams)
  }

  if (items.length < 5) {
    const existingIds = items.map(a => a.id)
    const allExclude = [...excludeIds, ...existingIds]
    let excludeClause = ''
    let excludeParams = []
    if (allExclude.length > 0) {
      excludeClause = ` AND a.id NOT IN (${allExclude.map(() => '?').join(',')})`
      excludeParams = allExclude
    }
    const fallback = db.prepare(`
      SELECT a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
        a.likes, a.bookmarks, a.views, a.tags, a.category_id
      FROM articles a
      WHERE a.status = 'published' ${excludeClause}
      ORDER BY (a.likes * 2 + a.bookmarks * 3 + a.views) DESC
      LIMIT ?
    `).all(...excludeParams, 10 - items.length)
    items.push(...fallback)
  }

  res.json({
    items: items.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
    basedOn: topTags.length > 0 ? topTags : null
  })
})

router.get('/:slug', optionalAuth, asyncHandler(async (req, res) => {
  const { slug } = req.params
  const article = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.slug = ? AND a.status = 'published'
  `).get(slug)

  if (!article) {
    throw new ApiError('articleNotFound', '文章不存在或已被删除', 404)
  }

  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(article.id)

  let contentMd = readArticleFile(slug)
  if (!contentMd) {
    contentMd = article.content
  }

  let summary = article.summary
  if (!summary) {
    summary = await generateSummary(article.content || contentMd, article.title)
    db.prepare('UPDATE articles SET summary = ? WHERE id = ?').run(summary, article.id)
  }

  let liked = false
  let bookmarked = null
  if (req.user) {
    const user = db.prepare('SELECT liked_posts, bookmarks FROM users WHERE id = ?').get(req.user.id)
    const likedPosts = JSON.parse(user.liked_posts || '[]')
    const bookmarks = JSON.parse(user.bookmarks || '[]')
    liked = likedPosts.includes(slug)
    bookmarked = bookmarks.find(b => b.slug === slug) || null
  }

  res.json({
    ...article,
    content: contentMd,
    summary,
    tags: JSON.parse(article.tags || '[]'),
    liked,
    bookmarked
  })
}))

router.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { title, content, tags, categoryId, coverImage } = req.body

  if (!title || !title.trim()) throw new ApiError('titleRequired', '标题不能为空')
  if (!content || !content.trim()) throw new ApiError('contentRequired', '正文不能为空')
  if (!categoryId) throw new ApiError('categoryRequired', '分类不能为空')

  const slug = generateSlug(title)
  const author = db.prepare('SELECT id FROM authors WHERE user_id = ?').get(req.user.id)

  const result = db.prepare(`
    INSERT INTO articles (slug, title, content, author_id, category_id, status, tags, cover_image, published_at)
    VALUES (?, ?, ?, ?, ?, 'published', ?, ?, datetime('now'))
  `).run(slug, title.trim(), content, author?.id || null, categoryId, JSON.stringify(tags || []), coverImage || '')

  writeArticleFile(slug, content)

  for (const tag of (tags || [])) {
    db.prepare('INSERT OR IGNORE INTO tags (name, usage_count) VALUES (?, 0)').run(tag)
    db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(tag)
    const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag)
    if (tagRow) {
      db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(result.lastInsertRowid, tagRow.id)
    }
  }

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid)
  sendArticleNotifications(article).catch(err => console.error('[Email] Notification failed:', err.message))

  res.json(article)
})

router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const { title, content, tags, categoryId, coverImage } = req.body

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
  if (!article) throw new ApiError('articleNotFound', '文章不存在', 404)

  if (!title || !title.trim()) throw new ApiError('titleRequired', '标题不能为空')
  if (!content || !content.trim()) throw new ApiError('contentRequired', '正文不能为空')

  const oldTags = JSON.parse(article.tags || '[]')
  const newTags = tags || []

  const removedTags = oldTags.filter(t => !newTags.includes(t))
  const addedTags = newTags.filter(t => !oldTags.includes(t))

  for (const t of removedTags) {
    db.prepare('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE name = ?').run(t)
    const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(t)
    if (tagRow) {
      db.prepare('DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?').run(id, tagRow.id)
    }
  }

  for (const t of addedTags) {
    db.prepare('INSERT OR IGNORE INTO tags (name, usage_count) VALUES (?, 0)').run(t)
    db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(t)
    const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(t)
    if (tagRow) {
      db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(id, tagRow.id)
    }
  }

  db.prepare(`
    UPDATE articles SET title = ?, content = ?, tags = ?, category_id = ?, cover_image = ?, summary = '', updated_at = datetime('now')
    WHERE id = ?
  `).run(title.trim(), content, JSON.stringify(newTags), categoryId, coverImage || '', id)

  writeArticleFile(article.slug, content)

  res.json({ success: true })
})

router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id)
  if (!article) throw new ApiError('articleNotFound', '文章不存在', 404)

  db.prepare('UPDATE articles SET status = ?, deleted_at = datetime(\'now\') WHERE id = ?').run('deleted', id)

  moveToRecycle(article.slug)

  const tags = JSON.parse(article.tags || '[]')
  for (const t of tags) {
    db.prepare('UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE name = ?').run(t)
  }

  res.json({ success: true })
})

router.post('/:id/like', authMiddleware, (req, res) => {
  const { id } = req.params
  const article = db.prepare('SELECT slug, likes FROM articles WHERE id = ? AND status = ?').get(id, 'published')
  if (!article) throw new ApiError('articleNotFound', '文章不存在', 404)

  const user = db.prepare('SELECT liked_posts FROM users WHERE id = ?').get(req.user.id)
  const likedPosts = JSON.parse(user.liked_posts || '[]')

  if (likedPosts.includes(article.slug)) {
    const idx = likedPosts.indexOf(article.slug)
    likedPosts.splice(idx, 1)
    db.prepare('UPDATE articles SET likes = MAX(0, likes - 1) WHERE id = ?').run(id)
  } else {
    likedPosts.push(article.slug)
    db.prepare('UPDATE articles SET likes = likes + 1 WHERE id = ?').run(id)
  }

  db.prepare('UPDATE users SET liked_posts = ? WHERE id = ?').run(JSON.stringify(likedPosts), req.user.id)

  const updated = db.prepare('SELECT likes FROM articles WHERE id = ?').get(id)
  res.json({ likes: updated.likes, liked: likedPosts.includes(article.slug) })
})

router.post('/:id/bookmark', authMiddleware, (req, res) => {
  const { id } = req.params
  const { privacy } = req.body

  const article = db.prepare('SELECT slug, bookmarks FROM articles WHERE id = ? AND status = ?').get(id, 'published')
  if (!article) throw new ApiError('articleNotFound', '文章不存在', 404)

  const user = db.prepare('SELECT bookmarks FROM users WHERE id = ?').get(req.user.id)
  const bookmarks = JSON.parse(user.bookmarks || '[]')

  const existing = bookmarks.find(b => b.slug === article.slug)
  if (existing) {
    const idx = bookmarks.indexOf(existing)
    bookmarks.splice(idx, 1)
    if (existing.privacy === 'public') {
      db.prepare('UPDATE articles SET bookmarks = MAX(0, bookmarks - 1) WHERE id = ?').run(id)
    }
  } else {
    bookmarks.push({ slug: article.slug, privacy: privacy || 'public' })
    db.prepare('UPDATE articles SET bookmarks = bookmarks + 1 WHERE id = ?').run(id)
  }

  db.prepare('UPDATE users SET bookmarks = ? WHERE id = ?').run(JSON.stringify(bookmarks), req.user.id)

  const updated = db.prepare('SELECT bookmarks FROM articles WHERE id = ?').get(id)
  res.json({ bookmarks: updated.bookmarks, bookmarked: bookmarks.find(b => b.slug === article.slug) || null })
})

router.get('/admin/list', authMiddleware, requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 20
  const offset = (page - 1) * pageSize

  const items = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a LEFT JOIN categories c ON a.category_id = c.id
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset)

  const { total } = db.prepare('SELECT COUNT(*) as total FROM articles').get()

  res.json({
    items: items.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
    total, page, pageSize, totalPages: Math.ceil(total / pageSize)
  })
})

export default router
