import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { polishContent, recommendTags } from '../services/aiService.js'
import { writeArticleFile, generateSlug, getDraftPath } from '../services/fileService.js'
import { sendArticleNotifications } from '../services/emailService.js'
import fs from 'node:fs'

const router = Router()

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const { status, sort = 'updated', q } = req.query
  let query = `SELECT d.*, c.name as category_name FROM drafts d
    LEFT JOIN categories c ON d.category_id = c.id WHERE 1=1`
  const params = []

  if (status) {
    query += ' AND d.status = ?'
    params.push(status)
  }
  if (q) {
    query += ' AND d.title LIKE ?'
    params.push(`%${q}%`)
  }
  if (sort === 'created') {
    query += ' ORDER BY d.created_at DESC'
  } else {
    query += ' ORDER BY d.updated_at DESC'
  }

  const items = db.prepare(query).all(...params)
  res.json({
    items: items.map(d => ({
      ...d,
      tags: JSON.parse(d.tags || '[]'),
      images: JSON.parse(d.images || '[]')
    }))
  })
})

router.get('/:id', authMiddleware, requireAdmin, (req, res) => {
  const draft = db.prepare(`
    SELECT d.*, c.name as category_name FROM drafts d
    LEFT JOIN categories c ON d.category_id = c.id WHERE d.id = ?
  `).get(req.params.id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)

  res.json({
    ...draft,
    tags: JSON.parse(draft.tags || '[]'),
    images: JSON.parse(draft.images || '[]')
  })
})

router.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { title, rawContent, status = 'imported' } = req.body
  const result = db.prepare(`
    INSERT INTO drafts (title, raw_content, status)
    VALUES (?, ?, ?)
  `).run(title || '', rawContent || '', status)

  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(result.lastInsertRowid)
  res.json(draft)
})

router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)

  const { title, rawContent, polishedContent, tags, categoryId, status, images } = req.body
  const updates = []
  const params = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (rawContent !== undefined) { updates.push('raw_content = ?'); params.push(rawContent) }
  if (polishedContent !== undefined) { updates.push('polished_content = ?'); params.push(polishedContent) }
  if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)) }
  if (categoryId !== undefined) { updates.push('category_id = ?'); params.push(categoryId) }
  if (status !== undefined) { updates.push('status = ?'); params.push(status) }
  if (images !== undefined) { updates.push('images = ?'); params.push(JSON.stringify(images)) }

  updates.push("updated_at = datetime('now')")
  params.push(id)

  db.prepare(`UPDATE drafts SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updated = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  res.json({
    ...updated,
    tags: JSON.parse(updated.tags || '[]'),
    images: JSON.parse(updated.images || '[]')
  })
})

router.post('/:id/polish', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)

  const contentToPolish = draft.raw_content || ''
  const polished = await polishContent(contentToPolish)

  db.prepare('UPDATE drafts SET polished_content = ?, updated_at = datetime(\'now\') WHERE id = ?').run(polished, id)
  db.prepare('INSERT INTO polish_records (draft_id, original_content, polished_content) VALUES (?, ?, ?)').run(id, contentToPolish, polished)

  res.json({ polishedContent: polished })
}))

router.post('/:id/recommend-tags', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)

  const content = draft.polished_content || draft.raw_content || ''
  const existingTags = db.prepare('SELECT name FROM tags').all().map(t => t.name)
  const recommended = await recommendTags(content, existingTags)

  res.json({ tags: recommended })
}))

router.post('/:id/publish', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)
  if (draft.status !== 'tagged') throw new ApiError('draftNotReady', '草稿未完成标签阶段')

  const { title, content, tags, categoryId } = req.body
  if (!title || !title.trim()) throw new ApiError('titleRequired', '标题不能为空')
  if (!content || !content.trim()) throw new ApiError('contentRequired', '正文不能为空')
  if (!categoryId) throw new ApiError('categoryRequired', '分类不能为空')

  const slug = generateSlug(title)
  const author = db.prepare('SELECT id FROM authors WHERE user_id = ?').get(req.user.id)

  const result = db.prepare(`
    INSERT INTO articles (slug, title, content, summary, author_id, category_id, status, tags, published_at)
    VALUES (?, ?, ?, '', ?, ?, 'published', ?, datetime('now'))
  `).run(slug, title.trim(), content, author?.id || null, categoryId, JSON.stringify(tags || []))

  writeArticleFile(slug, content)

  for (const tag of (tags || [])) {
    db.prepare('INSERT OR IGNORE INTO tags (name, usage_count) VALUES (?, 0)').run(tag)
    db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(tag)
  }

  db.prepare('UPDATE drafts SET status = ? WHERE id = ?').run('published', id)

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid)
  sendArticleNotifications(article).catch(err => console.error('[Email] Notification failed:', err.message))

  res.json({ success: true, slug, articleId: result.lastInsertRowid })
})

router.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)

  db.prepare('DELETE FROM drafts WHERE id = ?').run(id)
  db.prepare('DELETE FROM polish_records WHERE draft_id = ?').run(id)

  const draftFile = getDraftPath(id)
  if (fs.existsSync(draftFile)) fs.unlinkSync(draftFile)

  res.json({ success: true })
})

router.post('/:id/copy', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  if (!draft) throw new ApiError('draftNotFound', '草稿不存在', 404)

  const result = db.prepare(`
    INSERT INTO drafts (title, raw_content, polished_content, tags, category_id, images, status)
    VALUES (?, ?, ?, ?, ?, ?, 'imported')
  `).run(
    draft.title + ' (副本)',
    draft.raw_content,
    draft.polished_content,
    draft.tags,
    draft.category_id,
    draft.images,
  )

  res.json({ id: result.lastInsertRowid })
})

export default router
