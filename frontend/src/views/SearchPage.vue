<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'
import ArticleCard from '../components/ArticleCard.vue'
import InfiniteScroll from '../components/InfiniteScroll.vue'

const route = useRoute()
const router = useRouter()
const bgStore = useBackgroundStore()

const searchQuery = ref(route.query.q || '')
const sortBy = ref(route.query.sortBy || 'hot')
const searchError = ref('')

const articles = ref([])
const pageInfo = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const loading = ref(false)
const loadError = ref('')
const hasSearched = ref(false)

const hotArticles = ref([])
const hotLoading = ref(true)

const suggestions = ref([])
const showSuggestions = ref(false)
const suggestionLoading = ref(false)
const defaultSuggestions = ref([])

let suggestTimer = null

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadHotRanking()
  loadDefaultSuggestions()
  if (route.query.q) {
    doSearch()
  }
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

async function loadDefaultSuggestions() {
  try {
    const data = await api.get('/articles?sortBy=hot&page=1&pageSize=6')
    defaultSuggestions.value = (data.items || []).map(a => ({
      slug: a.slug,
      title: a.title,
      likes: a.likes,
      bookmarks: a.bookmarks,
      views: a.views,
      hotScore: Math.round(((a.likes || 0) * 2 + (a.bookmarks || 0) * 3 + (a.views || 0)) * (1 / (1 + (Date.now() - new Date(a.published_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 30)))),
      fireLevel: 0
    }))
    defaultSuggestions.value.forEach(a => {
      const s = a.hotScore
      a.fireLevel = s >= 80 ? 3 : s >= 40 ? 2 : s >= 15 ? 1 : 0
    })
  } catch {}
}

watch(() => [route.query.q, route.query.sortBy], ([q, sb]) => {
  searchQuery.value = q || ''
  sortBy.value = sb || 'hot'
  if (q) {
    resetAndSearch()
  }
})

async function loadHotRanking() {
  hotLoading.value = true
  try {
    const data = await api.get('/articles?sortBy=hot&page=1&pageSize=5')
    hotArticles.value = data.items || []
  } catch {
    hotArticles.value = []
  } finally {
    hotLoading.value = false
  }
}

function onSearchInput() {
  const q = searchQuery.value.trim()
  if (suggestTimer) clearTimeout(suggestTimer)
  if (q.length < 1) {
    suggestions.value = defaultSuggestions.value
    showSuggestions.value = true
    return
  }
  suggestTimer = setTimeout(() => loadSuggestions(q), 300)
}

function onSearchFocus() {
  if (searchQuery.value.trim().length < 1) {
    suggestions.value = defaultSuggestions.value
    showSuggestions.value = defaultSuggestions.value.length > 0
  } else {
    showSuggestions.value = suggestions.value.length > 0
  }
}

async function loadSuggestions(q) {
  suggestionLoading.value = true
  try {
    const data = await api.get(`/search/suggestions?q=${encodeURIComponent(q)}`)
    suggestions.value = data.items || []
    showSuggestions.value = suggestions.value.length > 0
  } catch {
    suggestions.value = []
    showSuggestions.value = false
  } finally {
    suggestionLoading.value = false
  }
}

function selectSuggestion(s) {
  searchQuery.value = s.title
  showSuggestions.value = false
  router.push({ path: '/search', query: { q: s.title, sortBy: sortBy.value } })
}

function hideSuggestions() {
  setTimeout(() => { showSuggestions.value = false }, 200)
}

function fireText(level) {
  return ['', '🔥', '🔥🔥', '🔥🔥🔥'][level] || ''
}

function handleSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchError.value = '请输入至少 2 个字符'
    return
  }
  searchError.value = ''
  showSuggestions.value = false
  router.push({ path: '/search', query: { q, sortBy: sortBy.value } })
}

function changeSort(value) {
  sortBy.value = value
  if (route.query.q) {
    router.push({ path: '/search', query: { q: route.query.q, sortBy: value } })
  }
}

