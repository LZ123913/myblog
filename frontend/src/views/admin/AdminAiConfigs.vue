<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const configs = ref({})
const versionHistory = ref({})
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)
const formError = ref('')

const showEditModal = ref(false)
const showHistoryModal = ref(false)
const showTestModal = ref(false)
const activeScenario = ref('')

const form = reactive({
  scenario: '',
  provider: '',
  model: '',
  apiUrl: '',
  apiKey: '',
  timeoutMs: 30000,
  systemPrompt: '',
  enabled: true
})

const testForm = reactive({
  model: '',
  systemPrompt: '',
  userPrompt: ''
})
const testResult = ref('')
const testing = ref(false)

const scenarios = [
  { key: 'summary', label: '文章摘要' },
  { key: 'polish', label: '内容润色' },
  { key: 'tag', label: '标签推荐' },
  { key: 'comment', label: '评论回复' }
]

const groupedConfigs = computed(() => {
  const result = {}
  for (const scenario of scenarios) {
    result[scenario.key] = {
      label: scenario.label,
      config: configs.value[scenario.key] || null
    }
  }
  return result
})

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadConfigs()
})

async function loadConfigs() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/ai-configs')
    configs.value = data.configs || data || {}
  } catch (err) {
    error.value = err.message || 'AI 配置加载失败'
  } finally {
    loading.value = false
  }
}

function openEdit(scenario) {
  activeScenario.value = scenario
  const config = configs.value[scenario] || {}
  Object.assign(form, {
    scenario,
    provider: config.provider || '',
    model: config.model || '',
    apiUrl: config.apiUrl || '',
    apiKey: '',
    timeoutMs: config.timeoutMs || 30000,
    systemPrompt: config.systemPrompt || '',
    enabled: config.enabled !== false
  })
  formError.value = ''
  showEditModal.value = true
}

async function save() {
  formError.value = ''
  if (!form.provider.trim()) {
    formError.value = '服务商不能为空'
    return
  }
  if (!form.model.trim()) {
    formError.value = '模型名称不能为空'
    return
  }
  actionLoading.value = true
  try {
    const payload = {
      provider: form.provider.trim(),
      model: form.model.trim(),
      apiUrl: form.apiUrl || undefined,
      timeoutMs: form.timeoutMs,
      systemPrompt: form.systemPrompt,
      enabled: form.enabled
    }
    if (form.apiKey && form.apiKey !== '***') {
      payload.apiKey = form.apiKey
    }
    await api.put(`/ai-configs/${form.scenario}`, payload)
    showEditModal.value = false
    await loadConfigs()
  } catch (err) {
    formError.value = err.message || '保存失败'
  } finally {
    actionLoading.value = false
  }
}

function openTest(scenario) {
  activeScenario.value = scenario
  const config = configs.value[scenario] || {}
  Object.assign(testForm, {
    model: config.model || '',
    systemPrompt: config.systemPrompt || '',
    userPrompt: ''
  })
  testResult.value = ''
  showTestModal.value = true
}

async function runTest() {
  testing.value = true
  testResult.value = ''
  try {
    const data = await api.post(`/ai-configs/${activeScenario.value}/test`, {
      model: testForm.model,
      systemPrompt: testForm.systemPrompt,
      userPrompt: testForm.userPrompt
    })
    testResult.value = data.result || data.output || data.text || JSON.stringify(data)
  } catch (err) {
    testResult.value = `测试失败: ${err.message || '未知错误'}`
  } finally {
    testing.value = false
  }
}

async function rollback(scenario) {
  actionLoading.value = true
  try {
    await api.post(`/ai-configs/${scenario}/rollback`)
    await loadConfigs()
  } catch (err) {
    error.value = err.message || '回滚失败'
  } finally {
    actionLoading.value = false
  }
}

async function loadHistory(scenario) {
  activeScenario.value = scenario
  try {
    const data = await api.get(`/ai-configs/${scenario}/history`)
    versionHistory.value = { ...versionHistory.value, [scenario]: data.versions || data.items || [] }
  } catch (err) {
    versionHistory.value = { ...versionHistory.value, [scenario]: [] }
  }
  showHistoryModal.value = true
}

