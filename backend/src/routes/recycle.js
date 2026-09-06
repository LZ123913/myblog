import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { restoreFromRecycle, deleteFromRecycle } from '../services/fileService.js'

const router = Router()

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const items = db.prepare(`
    SELECT a.id, a.slug, a.title, a.deleted_at, a.tags, a.category_id
    FROM articles a WHERE a.status = 'deleted' ORDER BY a.deleted_at DESC
  `).all()

  const result = items.map(a => {
    const deletedDate = new Date(a.deleted_at)
    const daysLeft = 30 - Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24))
    return {
      ...a,
      tags: JSON.parse(a.tags || '[]'),
      daysLeft: Math.max(0, daysLeft),
      canRestore: daysLeft > 0
    }
  })

  res.json({ items: result })
})

router.post('/:id/restore', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const article = db.prepare('SELECT * FROM articles WHERE id = ? AND status = ?').get(id, 'deleted')
  if (!article) throw new ApiError('notFound', '文章不存在', 404)

  const deletedDate = new Date(article.deleted_at)
  const daysPassed = Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysPassed > 30) {
    throw new ApiError('restoreExpired', '已超过 30 天恢复期限，无法恢复')
  }

  db.prepare("UPDATE articles SET status = 'published', deleted_at = NULL WHERE id = ?").run(id)
  restoreFromRecycle(article.slug)

  const tags = JSON.parse(article.tags || '[]')
  for (const t of tags) {
    db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(t)
  }

  res.json({ success: true })
})

router.delete('/:id/permanent', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const article = db.prepare('SELECT * FROM articles WHERE id = ? AND status = ?').get(id, 'deleted')
  if (!article) throw new ApiError('notFound', '文章不存在', 404)

  deleteFromRecycle(article.slug)

  db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(id)
  db.prepare('DELETE FROM comments WHERE article_id = ?').run(id)
  db.prepare('DELETE FROM articles WHERE id = ?').run(id)

  db.prepare('INSERT INTO admin_logs (admin_id, action, result) VALUES (?, ?, ?)').run(
    req.user.id, 'permanent_delete', `article ${article.slug} permanently deleted`
  )

  res.json({ success: true })
})

export default router
