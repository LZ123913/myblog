import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'

const router = Router()

// 获取所有站点设置（公开）
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT setting_key, setting_value FROM site_settings').all()
    const settings = {}
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value
    }
    // 解析 JSON 格式的设置
    if (settings.mottos) {
      try { settings.mottos = JSON.parse(settings.mottos) } catch (e) { settings.mottos = [] }
    }
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取随机座右铭（公开）
router.get('/random-motto', (req, res) => {
  try {
    const row = db.prepare("SELECT setting_value FROM site_settings WHERE setting_key = 'mottos'").get()
    let mottos = []
    if (row?.setting_value) {
      try { mottos = JSON.parse(row.setting_value) } catch (e) { mottos = [] }
    }
    if (mottos.length === 0) {
      res.json({ motto: '记录每一束思想的光' })
      return
    }
    const randomMotto = mottos[Math.floor(Math.random() * mottos.length)]
    res.json({ motto: randomMotto })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新站点设置（管理员）
router.put('/', authMiddleware, requireAdmin, (req, res) => {
  try {
    const updates = req.body
    const stmt = db.prepare(`
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = datetime('now')
    `)

    for (const [key, value] of Object.entries(updates)) {
      // 数组类型转 JSON
      if (Array.isArray(value)) {
        stmt.run(key, JSON.stringify(value))
      } else {
        stmt.run(key, String(value || ''))
      }
    }

    // 返回更新后的所有设置
    const rows = db.prepare('SELECT setting_key, setting_value FROM site_settings').all()
    const settings = {}
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value
    }
    if (settings.mottos) {
      try { settings.mottos = JSON.parse(settings.mottos) } catch (e) { settings.mottos = [] }
    }
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
