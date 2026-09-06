import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const { email, nickname, role, status } = req.query
  let query = `SELECT id, email, nickname, role, status, created_at, last_login_at FROM users WHERE 1=1`
  const params = []

  if (email) { query += ' AND email LIKE ?'; params.push(`%${email}%`) }
  if (nickname) { query += ' AND nickname LIKE ?'; params.push(`%${nickname}%`) }
  if (role) { query += ' AND role = ?'; params.push(role) }
  if (status) { query += ' AND status = ?'; params.push(status) }

  query += ' ORDER BY created_at DESC'
  const items = db.prepare(query).all(...params)
  res.json({ items })
})

router.get('/:id', authMiddleware, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id, email, nickname, role, status, created_at, last_login_at FROM users WHERE id = ?').get(req.params.id)
  if (!user) throw new ApiError('notFound', '用户不存在', 404)
  res.json(user)
})

router.put('/:id/role', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const { role } = req.body

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) throw new ApiError('notFound', '用户不存在', 404)

  if (role === 'reader') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'").get()
    if (adminCount.count <= 1 && user.role === 'admin') {
      throw new ApiError('lastAdmin', '不能降级最后一个管理员')
    }
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)

  db.prepare('INSERT INTO admin_logs (admin_id, target_user_id, action, result) VALUES (?, ?, ?, ?)').run(
    req.user.id, id, 'change_role', `role changed to ${role}`
  )

  res.json({ success: true })
})

router.put('/:id/status', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const { status } = req.body

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) throw new ApiError('notFound', '用户不存在', 404)

  if (status === 'disabled' && user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'").get()
    if (adminCount.count <= 1) {
      throw new ApiError('lastAdmin', '不能禁用最后一个管理员')
    }
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id)

  db.prepare('INSERT INTO admin_logs (admin_id, target_user_id, action, result) VALUES (?, ?, ?, ?)').run(
    req.user.id, id, 'change_status', `status changed to ${status}`
  )

  res.json({ success: true })
})

router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) throw new ApiError('notFound', '用户不存在', 404)

  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'").get()
    if (adminCount.count <= 1) {
      throw new ApiError('lastAdmin', '不能删除最后一个管理员')
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id)

  db.prepare('INSERT INTO admin_logs (admin_id, target_user_id, action, result) VALUES (?, ?, ?, ?)').run(
    req.user.id, id, 'delete_user', 'deleted'
  )

  res.json({ success: true })
})

router.get('/:id/bookmarks', authMiddleware, (req, res) => {
  const targetId = parseInt(req.params.id)
  if (req.user.id !== targetId && req.user.role !== 'admin') {
    throw new ApiError('forbidden', '无权查看他人收藏', 403)
  }
  const user = db.prepare('SELECT bookmarks FROM users WHERE id = ?').get(targetId)
  if (!user) throw new ApiError('notFound', '用户不存在', 404)
  const bookmarks = JSON.parse(user.bookmarks || '[]')
  const items = bookmarks.map(b => {
    const article = db.prepare('SELECT id, slug, title, summary, cover_image, published_at FROM articles WHERE slug = ?').get(b.slug)
    return article ? { ...article, privacy: b.privacy, bookmarked_at: b.added_at } : null
  }).filter(Boolean)
  res.json({ items })
})

router.delete('/:id/bookmarks/:slug', authMiddleware, (req, res) => {
  const { id, slug } = req.params
  const targetId = parseInt(id)
  if (req.user.id !== targetId && req.user.role !== 'admin') {
    throw new ApiError('forbidden', '无权操作他人收藏', 403)
  }
  const user = db.prepare('SELECT bookmarks FROM users WHERE id = ?').get(targetId)
  if (!user) throw new ApiError('notFound', '用户不存在', 404)

  const bookmarks = JSON.parse(user.bookmarks || '[]')
  const existing = bookmarks.find(b => b.slug === slug)
  const newBookmarks = bookmarks.filter(b => b.slug !== slug)

  db.prepare('UPDATE users SET bookmarks = ? WHERE id = ?').run(JSON.stringify(newBookmarks), targetId)

  if (existing && existing.privacy === 'public') {
    db.prepare('UPDATE articles SET bookmarks = MAX(0, bookmarks - 1) WHERE slug = ?').run(slug)
  }

  res.json({ success: true })
})

export default router
