import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { config } from '../config/index.js'

const router = Router()

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const items = db.prepare('SELECT * FROM email_templates ORDER BY updated_at DESC').all()
  res.json({ items })
})

router.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { name, subject, htmlBody, textBody, status = 'disabled' } = req.body
  if (!name || !subject) throw new ApiError('invalidInput', '名称和主题不能为空')

  if (status === 'enabled') {
    db.prepare("UPDATE email_templates SET status = 'disabled'").run()
  }

  const result = db.prepare(`
    INSERT INTO email_templates (name, subject, html_body, text_body, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, subject, htmlBody || '', textBody || '', status, req.user.id)

  res.json({ id: result.lastInsertRowid })
})

router.put('/:id', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const { name, subject, htmlBody, textBody, status } = req.body

  const tpl = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id)
  if (!tpl) throw new ApiError('notFound', '模板不存在', 404)

  if (status === 'enabled') {
    db.prepare("UPDATE email_templates SET status = 'disabled'").run()
  }

  db.prepare(`
    UPDATE email_templates SET name = ?, subject = ?, html_body = ?, text_body = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name || tpl.name, subject || tpl.subject,
    htmlBody !== undefined ? htmlBody : tpl.html_body,
    textBody !== undefined ? textBody : tpl.text_body,
    status || tpl.status, id
  )

  res.json({ success: true })
})

router.get('/:id/preview', authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params
  const tpl = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id)
  if (!tpl) throw new ApiError('notFound', '模板不存在', 404)

  const testData = {
    '{{articleTitle}}': '测试文章标题',
    '{{articleSummary}}': '这是一段测试文章摘要内容。',
    '{{articleUrl}}': `${config.clientUrl}/#/article/test-article`,
    '{{authorName}}': '测试作者',
    '{{unsubscribeUrl}}': `${config.clientUrl}/#/subscription-unsubscribe?email=test@example.com`
  }

  let html = tpl.html_body
  let text = tpl.text_body
  let subject = tpl.subject
  for (const [key, val] of Object.entries(testData)) {
    html = html.replaceAll(key, val)
    text = text.replaceAll(key, val)
    subject = subject.replaceAll(key, val)
  }

  res.json({ subject, html, text })
})

router.post('/:id/resend', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params
  const logs = db.prepare(`
    SELECT esl.*, s.email, a.slug, a.title, a.summary
    FROM email_send_logs esl
    JOIN subscriptions s ON esl.subscription_id = s.id
    JOIN articles a ON esl.article_id = a.id
    WHERE esl.status = 'failed' AND esl.template_id = ?
  `).all(id)

  const { sendArticleNotification } = await import('../services/emailService.js')
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id)

  let resent = 0
  let failed = 0
  for (const log of logs) {
    const sub = { id: log.subscription_id, email: log.email }
    const article = { id: log.article_id, slug: log.slug, title: log.title, summary: log.summary }
    const result = await sendArticleNotification(sub, article, template)
    if (result.success) {
      db.prepare('UPDATE email_send_logs SET status = ?, error_message = ? WHERE id = ?').run('sent', '', log.id)
      resent++
    } else {
      failed++
    }
  }

  res.json({ resent, failed })
}))

export default router
