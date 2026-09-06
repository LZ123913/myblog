<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const bookmarks = ref([])
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)

const search = ref('')

const showDeleteModal = ref(false)
const pendingDelete = ref(null)

const filteredBookmarks = computed(() => {
  if (!search.value) return bookmarks.value
  const kw = search.value.toLowerCase()
  return bookmarks.value.filter(b => (b.title || '').toLowerCase().includes(kw))
})

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadBookmarks()
})

async function loadBookmarks() {
  loading.value = true
  error.value = ''
  try {
    const userId = authStore.user?.id
    if (!userId) throw { message: '无法获取用户信息' }
    const data = await api.get(`/users/${userId}/bookmarks`)
    bookmarks.value = data.items || data.bookmarks || data || []
  } catch (err) {
    error.value = err.message || '收藏列表加载失败'
  } finally {
    loading.value = false
  }
}

function confirmDelete(bookmark) {
  pendingDelete.value = bookmark
  showDeleteModal.value = true
}

async function doDelete() {
  if (!pendingDelete.value) return
  actionLoading.value = true
  try {
    const userId = authStore.user?.id
    await api.delete(`/users/${userId}/bookmarks/${pendingDelete.value.slug || pendingDelete.value.article_slug}`)
    showDeleteModal.value = false
    pendingDelete.value = null
    await loadBookmarks()
  } catch (err) {
    error.value = err.message || '取消收藏失败'
  } finally {
    actionLoading.value = false
  }
}

function privacyLabel(privacy) {
  return privacy === 'private' ? '私密' : '公开'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="container admin-bookmarks">
    <div class="page-header">
      <h1 class="page-title">我的收藏</h1>
      <input v-model="search" placeholder="搜索收藏文章..." class="search-input" />
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="loadBookmarks">重试</button>
    </div>

    <template v-else>
      <div v-if="filteredBookmarks.length === 0" class="empty-state">暂无收藏记录</div>

      <div v-else class="bookmark-list">
        <div v-for="bookmark in filteredBookmarks" :key="bookmark.id || bookmark.slug" class="bookmark-card">
          <div class="bookmark-info">
            <div class="bookmark-title">{{ bookmark.title }}</div>
            <div class="bookmark-meta">
              <span class="privacy-badge" :class="bookmark.privacy">
                {{ privacyLabel(bookmark.privacy) }}
              </span>
              <span v-if="bookmark.bookmarked_at" class="bookmark-date">{{ formatDate(bookmark.bookmarked_at) }}</span>
            </div>
          </div>
          <div class="bookmark-actions">
            <button class="btn btn-danger btn-sm" @click="confirmDelete(bookmark)">取消收藏</button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-content">
        <h3>确认取消收藏</h3>
        <p class="confirm-text">确定要取消"{{ pendingDelete?.title }}"收藏吗？删除后可在 30 天内恢复</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showDeleteModal = false" :disabled="actionLoading">取消</button>
          <button class="btn btn-danger" @click="doDelete" :disabled="actionLoading">
            {{ actionLoading ? '处理中...' : '确认取消' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-bookmarks { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; }
.search-input {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  min-width: 240px;
}
.bookmark-list { display: flex; flex-direction: column; gap: 12px; }
.bookmark-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition);
}
.bookmark-card:hover { box-shadow: var(--shadow-md); }
.bookmark-info { flex: 1; min-width: 0; }
.bookmark-title { font-size: 16px; font-weight: 500; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bookmark-meta { display: flex; align-items: center; gap: 12px; }
.privacy-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.privacy-badge.public { background: var(--color-primary-light); color: var(--color-primary); }
.privacy-badge.private { background: var(--color-bg-alt); color: var(--color-text-light); }
.bookmark-date { font-size: 13px; color: var(--color-text-light); }
.bookmark-actions { margin-left: 16px; flex-shrink: 0; }
.btn-sm { padding: 5px 12px; font-size: 13px; }
.loading-state { text-align: center; padding: 60px 20px; }
.loading-state .loading-spinner { margin-right: 8px; }
.modal-content { max-width: 420px; }
.modal-content h3 { font-size: 18px; margin-bottom: 12px; }
.confirm-text { color: var(--color-text-light); line-height: 1.6; margin-bottom: 20px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: stretch; }
  .search-input { min-width: 0; width: 100%; }
  .bookmark-card { flex-direction: column; align-items: flex-start; gap: 12px; }
  .bookmark-actions { margin-left: 0; align-self: flex-end; }
}
</style>
