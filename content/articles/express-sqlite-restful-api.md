# 使用 Express + SQLite 构建 RESTful API

## 为什么选择 SQLite

对于个人博客和小型项目，SQLite 是最理想的选择：零配置、无服务端、性能足够。

## 项目搭建

### 安装依赖

```bash
npm install express better-sqlite3 cors
```

### 数据库初始化

```javascript
import Database from 'better-sqlite3'

const db = new Database('blog.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    status TEXT DEFAULT 'draft',
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
```)

### 路由设计

```javascript
import { Router } from 'express'

const router = Router()

router.get('/articles', (req, res) => {
  const items = db.prepare('SELECT * FROM articles WHERE status = ? ORDER BY published_at DESC').all('published')
  res.json({ items })
})

router.get('/articles/:slug', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE slug = ?').get(req.params.slug)
  if (!article) return res.status(404).json({ error: 'notFound' })
  res.json(article)
})

export default router
```

## 中间件设计

### JWT 认证

```javascript
import jwt from 'jsonwebtoken'

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'loginRequired' })
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'tokenExpired' })
  }
}
```

### 错误处理

```javascript
export class ApiError extends Error {
  constructor(code, message, statusCode = 400, retryable = false) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.retryable = retryable
  }
}

app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message })
  } else {
    res.status(500).json({ error: 'internalError', message: '服务器内部错误' })
  }
})
```

## 总结

Express + SQLite 组合非常适合中小型项目的快速开发，配合 JWT 认证和统一的错误处理，可以构建出结构清晰、易于维护的后端服务。