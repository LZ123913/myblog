<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'
import ArticleCard from '../components/ArticleCard.vue'
import InfiniteScroll from '../components/InfiniteScroll.vue'

const route = useRoute()
const bgStore = useBackgroundStore()

const categoryName = ref('')
const articles = ref([])
const pageInfo = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const loading = ref(false)
const loadError = ref('')

onMounted(() => {
  bgStore.setBackground('/bg-cat.jpg', true)
  loadArticles()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

watch(() => route.params.categoryId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    resetData()
    loadArticles()
  }
})

function resetData() {
  articles.value = []
  pageInfo.page = 1
  pageInfo.total = 0
  pageInfo.totalPages = 0
  categoryName.value = ''
}

async function loadArticles() {
  const categoryId = route.params.categoryId
  if (!categoryId || loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.get(`/categories/${categoryId}/articles?page=${pageInfo.page}&pageSize=${pageInfo.pageSize}`)
    const newItems = data.items || data.articles || []
    const existingIds = new Set(articles.value.map(a => a.id))
    const deduped = newItems.filter(a => !existingIds.has(a.id))
    articles.value.push(...deduped)
    pageInfo.total = data.total || 0
    pageInfo.totalPages = data.totalPages || Math.ceil((data.total || 0) / pageInfo.pageSize)
    categoryName.value = data.category_name || data.categoryName || categoryName.value
  } catch (err) {
    loadError.value = err.message || '加载文章失败'
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (pageInfo.page < pageInfo.totalPages) {
    pageInfo.page++
    loadArticles()
  }
}

const hasMore = () => pageInfo.page < pageInfo.totalPages
</script>

<template>
  <div class="topic-browse-page">
    <div class="container">
      <div class="topic-header">
        <h1 class="topic-title">{{ categoryName || '分类浏览' }}</h1>
        <span v-if="pageInfo.total > 0" class="article-count">共 {{ pageInfo.total }} 篇文章</span>
      </div>

      <div v-if="loading && articles.length === 0" class="loading-state" style="padding: 80px; text-align: center;">
        <span class="loading-spinner"></span> 加载中...
      </div>

      <div v-else-if="loadError && articles.length === 0" class="error-state">
        <h3>{{ loadError }}</h3>
        <button class="btn btn-outline" @click="loadArticles">重试</button>
      </div>

      <template v-else>
        <div v-if="articles.length > 0" class="articles-grid">
          <ArticleCard
            v-for="(article, idx) in articles"
            :key="article.id"
            :article="article"
            :index="idx"
          />
        </div>
        <div v-else class="empty-state">
          <p>该分类下暂无文章</p>
        </div>

        <InfiniteScroll
          :has-more="hasMore()"
          :loading="loading"
          :error="loadError"
          @load-more="loadMore"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.topic-browse-page { padding-top: calc(var(--nav-height) + 20px); }
.topic-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
}
.topic-title { font-size: 24px; font-weight: 600; color: var(--color-text); }
.article-count { font-size: 14px; color: var(--color-text-light); }
.articles-grid { display: flex; flex-direction: column; gap: 20px; }
</style>
