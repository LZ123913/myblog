import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/', (req, res) => {
  const author = db.prepare('SELECT * FROM authors ORDER BY id LIMIT 1').get()
  if (!author) return res.json(null)
  res.json(author)
})

router.get('/:id', (req, res) => {
  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(req.params.id)
  if (!author) return res.status(404).json({ error: 'notFound' })
  res.json(author)
})

// 更新作者信息（仅管理员）：后台「关于我」编辑入口
const UPDATABLE_FIELDS = ['name', 'avatar', 'motto', 'bio']

router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(req.params.id)
  if (!author) return res.status(404).json({ error: 'notFound' })

  const fields = UPDATABLE_FIELDS.filter(key => req.body[key] !== undefined)
  if (fields.length === 0) return res.json(author)

  const setClause = fields.map(key => `${key} = ?`).join(', ')
  const values = fields.map(key => String(req.body[key] ?? ''))
  db.prepare(`UPDATE authors SET ${setClause} WHERE id = ?`).run(...values, author.id)

  res.json(db.prepare('SELECT * FROM authors WHERE id = ?').get(author.id))
})

export default router
