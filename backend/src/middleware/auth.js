import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { db } from '../../../database/scripts/init.js'

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'loginRequired', message: '请先登录' })
  }
  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    const user = db.prepare('SELECT id, email, nickname, role, status, avatar FROM users WHERE id = ?').get(decoded.userId)
    if (!user) return res.status(401).json({ error: 'loginRequired', message: '用户不存在' })
    if (user.status === 'disabled') return res.status(403).json({ error: 'accountDisabled', message: '账号已被禁用' })
    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'tokenExpired', message: '登录已过期，请重新登录' })
    }
    return res.status(401).json({ error: 'tokenInvalid', message: '登录态无效，请重新登录' })
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), config.jwtSecret)
      const user = db.prepare('SELECT id, email, nickname, role, status, avatar FROM users WHERE id = ?').get(decoded.userId)
      if (user && user.status === 'active') req.user = user
    } catch {}
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'loginRequired', message: '请先登录' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: '无权限操作' })
  next()
}