function resetAndSearch() {
  articles.value = []
  pageInfo.page = 1
  pageInfo.total = 0
  pageInfo.totalPages = 0
  doSearch()
}

async function doSearch() {
  const q = (route.query.q || searchQuery.value).trim()
  if (!q || q.length < 2) return
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  searchError.value = ''
  try {
    const data = await api.get(`/search?q=${encodeURIComponent(q)}&sortBy=${sortBy.value}&page=${pageInfo.page}&pageSize=${pageInfo.pageSize}`)
    const newItems = data.items || data.articles || []
    const existingIds = new Set(articles.value.map(a => a.id))
    const deduped = newItems.filter(a => !existingIds.has(a.id))
    articles.value.push(...deduped)
    pageInfo.total = data.total || 0
    pageInfo.totalPages = data.totalPages || Math.ceil((data.total || 0) / pageInfo.pageSize)
    hasSearched.value = true
  } catch (err) {
    loadError.value = err.message || '搜索失败'
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (pageInfo.page < pageInfo.totalPages) {
    pageInfo.page++
    doSearch()
  }
}

const hasMore = () => pageInfo.page < pageInfo.totalPages
</script>

<template>
  <div class="search-page">
    <div class="container">
      <div class="search-section">
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索文章..."
            class="search-input"
            @keyup.enter="handleSearch"
            @input="onSearchInput"
            @focus="onSearchFocus"
            @blur="hideSuggestions"
          />
          <div v-if="showSuggestions" class="suggestions-dropdown">
            <div v-if="suggestionLoading" class="suggest-loading">搜索中...</div>
            <div v-else-if="suggestions.length === 0 && searchQuery.trim().length >= 1" class="suggest-loading">无匹配结果</div>
            <div v-else class="suggest-header">{{ searchQuery.trim().length < 1 ? '🔥 热门推荐' : '搜索结果' }}</div>
            <div
              v-for="s in suggestions"
              :key="s.slug"
              class="suggest-item"
              @mousedown.prevent="selectSuggestion(s)"
            >
              <span class="suggest-text">{{ s.title }}</span>
              <span v-if="s.fireLevel > 0" class="suggest-fire">{{ fireText(s.fireLevel) }}</span>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" @click="handleSearch" :disabled="loading">
          {{ loading ? '搜索中...' : '搜索' }}
        </button>
      </div>
      <div v-if="searchError" class="search-error">{{ searchError }}</div>

      <div class="search-layout">
        <div class="search-main">
          <div v-if="route.query.q" class="sort-bar">
            <span class="sort-label">排序方式：</span>
            <button class="sort-btn" :class="{ active: sortBy === 'hot' }" @click="changeSort('hot')">热门</button>
            <button class="sort-btn" :class="{ active: sortBy === 'date' }" @click="changeSort('date')">最新</button>
            <span class="result-count">共 {{ pageInfo.total }} 篇</span>
          </div>

          <div v-if="loading && articles.length === 0" class="loading-state" style="padding: 80px; text-align: center;">
            <span class="loading-spinner"></span> 搜索中...
          </div>

          <div v-else-if="loadError && articles.length === 0" class="error-state">
            <h3>{{ loadError }}</h3>
            <button class="btn btn-outline" @click="resetAndSearch">重试</button>
          </div>

          <template v-else>
            <div v-if="articles.length > 0" class="articles-grid">
              <ArticleCard
                v-for="(article, index) in articles"
                :key="article.id"
                :article="article"
                :index="index"
                :recommended="sortBy === 'hot' && index < 3"
              />
            </div>
            <div v-else-if="hasSearched" class="empty-state">
              <p>未找到与「{{ route.query.q }}」相关的文章</p>
            </div>

            <InfiniteScroll
              :has-more="hasMore()"
              :loading="loading"
              :error="loadError"
              @load-more="loadMore"
            />
          </template>
        </div>

        <aside class="sidebar">
          <div class="hot-ranking-card">
            <h3 class="ranking-title">🔥 最火排行榜</h3>
            <div v-if="hotLoading" class="ranking-loading">
              <span class="loading-spinner"></span> 加载中...
            </div>
            <template v-else>
              <div
                v-for="(article, index) in hotArticles"
                :key="article.id"
                class="ranking-item"
                @click="$router.push(`/article/${article.slug}`)"
              >
                <span class="ranking-num" :class="{ top: index < 3 }">{{ index + 1 }}</span>
                <div class="ranking-info">
                  <div class="ranking-article-title">{{ article.title }}</div>
                  <div class="ranking-stats">
                    <span>♡ {{ article.likes || 0 }}</span>
                    <span>★ {{ article.bookmarks || 0 }}</span>
                    <span>👁 {{ article.views || 0 }}</span>
                  </div>
                </div>
              </div>
              <div v-if="hotArticles.length === 0" class="ranking-empty">暂无数据</div>
            </template>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page { padding-top: 20px; }
.search-section {
  display: flex;
  gap: 8px;
  margin: 20px 0;
  max-width: 600px;
  position: relative;
}
.search-input-wrapper { flex: 1; position: relative; }
.search-input {
  width: 100%;
  padding: 12px 18px;
  border: 1.5px solid var(--glass-border);
  border-radius: var(--radius-lg);
  font-size: 15px;
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition);
}
.search-input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 4px rgba(108, 92, 231, 0.1);
}
.search-input::placeholder { color: var(--color-text-muted); }
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  z-index: 50;
  max-height: 320px;
  overflow-y: auto;
  animation: floatUp 0.2s ease;
}
.suggest-loading { padding: 12px 16px; font-size: 13px; color: var(--color-text-light); }
.suggest-header {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.suggest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  transition: background var(--transition);
  border-bottom: 1px solid var(--color-border);
}
.suggest-item:last-child { border-bottom: none; }
.suggest-item:hover { background: var(--color-primary-light); }
.suggest-text {
  font-size: 14px;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggest-fire { font-size: 12px; flex-shrink: 0; margin-left: 8px; }
.search-error { color: var(--color-danger); font-size: 13px; margin-bottom: 12px; }
.search-layout { display: flex; gap: 30px; }
.search-main { flex: 1; min-width: 0; }
.sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}
.sort-label { font-size: 14px; color: var(--color-text-light); }
.sort-btn {
  padding: 6px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--color-text);
  transition: all var(--transition);
}
.sort-btn:hover { border-color: var(--color-primary); }
.sort-btn.active {
  background: var(--color-gradient-1);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.25);
}
.result-count { margin-left: auto; font-size: 13px; color: var(--color-text-light); }
.articles-grid { display: flex; flex-direction: column; gap: 20px; }

.sidebar { width: 300px; flex-shrink: 0; }
.hot-ranking-card {
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 20px;
}
.ranking-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--color-text);
}
.ranking-loading { text-align: center; padding: 20px; color: var(--color-text-light); font-size: 13px; }
.ranking-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition);
}
.ranking-item:last-child { border-bottom: none; }
.ranking-item:hover { background: var(--color-primary-light); margin: 0 -8px; padding: 10px 8px; border-radius: var(--radius-sm); }
.ranking-num {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-light);
  background: var(--color-bg-alt);
}
.ranking-num.top {
  color: #fff;
  background: var(--color-gradient-2);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}
.ranking-info { flex: 1; min-width: 0; }
.ranking-article-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ranking-stats { display: flex; gap: 10px; font-size: 12px; color: var(--color-text-light); }
.ranking-empty { text-align: center; padding: 20px; color: var(--color-text-light); font-size: 13px; }

@media (max-width: 768px) {
  .search-layout { flex-direction: column; }
  .sidebar { width: 100%; }
}
</style>
