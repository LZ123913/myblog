import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../../database/scripts/init.js'
import { config } from '../config/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendResetEmail } from '../services/emailService.js'

const router = Router()

router.post('/forgot', asyncHandler(async (req, res) => {
  const { email } = req.body
  if (!email) throw new ApiError('emailRequired', '请输入邮箱')

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

  if (!user) {
    return res.json({ success: true, message: '如果该邮箱已注册，您将收到重置邮件' })
  }

  const token = crypto.randomUUID()
  db.prepare(`
    UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 day') WHERE id = ?
  `).run(token, user.id)

  await sendResetEmail(email, token)

  res.json({ success: true, message: '如果该邮箱已注册，您将收到重置邮件' })
}))

router.post('/reset', (req, res) => {
  const { token, newPassword, confirmPassword } = req.body

  if (!token) throw new ApiError('tokenRequired', '重置令牌无效')
  if (!newPassword || newPassword.length < 6 || newPassword.length > 20) {
    throw new ApiError('passwordLength', '密码长度需为 6-20 位')
  }
  if (newPassword !== confirmPassword) {
    throw new ApiError('passwordMismatch', '两次密码不一致')
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')
  `).get(token)

  if (!user) throw new ApiError('tokenInvalid', '重置链接无效或已过期')

  const hashedPassword = bcrypt.hashSync(newPassword, 10)
  db.prepare(`
    UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?
  `).run(hashedPassword, user.id)

  res.json({ success: true, message: '密码重置成功，请重新登录' })
})

router.post('/change', authMiddleware, (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body

  if (!oldPassword || !newPassword || !confirmPassword) {
    throw new ApiError('fieldsRequired', '请填写所有字段')
  }
  if (newPassword.length < 6 || newPassword.length > 20) {
    throw new ApiError('passwordLength', '密码长度需为 6-20 位')
  }
  if (newPassword !== confirmPassword) {
    throw new ApiError('passwordMismatch', '两次密码不一致')
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  const valid = bcrypt.compareSync(oldPassword, user.password)
  if (!valid) throw new ApiError('oldPasswordWrong', '旧密码错误')

  const hashedPassword = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id)

  res.json({ success: true, message: '密码修改成功' })
})

export default router
