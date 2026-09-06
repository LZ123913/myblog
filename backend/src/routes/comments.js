import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../../../database/scripts/init.js'
import { config } from '../config/index.js'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { moderateComment } from '../services/aiService.js'

const router = Router()

function generateCaptcha() {
  const a = Math.floor(Math.random() * 5) + 1
  const b = Math.floor(Math.random() * 5) + 1
  const answer = a + b
  const token = jwt.sign({ answer, exp: Math.floor(Date.now() / 1000) + 600 }, config.jwtSecret)
  return { question: `${a}+${b}=?`, token }
}

router.get('/captcha', (req, res) => {
  const captcha = generateCaptcha()
  res.json(captcha)
})

router.get('/article/:articleId', (req, res) => {
  const { articleId } = req.params
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const offset = (page - 1) * pageSize

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM comments
    WHERE article_id = ? AND is_valid = 1 AND is_deleted = 0 AND parent_id IS NULL
  `).get(articleId)

  const topLevel = db.prepare(`
    SELECT c.*, u.nickname, u.avatar
    FROM comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.article_id = ? AND c.is_valid = 1 AND c.is_deleted = 0 AND c.parent_id IS NULL
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(articleId, pageSize, offset)

  const items = topLevel.map(c => {
    const replies = db.prepare(`
      SELECT c.*, u.nickname, u.avatar
      FROM comments c LEFT JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ? AND c.is_valid = 1 AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).all(c.id)
    return { ...c, replies }
  })

  res.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  })
})

router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { articleId, content, parentId, captchaToken, captchaAnswer } = req.body

  if (!content || content.trim().length < 5) {
    throw new ApiError('commentTooShort', '评论内容至少 5 个字符')
  }

  if (!captchaToken || captchaAnswer === undefined || captchaAnswer === null) {
    throw new ApiError('captchaRequired', '请完成真人验证')
  }

  let expectedAnswer
  try {
    const decoded = jwt.verify(captchaToken, config.jwtSecret)
    expectedAnswer = decoded.answer
  } catch {
    throw new ApiError('captchaWrong', '真人验证答案错误，请重新作答')
  }

  if (String(captchaAnswer) !== String(expectedAnswer)) {
    throw new ApiError('captchaWrong', '真人验证答案错误，请重新作答')
  }

  const article = db.prepare('SELECT id FROM articles WHERE id = ? AND status = ?').get(articleId, 'published')
  if (!article) throw new ApiError('articleNotFound', '文章不存在')

  const isValid = await moderateComment(content)

  if (!isValid) {
    throw new ApiError('commentRejected', '评论内容疑似广告或灌水，已被拦截')
  }

  const result = db.prepare(`
    INSERT INTO comments (article_id, user_id, content, parent_id, is_valid)
    VALUES (?, ?, ?, ?, 1)
  `).run(articleId, req.user.id, content.trim(), parentId || null)

  const comment = db.prepare(`
    SELECT c.*, u.nickname, u.avatar FROM comments c
    LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(result.lastInsertRowid)

  res.json(comment)
}))

router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id)
  if (!comment) throw new ApiError('commentNotFound', '评论不存在', 404)

  const isOwner = comment.user_id === req.user.id
  const isAdmin = req.user.role === 'admin'
  if (!isOwner && !isAdmin) {
    throw new ApiError('forbidden', '无权删除此评论', 403)
  }

  db.prepare('UPDATE comments SET is_deleted = 1 WHERE id = ?').run(id)
  db.prepare('UPDATE comments SET is_deleted = 1 WHERE parent_id = ?').run(id)

  res.json({ success: true })
})

export default router
