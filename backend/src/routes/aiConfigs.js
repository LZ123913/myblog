import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { testAiConnection } from '../services/aiService.js'

const router = Router()

router.get('/', authMiddleware, requireAdmin, (req, res) => {
  const items = db.prepare('SELECT * FROM ai_configs WHERE enabled = 1 ORDER BY scenario, version DESC').all()
  const configs = {}
  for (const item of items) {
    if (!configs[item.scenario]) {
      configs[item.scenario] = {
        scenario: item.scenario,
        provider: item.provider,
        model: item.model,
        apiUrl: item.api_url,
        apiKeyEncrypted: item.api_key_encrypted ? '***' : '',
        timeoutMs: item.timeout_ms,
        systemPrompt: item.system_prompt,
        enabled: item.enabled === 1,
        version: item.version,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }
    }
  }
  res.json({ configs })
})

router.put('/:scenario', authMiddleware, requireAdmin, (req, res) => {
  const { scenario } = req.params
  const { provider, model, apiUrl, timeoutMs, systemPrompt, enabled, apiKey } = req.body

  const existing = db.prepare('SELECT * FROM ai_configs WHERE scenario = ? ORDER BY version DESC LIMIT 1').get(scenario)

  if (existing) {
    const newVersion = existing.version + 1
    db.prepare(`
      INSERT INTO ai_configs (scenario, provider, model, api_url, api_key_encrypted, timeout_ms, system_prompt, enabled, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scenario,
      provider || existing.provider,
      model || existing.model,
      apiUrl !== undefined ? apiUrl : existing.api_url,
      apiKey !== undefined ? (apiKey || '') : existing.api_key_encrypted,
      timeoutMs || existing.timeout_ms,
      systemPrompt !== undefined ? systemPrompt : existing.system_prompt,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      newVersion
    )

    db.prepare('UPDATE ai_configs SET enabled = 0 WHERE scenario = ? AND version < ?').run(scenario, newVersion)

    res.json({ success: true, version: newVersion })
  } else {
    db.prepare(`
      INSERT INTO ai_configs (scenario, provider, model, api_url, api_key_encrypted, timeout_ms, system_prompt, enabled, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scenario,
      provider || 'qwen',
      model || 'qwen-plus',
      apiUrl || '',
      apiKey || '',
      timeoutMs || 30000,
      systemPrompt || '',
      enabled !== undefined ? (enabled ? 1 : 0) : 1,
      1
    )

    res.json({ success: true, version: 1 })
  }
})

router.get('/:scenario/history', authMiddleware, requireAdmin, (req, res) => {
  const { scenario } = req.params
  const versions = db.prepare('SELECT * FROM ai_configs WHERE scenario = ? ORDER BY version DESC').all(scenario)
  res.json({
    versions: versions.map(v => ({
      version: v.version,
      provider: v.provider,
      model: v.model,
      apiUrl: v.api_url,
      timeoutMs: v.timeout_ms,
      systemPrompt: v.system_prompt,
      enabled: v.enabled === 1,
      created_at: v.created_at,
      updated_at: v.updated_at
    }))
  })
})

router.post('/:scenario/rollback', authMiddleware, requireAdmin, (req, res) => {
  const { scenario } = req.params
  const versions = db.prepare('SELECT * FROM ai_configs WHERE scenario = ? ORDER BY version DESC').all(scenario)
  if (versions.length < 2) throw new ApiError('noVersionToRollback', '没有可回滚的版本')

  db.prepare('UPDATE ai_configs SET enabled = 0 WHERE scenario = ?').run(scenario)
  db.prepare('UPDATE ai_configs SET enabled = 1 WHERE scenario = ? AND version = ?').run(scenario, versions[1].version)

  res.json({ success: true, version: versions[1].version })
})

router.post('/:scenario/test', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { scenario } = req.params
  const { model, systemPrompt, userPrompt } = req.body

  const result = await testAiConnection(scenario, model, systemPrompt, userPrompt)
  res.json({ success: true, result })
}))

export default router
