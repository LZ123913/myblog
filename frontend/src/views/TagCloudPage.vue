<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'
import ArticleCard from '../components/ArticleCard.vue'

const router = useRouter()
const bgStore = useBackgroundStore()

const tags = ref([])
const loading = ref(true)
const error = ref('')

const selectedTag = ref('')
const tagArticles = ref([])
const tagLoading = ref(false)
const tagError = ref('')

onMounted(() => {
  bgStore.setBackground('/bg-discover.jpg', true)
  loadTags()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

async function loadTags() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/tags/cloud')
    tags.value = Array.isArray(data) ? data : (data.items || data.tags || [])
  } catch (err) {
    error.value = err.message || '加载标签失败'
  } finally {
    loading.value = false
  }
}

async function selectTag(tagName) {
  selectedTag.value = tagName
  tagArticles.value = []
  tagLoading.value = true
  tagError.value = ''
  try {
    const data = await api.get(`/tags/${encodeURIComponent(tagName)}/articles`)
    tagArticles.value = data.items || data.articles || []
  } catch (err) {
    tagError.value = err.message || '加载文章失败'
  } finally {
    tagLoading.value = false
  }
}

function backToCloud() {
  selectedTag.value = ''
  tagArticles.value = []
}
</script>

<template>
  <div class="tag-cloud-page">
    <div class="container">
      <div v-if="loading" class="loading-state" style="padding: 80px; text-align: center;">
        <span class="loading-spinner"></span> 加载中...
      </div>

      <div v-else-if="error" class="error-state">
        <h3>{{ error }}</h3>
        <button class="btn btn-outline" @click="loadTags">重试</button>
      </div>

      <template v-else>
        <div v-if="!selectedTag" class="tag-cloud">
          <h1 class="page-title">标签归档</h1>
          <div v-if="tags.length === 0" class="empty-state">
            <p>暂无标签</p>
          </div>
          <div v-else class="tags-container">
            <button
              v-for="tag in tags"
              :key="tag.name || tag.id"
              class="tag-pill tag-item"
              :style="{ fontSize: tag.count > 10 ? '16px' : tag.count > 5 ? '14px' : '13px' }"
              @click="selectTag(tag.name)"
            >
              {{ tag.name }}
              <span class="tag-count">{{ tag.count }}</span>
            </button>
          </div>
        </div>

        <div v-else class="tag-articles">
          <div class="tag-header">
            <button class="back-btn" @click="backToCloud">← 返回标签云</button>
            <h2 class="tag-title">标签「{{ selectedTag }}」的文章</h2>
          </div>

          <div v-if="tagLoading" class="loading-state" style="padding: 60px; text-align: center;">
            <span class="loading-spinner"></span> 加载中...
          </div>
          <div v-else-if="tagError" class="error-state">
            <h3>{{ tagError }}</h3>
            <button class="btn btn-outline" @click="selectTag(selectedTag)">重试</button>
          </div>
          <div v-else-if="tagArticles.length === 0" class="empty-state">
            <p>该标签下暂无文章</p>
          </div>
          <div v-else class="articles-grid">
            <ArticleCard
              v-for="(article, idx) in tagArticles"
              :key="article.id"
              :article="article"
              :index="idx"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tag-cloud-page { padding-top: calc(var(--nav-height) + 20px); }
.page-title { font-size: 24px; font-weight: 600; color: var(--color-text); margin-bottom: 30px; }
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; }
.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border: 1px solid var(--color-border);
}
.tag-count {
  font-size: 12px;
  background: rgba(0,0,0,0.06);
  padding: 0 6px;
  border-radius: 10px;
  color: var(--color-text-light);
}
[data-theme="dark"] .tag-count { background: rgba(255,255,255,0.1); }
.tag-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.back-btn {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--color-text);
  transition: all var(--transition);
}
.back-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.tag-title { font-size: 20px; font-weight: 600; color: var(--color-text); }
.articles-grid { display: flex; flex-direction: column; gap: 20px; }
</style>
