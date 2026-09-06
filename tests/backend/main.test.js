import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert'
import { initDatabase, db } from '../../database/scripts/init.js'
import { seedDatabase } from '../../database/scripts/seed.js'

before(() => {
  initDatabase()
  seedDatabase()
})

describe('Auth', () => {
  it('should login with correct credentials', async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shiguang.blog', password: 'admin123' })
    })
    const data = await res.json()
    assert.ok(res.ok)
    assert.strictEqual(data.user.role, 'admin')
    assert.ok(data.token)
  })

  it('should fail with wrong password', async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shiguang.blog', password: 'wrong' })
    })
    const data = await res.json()
    assert.strictEqual(res.status, 400)
    assert.strictEqual(data.error, 'loginFailed')
  })

  it('should register a new reader', async () => {
    const uniqueEmail = `reader_${Date.now()}@test.com`
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        nickname: '测试读者',
        password: 'test123',
        confirmPassword: 'test123'
      })
    })
    const data = await res.json()
    assert.ok(res.ok)
    assert.strictEqual(data.user.role, 'reader')
    assert.ok(data.token)
  })

  it('should reject duplicate email', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@shiguang.blog',
        nickname: '重复',
        password: 'test123',
        confirmPassword: 'test123'
      })
    })
    const data = await res.json()
    assert.strictEqual(res.status, 400)
    assert.strictEqual(data.error, 'emailExists')
  })

  it('should reject short password', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'short@test.com',
        nickname: '短密码',
        password: '12',
        confirmPassword: '12'
      })
    })
    const data = await res.json()
    assert.strictEqual(data.error, 'passwordLength')
  })
})

describe('Articles', () => {
  it('should list published articles', async () => {
    const res = await fetch('http://localhost:3000/api/articles?page=1&pageSize=10')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.items.length > 0)
    assert.ok(data.total > 0)
  })

  it('should get article by slug', async () => {
    const res = await fetch('http://localhost:3000/api/articles/welcome-to-shiguang')
    const data = await res.json()
    assert.ok(res.ok)
    assert.strictEqual(data.slug, 'welcome-to-shiguang')
    assert.ok(data.content)
  })

  it('should not find deleted article', async () => {
    const res = await fetch('http://localhost:3000/api/articles/non-existent-slug')
    assert.strictEqual(res.status, 404)
  })
})

describe('Tags & Categories', () => {
  it('should list tags', async () => {
    const res = await fetch('http://localhost:3000/api/tags')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.items.length > 0)
  })

  it('should list categories', async () => {
    const res = await fetch('http://localhost:3000/api/categories')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.items.length > 0)
  })

  it('should get timeline', async () => {
    const res = await fetch('http://localhost:3000/api/articles/archive/timeline')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.groups.length > 0)
  })
})

describe('Announcements', () => {
  it('should get latest announcement', async () => {
    const res = await fetch('http://localhost:3000/api/announcements/latest')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data)
    assert.ok(data.title)
  })
})

describe('Search', () => {
  it('should search with valid query', async () => {
    const res = await fetch('http://localhost:3000/api/search?q=拾光集')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.items.length > 0)
  })

  it('should reject short query', async () => {
    const res = await fetch('http://localhost:3000/api/search?q=a')
    assert.strictEqual(res.status, 400)
  })
})

describe('Subscriptions', () => {
  it('should reject invalid email', async () => {
    const res = await fetch('http://localhost:3000/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid' })
    })
    const data = await res.json()
    assert.strictEqual(data.error, 'emailInvalid')
  })
})

describe('Comments', () => {
  it('should get captcha', async () => {
    const res = await fetch('http://localhost:3000/api/comments/captcha')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.question)
    assert.ok(data.token)
  })

  it('should reject unauthenticated comment', async () => {
    const res = await fetch('http://localhost:3000/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: 1, content: 'test comment', captchaToken: 'x', captchaAnswer: 1 })
    })
    assert.strictEqual(res.status, 401)
  })
})

describe('Permissions', () => {
  let readerToken, adminToken

  before(async () => {
    const readerEmail = `perm_reader_${Date.now()}@test.com`
    await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: readerEmail, nickname: '权限测试读者', password: 'test123', confirmPassword: 'test123' })
    })
    const readerRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: readerEmail, password: 'test123' })
    })
    const readerData = await readerRes.json()
    readerToken = readerData.token

    const adminRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shiguang.blog', password: 'admin123' })
    })
    const adminData = await adminRes.json()
    adminToken = adminData.token
  })

  it('should reject reader from admin endpoints', async () => {
    const res = await fetch('http://localhost:3000/api/articles/admin/list', {
      headers: { 'Authorization': `Bearer ${readerToken}` }
    })
    assert.strictEqual(res.status, 403)
  })

  it('should allow admin to access admin endpoints', async () => {
    const res = await fetch('http://localhost:3000/api/articles/admin/list', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    })
    assert.ok(res.ok)
  })

  it('should reject unauthenticated access to admin endpoints', async () => {
    const res = await fetch('http://localhost:3000/api/articles/admin/list')
    assert.strictEqual(res.status, 401)
  })
})

describe('Projects & Authors', () => {
  it('should get author info', async () => {
    const res = await fetch('http://localhost:3000/api/authors')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data)
    assert.ok(data.name)
  })

  it('should get projects', async () => {
    const res = await fetch('http://localhost:3000/api/projects')
    const data = await res.json()
    assert.ok(res.ok)
    assert.ok(data.items.length > 0)
  })
})