function scenarioLabel(key) {
  const s = scenarios.find(s => s.key === key)
  return s ? s.label : key
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-ai-configs">
    <div class="page-header">
      <h1 class="page-title">AI 配置管理</h1>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadConfigs">重试</button>
    </div>

    <template v-else>
      <div class="config-groups">
        <div v-for="scenario in scenarios" :key="scenario.key" class="config-card">
          <div class="config-card-header">
            <h3 class="config-title">{{ scenario.label }}</h3>
            <span
              v-if="groupedConfigs[scenario.key]?.config"
              :class="['enabled-badge', { enabled: groupedConfigs[scenario.key].config.enabled !== false, disabled: groupedConfigs[scenario.key].config.enabled === false }]"
            >
              {{ groupedConfigs[scenario.key].config.enabled !== false ? '已启用' : '已停用' }}
            </span>
          </div>

          <div v-if="groupedConfigs[scenario.key]?.config" class="config-body">
            <div class="config-row"><span class="config-label">服务商</span><span>{{ groupedConfigs[scenario.key].config.provider || '-' }}</span></div>
            <div class="config-row"><span class="config-label">模型</span><span>{{ groupedConfigs[scenario.key].config.model || '-' }}</span></div>
            <div class="config-row"><span class="config-label">API 地址</span><span>{{ groupedConfigs[scenario.key].config.apiUrl || '默认' }}</span></div>
            <div class="config-row"><span class="config-label">超时时间</span><span>{{ groupedConfigs[scenario.key].config.timeoutMs || 30000 }} ms</span></div>
            <div class="config-row"><span class="config-label">API Key</span><span class="api-key-masked">***</span></div>
          </div>

          <div v-else class="config-empty">尚未配置</div>

          <div class="config-actions">
            <button class="btn btn-outline btn-sm" @click="openEdit(scenario.key)">编辑</button>
            <button
              v-if="groupedConfigs[scenario.key]?.config"
              class="btn btn-outline btn-sm"
              @click="openTest(scenario.key)"
            >测试</button>
            <button
              v-if="groupedConfigs[scenario.key]?.config"
              class="btn btn-outline btn-sm"
              @click="loadHistory(scenario.key)"
            >版本历史</button>
            <button
              v-if="groupedConfigs[scenario.key]?.config"
              class="btn btn-danger btn-sm"
              @click="rollback(scenario.key)"
              :disabled="actionLoading"
            >回滚</button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-content modal-lg">
        <h3>编辑 {{ scenarioLabel(form.scenario) }} 配置</h3>
        <div v-if="formError" class="error-msg">{{ formError }}</div>
        <div class="form-group">
          <label class="form-label">服务商 <span class="required">*</span></label>
          <input v-model="form.provider" class="form-input" placeholder="如 OpenAI / DeepSeek" />
        </div>
        <div class="form-group">
          <label class="form-label">模型 <span class="required">*</span></label>
          <input v-model="form.model" class="form-input" placeholder="如 gpt-4o / deepseek-chat" />
        </div>
        <div class="form-group">
          <label class="form-label">API 地址</label>
          <input v-model="form.apiUrl" class="form-input" placeholder="自定义 API 地址（可选）" />
        </div>
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input v-model="form.apiKey" type="password" class="form-input" placeholder="留空则不修改" />
          <p class="form-hint">出于安全考虑，API Key 不会显示实际值</p>
        </div>
        <div class="form-group">
          <label class="form-label">超时时间 (ms)</label>
          <input v-model.number="form.timeoutMs" type="number" class="form-input" min="5000" step="1000" />
        </div>
        <div class="form-group">
          <label class="form-label">系统提示词</label>
          <textarea v-model="form.systemPrompt" class="form-input code-textarea" rows="6" placeholder="System Prompt"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select v-model="form.enabled" class="form-input">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showEditModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-primary" @click="save" :disabled="actionLoading">
            {{ actionLoading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showTestModal" class="modal-overlay" @click.self="showTestModal = false">
      <div class="modal-content modal-lg">
        <h3>测试 {{ scenarioLabel(activeScenario) }} 配置</h3>
        <div class="form-group">
          <label class="form-label">模型</label>
          <input v-model="testForm.model" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">系统提示词</label>
          <textarea v-model="testForm.systemPrompt" class="form-input code-textarea" rows="4"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">用户输入</label>
          <textarea v-model="testForm.userPrompt" class="form-input" rows="4" placeholder="输入测试内容..."></textarea>
        </div>
        <div v-if="testResult" class="test-result">
          <label class="form-label">测试结果</label>
          <pre class="result-output">{{ testResult }}</pre>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showTestModal = false">关闭</button>
          <button class="btn btn-primary" @click="runTest" :disabled="testing">
            {{ testing ? '测试中...' : '运行测试' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
      <div class="modal-content modal-lg">
        <h3>{{ scenarioLabel(activeScenario) }} 版本历史</h3>
        <div v-if="(versionHistory[activeScenario] || []).length === 0" class="empty-state">暂无历史版本</div>
        <div v-else class="history-list">
          <div v-for="(version, idx) in (versionHistory[activeScenario] || [])" :key="idx" class="history-item">
            <div class="history-header">
              <span class="version-num">v{{ version.version || idx + 1 }}</span>
              <span class="version-date">{{ formatDate(version.created_at || version.updated_at) }}</span>
            </div>
            <div class="history-body">
              <div class="history-row"><span>模型:</span> {{ version.model || '-' }}</div>
              <div class="history-row"><span>服务商:</span> {{ version.provider || '-' }}</div>
              <div v-if="version.systemPrompt" class="history-row"><span>提示词:</span> {{ version.systemPrompt.substring(0, 80) }}{{ version.systemPrompt.length > 80 ? '...' : '' }}</div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showHistoryModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-ai-configs { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; }
.config-groups { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.config-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.config-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-alt); }
.config-title { font-size: 16px; font-weight: 600; }
.enabled-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.enabled-badge.enabled { background: rgba(103, 194, 58, 0.15); color: var(--color-success); }
.enabled-badge.disabled { background: rgba(245, 108, 108, 0.15); color: var(--color-danger); }
.config-body { padding: 16px 20px; }
.config-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid var(--color-border); }
.config-row:last-child { border-bottom: none; }
.config-label { color: var(--color-text-light); flex-shrink: 0; margin-right: 16px; }
.api-key-masked { font-family: monospace; letter-spacing: 2px; color: var(--color-text-light); }
.config-empty { padding: 24px 20px; text-align: center; color: var(--color-text-light); font-size: 14px; }
.config-actions { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid var(--color-border); }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.loading-state { text-align: center; padding: 60px 20px; }
.loading-state .loading-spinner { margin-right: 8px; }
.modal-lg { max-width: 600px; }
.modal-content h3 { font-size: 18px; margin-bottom: 16px; }
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.required { color: var(--color-danger); }
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: inherit;
}
.form-input:focus { outline: none; border-color: var(--color-primary); }
.code-textarea { resize: vertical; font-family: 'Fira Code', 'Consolas', monospace; font-size: 13px; line-height: 1.6; }
.form-hint { font-size: 12px; color: var(--color-text-light); margin-top: 4px; }
.error-msg { color: var(--color-danger); padding: 10px 14px; background: rgba(245, 108, 108, 0.1); border-radius: var(--radius); margin-bottom: 16px; font-size: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.test-result { margin-bottom: 16px; }
.result-output { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 14px; max-height: 200px; overflow-y: auto; background: var(--color-bg-alt); font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.history-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
.history-item { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 12px 16px; }
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.version-num { font-weight: 600; color: var(--color-primary); font-size: 14px; }
.version-date { font-size: 13px; color: var(--color-text-light); }
.history-body { font-size: 13px; color: var(--color-text); }
.history-row { padding: 2px 0; }
.history-row span { color: var(--color-text-light); }
@media (max-width: 768px) {
  .config-groups { grid-template-columns: 1fr; }
  .modal-lg { width: 95%; }
}
</style>
