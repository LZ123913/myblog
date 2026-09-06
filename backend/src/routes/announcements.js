import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'

const router = Router()

router.get('/latest', (req, res) => {
  const item = db.prepare(`
    SELECT * FROM announcements WHERE is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `).get()
  res.json(item || null)
})

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const items = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all()
  res.json({ items })
})

router.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { title, content } = req.body
  db.prepare('UPDATE announcements SET is_active = 0').run()
  const result = db.prepare('INSERT INTO announcements (title, content, is_active) VALUES (?, ?, 1)').run(title, content)
  res.json({ id: result.lastInsertRowid })
})

export default router
