<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const templates = ref([])
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)

const showEditModal = ref(false)
const showPreviewModal = ref(false)
const isEditing = computed(() => !!form.id)

const form = reactive({
  id: null,
  name: '',
  subject: '',
  htmlBody: '',
  textBody: '',
  status: 'active'
})

const preview = ref({ html: '', text: '' })
const formError = ref('')

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadTemplates()
})

async function loadTemplates() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/email-templates')
    templates.value = data.items || data.templates || data || []
  } catch (err) {
    error.value = err.message || '邮件模板加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, { id: null, name: '', subject: '', htmlBody: '', textBody: '', status: 'active' })
  formError.value = ''
  showEditModal.value = true
}

function openEdit(template) {
  Object.assign(form, {
    id: template.id,
    name: template.name || '',
    subject: template.subject || '',
    htmlBody: template.html_body || template.htmlBody || '',
    textBody: template.text_body || template.textBody || '',
    status: template.status || 'active'
  })
  formError.value = ''
  showEditModal.value = true
}

async function save() {
  formError.value = ''
  if (!form.name.trim()) {
    formError.value = '模板名称不能为空'
    return
  }
  if (!form.subject.trim()) {
    formError.value = '邮件主题不能为空'
    return
  }
  actionLoading.value = true
  try {
    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      htmlBody: form.htmlBody,
      textBody: form.textBody,
      status: form.status
    }
    if (isEditing.value) {
      await api.put(`/email-templates/${form.id}`, payload)
    } else {
      await api.post('/email-templates', payload)
    }
    showEditModal.value = false
    await loadTemplates()
  } catch (err) {
    formError.value = err.message || '保存失败'
  } finally {
    actionLoading.value = false
  }
}

async function toggleStatus(template) {
  try {
    const newStatus = template.status === 'active' ? 'disabled' : 'active'
    await api.put(`/email-templates/${template.id}`, { status: newStatus })
    template.status = newStatus
  } catch (err) {
    error.value = err.message || '状态切换失败'
  }
}

async function previewTemplate(template) {
  try {
    const data = await api.get(`/email-templates/${template.id}/preview`)
    preview.value = {
      html: data.html || data.htmlBody || '',
      text: data.text || data.textBody || ''
    }
    showPreviewModal.value = true
  } catch (err) {
    error.value = err.message || '预览失败'
  }
}

async function resendFailed(template) {
  actionLoading.value = true
  try {
    await api.post(`/email-templates/${template.id}/resend`)
    await loadTemplates()
  } catch (err) {
    error.value = err.message || '重发失败'
  } finally {
    actionLoading.value = false
  }
}

function statusLabel(status) {
  return status === 'active' ? '启用' : '停用'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-email-templates">
    <div class="page-header">
      <h1 class="page-title">邮件模板管理</h1>
      <button class="btn btn-primary" @click="openCreate">新建模板</button>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadTemplates">重试</button>
    </div>

    <template v-else>
      <div v-if="templates.length === 0" class="empty-state">暂无邮件模板</div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>模板名称</th>
              <th>主题</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="template in templates" :key="template.id">
              <td class="name-cell">{{ template.name }}</td>
              <td class="subject-cell">{{ template.subject }}</td>
              <td><span class="status-tag" :class="template.status">{{ statusLabel(template.status) }}</span></td>
              <td>{{ formatDate(template.updated_at) }}</td>
              <td class="actions-cell">
                <button class="btn btn-outline btn-sm" @click="openEdit(template)">编辑</button>
                <button class="btn btn-outline btn-sm" @click="previewTemplate(template)">预览</button>
                <button class="btn btn-outline btn-sm" @click="toggleStatus(template)">
                  {{ template.status === 'active' ? '停用' : '启用' }}
                </button>
                <button class="btn btn-outline btn-sm" @click="resendFailed(template)" :disabled="actionLoading">重发失败邮件</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-content modal-lg">
        <h3>{{ isEditing ? '编辑模板' : '新建模板' }}</h3>
        <div v-if="formError" class="error-msg">{{ formError }}</div>
        <div class="form-group">
          <label class="form-label">模板名称 <span class="required">*</span></label>
          <input v-model="form.name" class="form-input" placeholder="请输入模板名称" />
        </div>
        <div class="form-group">
          <label class="form-label">邮件主题 <span class="required">*</span></label>
          <input v-model="form.subject" class="form-input" placeholder="请输入邮件主题" />
        </div>
        <div class="form-group">
          <label class="form-label">HTML 内容</label>
          <textarea v-model="form.htmlBody" class="form-input code-textarea" rows="8" placeholder="HTML 邮件内容（支持模板变量）"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">纯文本内容</label>
          <textarea v-model="form.textBody" class="form-input code-textarea" rows="5" placeholder="纯文本邮件内容（支持模板变量）"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <select v-model="form.status" class="form-input">
            <option value="active">启用</option>
            <option value="disabled">停用</option>
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

    <div v-if="showPreviewModal" class="modal-overlay" @click.self="showPreviewModal = false">
      <div class="modal-content modal-lg">
        <h3>模板预览</h3>
        <div class="preview-tabs">
          <div class="preview-section">
            <h4>HTML 预览</h4>
            <div class="preview-html" v-html="preview.html"></div>
          </div>
          <div class="preview-section">
            <h4>纯文本预览</h4>
            <pre class="preview-text">{{ preview.text }}</pre>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showPreviewModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-email-templates { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; }
.table-wrapper { overflow-x: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.data-table { width: 100%; border-collapse: collapse; min-width: 800px; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.data-table th { background: var(--color-bg-alt); font-weight: 600; color: var(--color-text-light); white-space: nowrap; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--color-bg-alt); }
.name-cell { font-weight: 500; }
.subject-cell { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-tag { padding: 2px 10px; border-radius: 12px; font-size: 12px; white-space: nowrap; }
.status-tag.active { background: rgba(103, 194, 58, 0.15); color: var(--color-success); }
.status-tag.disabled { background: rgba(245, 108, 108, 0.15); color: var(--color-danger); }
.actions-cell { display: flex; gap: 8px; white-space: nowrap; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.loading-state { text-align: center; padding: 60px 20px; }
.loading-state .loading-spinner { margin-right: 8px; }
.modal-lg { max-width: 640px; }
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
.error-msg { color: var(--color-danger); padding: 10px 14px; background: rgba(245, 108, 108, 0.1); border-radius: var(--radius); margin-bottom: 16px; font-size: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
.preview-tabs { display: flex; flex-direction: column; gap: 20px; }
.preview-section h4 { font-size: 14px; color: var(--color-text-light); margin-bottom: 8px; }
.preview-html { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; max-height: 200px; overflow-y: auto; background: var(--color-bg-alt); }
.preview-text { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; max-height: 200px; overflow-y: auto; background: var(--color-bg-alt); font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: stretch; gap: 12px; }
  .modal-lg { width: 95%; }
}
</style>
