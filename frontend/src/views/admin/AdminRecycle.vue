<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const items = ref([])
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)

const showRestoreModal = ref(false)
const showPermanentDeleteModal = ref(false)
const pendingItem = ref(null)

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadItems()
})

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/recycle')
    items.value = data.items || data || []
  } catch (err) {
    error.value = err.message || '回收站加载失败'
  } finally {
    loading.value = false
  }
}

function confirmRestore(item) {
  if (!item.canRestore) return
  pendingItem.value = item
  showRestoreModal.value = true
}

async function doRestore() {
  if (!pendingItem.value) return
  actionLoading.value = true
  try {
    await api.post(`/recycle/${pendingItem.value.id}/restore`)
    showRestoreModal.value = false
    pendingItem.value = null
    await loadItems()
  } catch (err) {
    error.value = err.message || '恢复失败'
  } finally {
    actionLoading.value = false
  }
}

function confirmPermanentDelete(item) {
  pendingItem.value = item
  showPermanentDeleteModal.value = true
}

async function doPermanentDelete() {
  if (!pendingItem.value) return
  actionLoading.value = true
  try {
    await api.delete(`/recycle/${pendingItem.value.id}/permanent`)
    showPermanentDeleteModal.value = false
    pendingItem.value = null
    await loadItems()
  } catch (err) {
    error.value = err.message || '彻底删除失败'
  } finally {
    actionLoading.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-recycle">
    <div class="page-header">
      <h1 class="page-title">回收站</h1>
      <p class="page-desc">已删除文章可在 30 天内恢复，超过 30 天将自动彻底删除</p>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadItems">重试</button>
    </div>

    <template v-else>
      <div v-if="items.length === 0" class="empty-state">回收站为空</div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>删除时间</th>
              <th>剩余天数</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td class="title-cell">{{ item.title }}</td>
              <td>{{ formatDate(item.deleted_at) }}</td>
              <td>
                <span :class="['days-left', { expired: item.daysLeft <= 0 || !item.canRestore }]">
                  {{ item.daysLeft > 0 ? `${item.daysLeft} 天` : '已过期' }}
                </span>
              </td>
              <td>
                <span v-if="item.canRestore" class="status-tag restorable">可恢复</span>
                <span v-else class="status-tag expired">已过期</span>
              </td>
              <td class="actions-cell">
                <button
                  v-if="item.canRestore"
                  class="btn btn-outline btn-sm"
                  @click="confirmRestore(item)"
                >恢复</button>
                <button
                  class="btn btn-danger btn-sm"
                  @click="confirmPermanentDelete(item)"
                >{{ item.canRestore ? '彻底删除' : '彻底删除' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="showRestoreModal" class="modal-overlay" @click.self="showRestoreModal = false">
      <div class="modal-content">
        <h3>确认恢复</h3>
        <p class="confirm-text">确定要恢复"{{ pendingItem?.title }}"吗？恢复后文章将重新可见。</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showRestoreModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-primary" @click="doRestore" :disabled="actionLoading">
            {{ actionLoading ? '恢复中...' : '确认恢复' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showPermanentDeleteModal" class="modal-overlay" @click.self="showPermanentDeleteModal = false">
      <div class="modal-content">
        <h3>彻底删除</h3>
        <p class="confirm-text warning-text">确定要彻底删除"{{ pendingItem?.title }}"吗？此操作不可恢复，文章将被永久删除。</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showPermanentDeleteModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-danger" @click="doPermanentDelete" :disabled="actionLoading">
            {{ actionLoading ? '删除中...' : '彻底删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-recycle { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.page-desc { font-size: 14px; color: var(--color-text-light); }
.table-wrapper { overflow-x: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.data-table { width: 100%; border-collapse: collapse; min-width: 700px; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.data-table th { background: var(--color-bg-alt); font-weight: 600; color: var(--color-text-light); white-space: nowrap; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--color-bg-alt); }
.title-cell { font-weight: 500; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.days-left { font-size: 13px; color: var(--color-text-light); }
.days-left.expired { color: var(--color-danger); font-weight: 600; }
.status-tag { padding: 2px 10px; border-radius: 12px; font-size: 12px; white-space: nowrap; }
.status-tag.restorable { background: rgba(103, 194, 58, 0.15); color: var(--color-success); }
.status-tag.expired { background: rgba(245, 108, 108, 0.15); color: var(--color-danger); }
.actions-cell { display: flex; gap: 8px; white-space: nowrap; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.loading-state { text-align: center; padding: 60px 20px; }
.loading-state .loading-spinner { margin-right: 8px; }
.modal-content { max-width: 420px; }
.modal-content h3 { font-size: 18px; margin-bottom: 12px; }
.confirm-text { color: var(--color-text-light); line-height: 1.6; margin-bottom: 20px; }
.warning-text { color: var(--color-danger); }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
@media (max-width: 768px) {
  .table-wrapper { font-size: 13px; }
}
</style>
