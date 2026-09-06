import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

function timeDecayHot(article) {
  const raw = (article.likes || 0) * 2 + (article.bookmarks || 0) * 3 + (article.views || 0)
  const publishedAt = new Date(article.published_at || article.created_at)
  const daysSince = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
  const decayFactor = 1 / (1 + daysSince / 30)
  return raw * decayFactor
}

router.get('/suggestions', (req, res) => {
  const { q } = req.query
  if (!q || q.trim().length < 1) {
    return res.json({ items: [] })
  }
  const keyword = `%${q.trim().toLowerCase()}%`
  const items = db.prepare(`
    SELECT slug, title, likes, bookmarks, views, published_at
    FROM articles
    WHERE status = 'published'
      AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ?)
    ORDER BY (likes * 2 + bookmarks * 3 + views) DESC
    LIMIT 8
  `).all(keyword, keyword)

  const result = items.map(a => ({
    slug: a.slug,
    title: a.title,
    likes: a.likes,
    bookmarks: a.bookmarks,
    views: a.views,
    hotScore: Math.round(timeDecayHot(a)),
    fireLevel: getFireLevel(timeDecayHot(a))
  }))

  res.json({ items: result })
})

function getFireLevel(score) {
  if (score >= 80) return 3
  if (score >= 40) return 2
  if (score >= 15) return 1
  return 0
}

router.get('/', (req, res) => {
  const { q, page = 1, pageSize = 10, sortBy = 'hot' } = req.query

  if (!q || q.trim().length < 2) {
    throw new ApiError('queryTooShort', '搜索关键词至少需要 2 个字符')
  }

  const pageNum = parseInt(page)
  const pageSizeNum = parseInt(pageSize)
  const offset = (pageNum - 1) * pageSizeNum
  const keyword = `%${q.trim().toLowerCase()}%`

  const items = db.prepare(`
    SELECT a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
      a.likes, a.bookmarks, a.views, a.tags, a.created_at
    FROM articles a
    WHERE a.status = 'published'
      AND (LOWER(a.title) LIKE ? OR LOWER(a.content) LIKE ?)
    ORDER BY (a.likes * 2 + a.bookmarks * 3 + a.views) DESC
    LIMIT ? OFFSET ?
  `).all(keyword, keyword, pageSizeNum, offset)

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM articles
    WHERE status = 'published'
      AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ?)
  `).get(keyword, keyword)

  if (sortBy === 'hot') {
    items.sort((a, b) => timeDecayHot(b) - timeDecayHot(a))
  }

  const result = items.map((a, idx) => ({
    ...a,
    tags: JSON.parse(a.tags || '[]'),
    hotScore: Math.round(timeDecayHot(a)),
    fireLevel: getFireLevel(timeDecayHot(a)),
    recommended: sortBy === 'hot' && idx < 3
  }))

  res.json({
    items: result,
    total,
    page: pageNum,
    pageSize: pageSizeNum,
    totalPages: Math.ceil(total / pageSizeNum)
  })
})

export default router
