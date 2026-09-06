import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../../../database/scripts/init.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendVerificationEmail } from '../services/emailService.js'

const router = Router()

router.post('/', asyncHandler(async (req, res) => {
  const { email } = req.body
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new ApiError('emailInvalid', '邮箱格式不合法')
  }

  const existing = db.prepare('SELECT * FROM subscriptions WHERE email = ?').get(email)

  if (existing && existing.is_verified) {
    return res.json({ status: 'already_subscribed', message: '您已订阅' })
  }

  if (existing && !existing.is_verified) {
    const token = crypto.randomUUID()
    db.prepare('UPDATE subscriptions SET verify_token = ? WHERE id = ?').run(token, existing.id)
    const result = await sendVerificationEmail(email, token)
    return res.json({ status: 'resent', message: '验证邮件已重新发送', emailSent: result.success })
  }

  const token = crypto.randomUUID()
  db.prepare('INSERT INTO subscriptions (email, verify_token) VALUES (?, ?)').run(email, token)
  const result = await sendVerificationEmail(email, token)

  res.json({ status: 'created', message: '订阅成功，请查收验证邮件', emailSent: result.success })
}))

router.get('/verify', (req, res) => {
  const { token } = req.query
  const sub = db.prepare('SELECT * FROM subscriptions WHERE verify_token = ?').get(token)
  if (!sub) throw new ApiError('tokenInvalid', '验证链接无效')

  db.prepare('UPDATE subscriptions SET is_verified = 1, verify_token = NULL WHERE id = ?').run(sub.id)
  res.json({ success: true, message: '邮箱验证成功' })
})

router.post('/unsubscribe', (req, res) => {
  const { email } = req.body
  db.prepare('DELETE FROM subscriptions WHERE email = ?').run(email)
  res.json({ success: true, message: '已退订' })
})

router.get('/resend', asyncHandler(async (req, res) => {
  const { email } = req.query
  const sub = db.prepare('SELECT * FROM subscriptions WHERE email = ?').get(email)
  if (!sub) throw new ApiError('notFound', '邮箱未订阅')
  if (sub.is_verified) throw new ApiError('alreadyVerified', '邮箱已验证')

  const token = crypto.randomUUID()
  db.prepare('UPDATE subscriptions SET verify_token = ? WHERE id = ?').run(token, sub.id)
  const result = await sendVerificationEmail(email, token)
  res.json({ success: true, emailSent: result.success })
}))

export default router
