<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const users = ref([])
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)

const filters = reactive({
  email: '',
  nickname: '',
  role: '',
  status: ''
})

const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

const showDeleteModal = ref(false)
const showDetailModal = ref(false)
const pendingDelete = ref(null)
const detailUser = ref(null)
const showRoleDropdown = ref(null)

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: page.value,
      pageSize: pageSize.value
    })
    if (filters.email) params.append('email', filters.email)
    if (filters.nickname) params.append('nickname', filters.nickname)
    if (filters.role) params.append('role', filters.role)
    if (filters.status) params.append('status', filters.status)
    const data = await api.get(`/users?${params.toString()}`)
    users.value = data.items || data.users || []
    total.value = data.total || users.value.length
  } catch (err) {
    error.value = err.message || '用户列表加载失败'
  } finally {
    loading.value = false
  }
}

function handleFilter() {
  page.value = 1
  loadUsers()
}

function changePage(newPage) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
  loadUsers()
}

async function changeRole(user, newRole) {
  try {
    await api.put(`/users/${user.id}/role`, { role: newRole })
    user.role = newRole
    showRoleDropdown.value = null
  } catch (err) {
    error.value = err.message || '角色修改失败'
  }
}

async function toggleStatus(user) {
  try {
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    await api.put(`/users/${user.id}/status`, { status: newStatus })
    user.status = newStatus
  } catch (err) {
    error.value = err.message || '状态修改失败'
  }
}

function viewDetail(user) {
  detailUser.value = user
  showDetailModal.value = true
}

function confirmDelete(user) {
  pendingDelete.value = user
  showDeleteModal.value = true
}

async function doDelete() {
  if (!pendingDelete.value) return
  actionLoading.value = true
  try {
    await api.delete(`/users/${pendingDelete.value.id}`)
    showDeleteModal.value = false
    pendingDelete.value = null
    await loadUsers()
  } catch (err) {
    error.value = err.message || '删除用户失败'
  } finally {
    actionLoading.value = false
  }
}

function toggleRoleDropdown(userId) {
  showRoleDropdown.value = showRoleDropdown.value === userId ? null : userId
}

function statusLabel(status) {
  return status === 'active' ? '正常' : '已禁用'
}

