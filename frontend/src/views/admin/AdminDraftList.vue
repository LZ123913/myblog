<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const router = useRouter()
const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const drafts = ref([])
const loading = ref(true)
const error = ref('')

const search = ref('')
const statusFilter = ref('')
const sortBy = ref('updated_at')
const sortOrder = ref('desc')
const selectedIds = ref([])

const showBatchDeleteModal = ref(false)
const showDeleteModal = ref(false)
const pendingDelete = ref(null)
const actionLoading = ref(false)

const filteredDrafts = computed(() => {
  let list = drafts.value
  if (search.value) {
    const kw = search.value.toLowerCase()
    list = list.filter(d => (d.title || '').toLowerCase().includes(kw))
  }
  return list
})

const allSelected = computed(() => {
  return filteredDrafts.value.length > 0 && filteredDrafts.value.every(d => selectedIds.value.includes(d.id))
})

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadDrafts()
})

async function loadDrafts() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.append('status', statusFilter.value)
    params.append('sortBy', sortBy.value)
    params.append('sortOrder', sortOrder.value)
    const data = await api.get(`/drafts?${params.toString()}`)
    drafts.value = data.items || data.drafts || data || []
  } catch (err) {
    error.value = err.message || '草稿列表加载失败'
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  // client-side filter via computed
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx > -1) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = filteredDrafts.value.map(d => d.id)
  }
}

function editDraft(draft) {
  router.push(`/creator?draft=${draft.id}`)
}

function confirmDelete(draft) {
  pendingDelete.value = draft
  showDeleteModal.value = true
}

async function doDelete() {
  if (!pendingDelete.value) return
  actionLoading.value = true
  try {
    await api.delete(`/drafts/${pendingDelete.value.id}`)
    showDeleteModal.value = false
    pendingDelete.value = null
    await loadDrafts()
  } catch (err) {
    error.value = err.message || '删除失败'
  } finally {
    actionLoading.value = false
  }
}

async function copyDraft(draft) {
  try {
    const data = await api.post(`/drafts/${draft.id}/copy`)
    await loadDrafts()
  } catch (err) {
    error.value = err.message || '复制失败'
  }
}

function confirmBatchDelete() {
  if (selectedIds.value.length === 0) return
  showBatchDeleteModal.value = true
}

async function doBatchDelete() {
  actionLoading.value = true
  try {
    for (const id of selectedIds.value) {
      await api.delete(`/drafts/${id}`)
    }
    showBatchDeleteModal.value = false
    selectedIds.value = []
    await loadDrafts()
  } catch (err) {
    error.value = err.message || '批量删除失败'
  } finally {
    actionLoading.value = false
  }
}

function parseTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  try { return JSON.parse(tags) } catch { return [] }
}

function statusLabel(status) {
  const map = { imported: '已导入', polished: '已润色', tagged: '已打标' }
  return map[status] || status
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-draft-list">
    <div class="page-header">
      <h1 class="page-title">草稿管理</h1>
      <div class="header-actions">
        <input v-model="search" placeholder="搜索草稿标题..." class="search-input" @input="handleSearch" />
        <select v-model="statusFilter" class="filter-select" @change="loadDrafts">
          <option value="">全部状态</option>
          <option value="imported">已导入</option>
          <option value="polished">已润色</option>
          <option value="tagged">已打标</option>
        </select>
        <select v-model="sortBy" class="filter-select" @change="loadDrafts">
          <option value="updated_at">更新时间</option>
          <option value="created_at">创建时间</option>
        </select>
        <button v-if="selectedIds.length > 0" class="btn btn-danger btn-sm" @click="confirmBatchDelete">批量删除 ({{ selectedIds.length }})</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadDrafts">重试</button>
    </div>

    <template v-else>
      <div v-if="filteredDrafts.length === 0" class="empty-state">暂无草稿</div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="checkbox-col"><input type="checkbox" :checked="allSelected" @change="toggleSelectAll" /></th>
              <th>标题</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>更新时间</th>
              <th>标签</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="draft in filteredDrafts" :key="draft.id">
              <td class="checkbox-col"><input type="checkbox" :checked="selectedIds.includes(draft.id)" @change="toggleSelect(draft.id)" /></td>
              <td class="title-cell">{{ draft.title || '无标题' }}</td>
              <td><span class="status-tag" :class="draft.status">{{ statusLabel(draft.status) }}</span></td>
              <td>{{ formatDate(draft.created_at) }}</td>
              <td>{{ formatDate(draft.updated_at) }}</td>
              <td>
                <div class="tag-list">
                  <span v-for="tag in (parseTags(draft.tags))" :key="tag" class="tag-pill">{{ tag }}</span>
                </div>
              </td>
              <td class="actions-cell">
                <button class="btn btn-outline btn-sm" @click="editDraft(draft)">编辑</button>
                <button class="btn btn-outline btn-sm" @click="copyDraft(draft)">复制</button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(draft)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p class="confirm-text">确定要删除草稿"{{ pendingDelete?.title }}"吗？此操作不可恢复</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showDeleteModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-danger" @click="doDelete" :disabled="actionLoading">
            {{ actionLoading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchDeleteModal" class="modal-overlay" @click.self="showBatchDeleteModal = false">
      <div class="modal-content">
        <h3>批量删除确认</h3>
        <p class="confirm-text">确定要删除选中的 {{ selectedIds.length }} 篇草稿吗？此操作不可恢复</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showBatchDeleteModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-danger" @click="doBatchDelete" :disabled="actionLoading">
            {{ actionLoading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-draft-list { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; }
.header-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.search-input, .filter-select {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}
.search-input { min-width: 200px; }
.table-wrapper { overflow-x: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.data-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.data-table th { background: var(--color-bg-alt); font-weight: 600; color: var(--color-text-light); white-space: nowrap; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--color-bg-alt); }
.checkbox-col { width: 40px; text-align: center; }
.title-cell { font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-tag { padding: 2px 10px; border-radius: 12px; font-size: 12px; white-space: nowrap; }
.status-tag.imported { background: var(--color-primary-light); color: var(--color-primary); }
.status-tag.polished { background: rgba(103, 194, 58, 0.15); color: var(--color-success); }
.status-tag.tagged { background: rgba(230, 162, 60, 0.15); color: var(--color-warning); }
.tag-list { display: flex; gap: 4px; flex-wrap: wrap; max-width: 200px; }
.actions-cell { display: flex; gap: 8px; white-space: nowrap; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.loading-state { text-align: center; padding: 60px 20px; }
.loading-state .loading-spinner { margin-right: 8px; }
.modal-content { max-width: 420px; }
.modal-content h3 { font-size: 18px; margin-bottom: 12px; }
.confirm-text { color: var(--color-text-light); line-height: 1.6; margin-bottom: 20px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: stretch; }
  .header-actions { flex-direction: column; }
  .search-input { min-width: 0; width: 100%; }
}
</style>
