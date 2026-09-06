<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const router = useRouter()
const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const articles = ref([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const search = ref('')
const statusFilter = ref('')

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

const showDeleteModal = ref(false)
const pendingDelete = ref(null)
const deleting = ref(false)

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadArticles()
})

async function loadArticles() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: page.value,
      pageSize: pageSize.value
    })
    if (search.value) params.append('keyword', search.value)
    if (statusFilter.value) params.append('status', statusFilter.value)
    const data = await api.get(`/articles/admin/list?${params.toString()}`)
    articles.value = data.items || data.articles || []
    total.value = data.total || articles.value.length
  } catch (err) {
    error.value = err.message || '文章列表加载失败'
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadArticles()
}

function changePage(newPage) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
  loadArticles()
}

function editArticle(article) {
  router.push(`/admin/articles/${article.id}/edit`)
}

function confirmDelete(article) {
  pendingDelete.value = article
  showDeleteModal.value = true
}

async function doDelete() {
  if (!pendingDelete.value) return
  deleting.value = true
  try {
    await api.delete(`/articles/${pendingDelete.value.id}`)
    showDeleteModal.value = false
    pendingDelete.value = null
    await loadArticles()
  } catch (err) {
    error.value = err.message || '删除失败'
  } finally {
    deleting.value = false
  }
}

function statusLabel(status) {
  const map = { published: '已发布', draft: '草稿', archived: '已归档' }
  return map[status] || status
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-article-list">
    <div class="page-header">
      <h1 class="page-title">文章管理</h1>
      <div class="header-actions">
        <input v-model="search" placeholder="搜索文章标题..." class="search-input" @keyup.enter="handleSearch" />
        <select v-model="statusFilter" class="filter-select" @change="handleSearch">
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option>
        </select>
        <button class="btn btn-outline" @click="handleSearch">搜索</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadArticles">重试</button>
    </div>

    <template v-else>
      <div v-if="articles.length === 0" class="empty-state">暂无文章数据</div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>分类</th>
              <th>状态</th>
              <th>点赞</th>
              <th>收藏</th>
              <th>发布日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="article in articles" :key="article.id">
              <td class="title-cell">{{ article.title }}</td>
              <td>{{ article.category_name || article.category || '-' }}</td>
              <td><span class="status-tag" :class="article.status">{{ statusLabel(article.status) }}</span></td>
              <td>{{ article.likes || 0 }}</td>
              <td>{{ article.bookmarks || 0 }}</td>
              <td>{{ formatDate(article.published_at) }}</td>
              <td class="actions-cell">
                <button class="btn btn-outline btn-sm" @click="editArticle(article)">编辑</button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(article)">删除</button>
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

    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p class="confirm-text">确定要删除"{{ pendingDelete?.title }}"吗？删除后可在 30 天内恢复</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showDeleteModal = false" :disabled="deleting">取消</button>
          <button class="btn btn-danger" @click="doDelete" :disabled="deleting">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-article-list { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; }
.header-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.search-input, .filter-select {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
}
.search-input { min-width: 220px; }
.table-wrapper { overflow-x: auto; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.data-table { width: 100%; border-collapse: collapse; min-width: 800px; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.data-table th { background: var(--color-bg-alt); font-weight: 600; color: var(--color-text-light); white-space: nowrap; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--color-bg-alt); }
.title-cell { font-weight: 500; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-tag { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.status-tag.published { background: rgba(103, 194, 58, 0.15); color: var(--color-success); }
.status-tag.draft { background: var(--color-bg-alt); color: var(--color-text-light); }
.status-tag.archived { background: rgba(230, 162, 60, 0.15); color: var(--color-warning); }
.actions-cell { display: flex; gap: 8px; white-space: nowrap; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
.page-info { font-size: 14px; color: var(--color-text-light); }
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
