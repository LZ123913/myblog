import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'

const router = Router()

router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM tags ORDER BY usage_count DESC').all()
  res.json({ items })
})

router.get('/cloud', (req, res) => {
  const items = db.prepare(`
    SELECT name, usage_count FROM tags WHERE usage_count > 0 ORDER BY usage_count DESC
  `).all()
  res.json({ items })
})

router.get('/:name/articles', (req, res) => {
  const { name } = req.params
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const offset = (page - 1) * pageSize

  const items = db.prepare(`
    SELECT a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
      a.likes, a.bookmarks, a.views, a.tags
    FROM articles a WHERE a.status = 'published' AND a.tags LIKE ?
    ORDER BY a.published_at DESC LIMIT ? OFFSET ?
  `).all(`%"${name}"%`, pageSize, offset)

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM articles
    WHERE status = 'published' AND tags LIKE ?
  `).get(`%"${name}"%`)

  res.json({
    items: items.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
    total, page, pageSize, totalPages: Math.ceil(total / pageSize)
  })
})

export default router
