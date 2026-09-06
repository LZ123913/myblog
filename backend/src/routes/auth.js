import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../../database/scripts/init.js'
import { config } from '../config/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'

const router = Router()

router.post('/register', (req, res) => {
  const { email, nickname, password, confirmPassword } = req.body

  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new ApiError('emailInvalid', '邮箱格式不合法')
  }
  if (!password || password.length < 6 || password.length > 20) {
    throw new ApiError('passwordLength', '密码长度需为 6-20 位')
  }
  if (password !== confirmPassword) {
    throw new ApiError('passwordMismatch', '两次密码不一致')
  }
  if (!nickname || nickname.trim().length === 0) {
    throw new ApiError('nicknameRequired', '昵称不能为空')
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    throw new ApiError('emailExists', '该邮箱已注册')
  }

  const hashedPassword = bcrypt.hashSync(password, 10)
  const result = db.prepare(`
    INSERT INTO users (email, nickname, password, role, status)
    VALUES (?, ?, ?, 'reader', 'active')
  `).run(email, nickname.trim(), hashedPassword)

  const user = db.prepare('SELECT id, email, nickname, role, status, avatar FROM users WHERE id = ?').get(result.lastInsertRowid)

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

  res.json({
    token,
    user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role, avatar: user.avatar }
  })
})

router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new ApiError('loginFailed', '邮箱或密码错误')
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) {
    throw new ApiError('loginFailed', '邮箱或密码错误')
  }
  if (user.status === 'disabled') {
    throw new ApiError('accountDisabled', '账号已被禁用')
  }

  const valid = bcrypt.compareSync(password, user.password)
  if (!valid) {
    throw new ApiError('loginFailed', '邮箱或密码错误')
  }

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id)

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })

  res.json({
    token,
    user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role, avatar: user.avatar }
  })
})

router.get('/me', authMiddleware, (req, res) => {
  const user = req.user
  const likedPosts = JSON.parse(user.liked_posts || '[]')
  const bookmarks = JSON.parse(user.bookmarks || '[]')
  res.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    avatar: user.avatar,
    likedPosts,
    bookmarks
  })
})

router.post('/logout', (req, res) => {
  res.json({ success: true })
})

export default router