function roleLabel(role) {
  return role === 'admin' ? '管理员' : '读者'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-users">
    <div class="page-header">
      <h1 class="page-title">用户管理</h1>
    </div>

    <div class="filter-bar">
      <input v-model="filters.email" placeholder="邮箱" class="filter-input" @keyup.enter="handleFilter" />
      <input v-model="filters.nickname" placeholder="昵称" class="filter-input" @keyup.enter="handleFilter" />
      <select v-model="filters.role" class="filter-select" @change="handleFilter">
        <option value="">全部角色</option>
        <option value="admin">管理员</option>
        <option value="reader">读者</option>
      </select>
      <select v-model="filters.status" class="filter-select" @change="handleFilter">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="disabled">已禁用</option>
      </select>
      <button class="btn btn-outline btn-sm" @click="handleFilter">筛选</button>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadUsers">重试</button>
    </div>

    <template v-else>
      <div v-if="users.length === 0" class="empty-state">暂无用户数据</div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>邮箱</th>
              <th>昵称</th>
              <th>角色</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>最后登录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td class="email-cell">{{ user.email }}</td>
              <td>{{ user.nickname || '-' }}</td>
              <td>
                <div class="role-cell">
                  <span class="role-badge" :class="user.role">{{ roleLabel(user.role) }}</span>
                  <div class="role-dropdown-wrapper">
                    <button class="btn btn-outline btn-xs" @click="toggleRoleDropdown(user.id)">切换</button>
                    <div v-if="showRoleDropdown === user.id" class="role-dropdown">
                      <button @click="changeRole(user, 'admin')">管理员</button>
                      <button @click="changeRole(user, 'reader')">读者</button>
                    </div>
                  </div>
                </div>
              </td>
              <td><span class="status-tag" :class="user.status">{{ statusLabel(user.status) }}</span></td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>{{ formatDate(user.last_login_at) }}</td>
              <td class="actions-cell">
                <button class="btn btn-outline btn-sm" @click="viewDetail(user)">详情</button>
                <button class="btn btn-outline btn-sm" @click="toggleStatus(user)">
                  {{ user.status === 'active' ? '禁用' : '启用' }}
                </button>
                <button
                  v-if="user.id !== authStore.user?.id"
                  class="btn btn-danger btn-sm"
                  @click="confirmDelete(user)"
                >删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="pagination">
        <button class="btn btn-outline btn-sm" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-outline btn-sm" :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
      </div>
    </template>

    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal-content">
        <h3>用户详情</h3>
        <div class="detail-list">
          <div class="detail-row"><span class="detail-label">邮箱</span><span>{{ detailUser?.email }}</span></div>
          <div class="detail-row"><span class="detail-label">昵称</span><span>{{ detailUser?.nickname || '-' }}</span></div>
          <div class="detail-row"><span class="detail-label">角色</span><span>{{ roleLabel(detailUser?.role) }}</span></div>
          <div class="detail-row"><span class="detail-label">状态</span><span>{{ statusLabel(detailUser?.status) }}</span></div>
          <div class="detail-row"><span class="detail-label">注册时间</span><span>{{ formatDate(detailUser?.created_at) }}</span></div>
          <div class="detail-row"><span class="detail-label">最后登录</span><span>{{ formatDate(detailUser?.last_login_at) }}</span></div>
          <div class="detail-row" v-if="detailUser?.bio"><span class="detail-label">简介</span><span>{{ detailUser.bio }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p class="confirm-text">确定要删除用户"{{ pendingDelete?.nickname || pendingDelete?.email }}"吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showDeleteModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-danger" @click="doDelete" :disabled="actionLoading">
            {{ actionLoading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-users { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 24px; font-weight: 700; }
.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
.filter-input, .filter-select {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}
.filter-input { min-width: 160px; }
.table-wrapper { overflow-x: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.data-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.data-table th { background: var(--color-bg-alt); font-weight: 600; color: var(--color-text-light); white-space: nowrap; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--color-bg-alt); }
.email-cell { color: var(--color-primary); }
.role-cell { display: flex; align-items: center; gap: 8px; }
.role-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.role-badge.admin { background: var(--color-primary-light); color: var(--color-primary); }
.role-badge.reader { background: var(--color-bg-alt); color: var(--color-text-light); }
.role-dropdown-wrapper { position: relative; }
.role-dropdown { position: absolute; top: 100%; left: 0; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 2px; padding: 4px; z-index: 10; }
.role-dropdown button { padding: 6px 12px; font-size: 13px; text-align: left; border-radius: 4px; }
.role-dropdown button:hover { background: var(--color-bg-alt); }
.status-tag { padding: 2px 10px; border-radius: 12px; font-size: 12px; white-space: nowrap; }
.status-tag.active { background: rgba(103, 194, 58, 0.15); color: var(--color-success); }
.status-tag.disabled { background: rgba(245, 108, 108, 0.15); color: var(--color-danger); }
.actions-cell { display: flex; gap: 8px; white-space: nowrap; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.btn-xs { padding: 3px 8px; font-size: 12px; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
.page-info { font-size: 14px; color: var(--color-text-light); }
.loading-state { text-align: center; padding: 60px 20px; }
.loading-state .loading-spinner { margin-right: 8px; }
.detail-list { margin-bottom: 20px; }
.detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
.detail-row:last-child { border-bottom: none; }
.detail-label { width: 100px; font-weight: 600; color: var(--color-text-light); flex-shrink: 0; }
.modal-content { max-width: 480px; }
.modal-content h3 { font-size: 18px; margin-bottom: 16px; }
.confirm-text { color: var(--color-text-light); line-height: 1.6; margin-bottom: 20px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
@media (max-width: 768px) {
  .filter-bar { flex-direction: column; }
  .filter-input { min-width: 0; width: 100%; }
}
</style>
