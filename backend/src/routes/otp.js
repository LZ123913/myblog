import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../../database/scripts/init.js'
import { config } from '../config/index.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendOtpEmail } from '../services/emailService.js'

const router = Router()

// SQLite datetime('now') returns a UTC timestamp without an explicit timezone.
const parseSqliteUtc = (value) => new Date(`${String(value).replace(' ', 'T')}Z`)

router.post('/send', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new ApiError('emailInvalid', '邮箱格式不合法')
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) throw new ApiError('loginFailed', '邮箱或验证码错误')
  if (user.status === 'disabled') throw new ApiError('accountDisabled', '账号已被禁用')

  const todayCount = db.prepare(`
    SELECT COUNT(*) as count FROM otp_codes
    WHERE email = ? AND date(created_at) = date('now')
  `).get(email)
  if (todayCount.count >= 5) {
    throw new ApiError('otpLimitExceeded', '今日发送次数已达上限')
  }

  const lastSent = db.prepare(`
    SELECT created_at FROM otp_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1
  `).get(email)
  if (lastSent) {
    const elapsed = Date.now() - parseSqliteUtc(lastSent.created_at).getTime()
    if (elapsed < 60000) {
      throw new ApiError('otpCooldown', '请稍后再试', 429)
    }
  }

  const code = String(crypto.randomInt(100000, 1000000))
  const codeHash = bcrypt.hashSync(code, 10)

  const result = await sendOtpEmail(email, code)
  if (!result.success && !config.devShowOtp) {
    throw new ApiError('emailSendFailed', '验证码邮件发送失败，请检查邮件服务配置', 503)
  }

  db.prepare('UPDATE otp_codes SET used = 1 WHERE email = ? AND used = 0').run(email)
  db.prepare(`
    INSERT INTO otp_codes (email, code_hash, expires_at)
    VALUES (?, ?, datetime('now', '+10 minutes'))
  `).run(email, codeHash)

  res.json({
    success: true,
    cooldown: 60,
    emailSent: result.success,
    ...(config.devShowOtp && !result.success ? { developmentCode: code } : {})
  })
}))

router.post('/verify', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const code = String(req.body.code || '').trim()
  if (!email || !code) throw new ApiError('loginFailed', '邮箱或验证码错误')
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || !/^\d{6}$/.test(code)) {
    throw new ApiError('loginFailed', '邮箱或验证码错误')
  }

  const record = db.prepare(`
    SELECT * FROM otp_codes
    WHERE email = ? AND used = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(email)

  if (!record) throw new ApiError('loginFailed', '邮箱或验证码错误')

  const expires = parseSqliteUtc(record.expires_at)
  if (expires < new Date()) {
    throw new ApiError('loginFailed', '验证码已过期')
  }

  const valid = bcrypt.compareSync(code, record.code_hash)
  if (!valid) throw new ApiError('loginFailed', '邮箱或验证码错误')

  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(record.id)

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || user.status === 'disabled') throw new ApiError('loginFailed', '邮箱或验证码错误')

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id)

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

  res.json({
    token,
    user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role, avatar: user.avatar }
  })
})

export default router
