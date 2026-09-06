import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'

const router = Router()

router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM categories ORDER BY sort_order').all()
  const tree = buildTree(items, null)
  res.json({ items, tree })
})

router.get('/:id/articles', (req, res) => {
  const { id } = req.params
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const offset = (page - 1) * pageSize

  const items = db.prepare(`
    SELECT a.id, a.slug, a.title, a.summary, a.cover_image, a.published_at,
      a.likes, a.bookmarks, a.views, a.tags
    FROM articles a WHERE a.status = 'published' AND a.category_id = ?
    ORDER BY a.published_at DESC LIMIT ? OFFSET ?
  `).all(id, pageSize, offset)

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM articles
    WHERE status = 'published' AND category_id = ?
  `).get(id)

  res.json({
    items: items.map(a => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
    total, page, pageSize, totalPages: Math.ceil(total / pageSize)
  })
})

function buildTree(items, parentId) {
  return items
    .filter(i => i.parent_id === parentId || (!parentId && !i.parent_id))
    .map(i => ({ ...i, children: buildTree(items, i.id) }))
}

export default router
