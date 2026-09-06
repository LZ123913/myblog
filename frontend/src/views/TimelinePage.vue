<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'

const router = useRouter()
const bgStore = useBackgroundStore()

const timeline = ref([])
const loading = ref(true)
const error = ref('')

onMounted(() => {
  bgStore.setBackground('/bg-discover.jpg', true)
  loadTimeline()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

async function loadTimeline() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/articles/archive/timeline')
    timeline.value = Array.isArray(data) ? data : (data.items || [])
  } catch (err) {
    error.value = err.message || '加载时间轴失败'
  } finally {
    loading.value = false
  }
}

const groupedTimeline = computed(() => {
  const groups = {}
  timeline.value.forEach(item => {
    const d = new Date(item.published_at || item.created_at)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${year}-${month}`
    if (!groups[key]) groups[key] = { year, month, label: `${year}年${d.getMonth() + 1}月`, items: [] }
    groups[key].items.push(item)
  })
  return Object.values(groups).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return parseInt(b.month) - parseInt(a.month)
  })
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goToArticle(slug) {
  router.push(`/article/${slug}`)
}
</script>

<template>
  <div class="timeline-page">
    <div class="container">
      <h1 class="page-title">时间轴</h1>

      <div v-if="loading" class="loading-state" style="padding: 80px; text-align: center;">
        <span class="loading-spinner"></span> 加载中...
      </div>

      <div v-else-if="error" class="error-state">
        <h3>{{ error }}</h3>
        <button class="btn btn-outline" @click="loadTimeline">重试</button>
      </div>

      <div v-else-if="groupedTimeline.length === 0" class="empty-state">
        <p>暂无文章</p>
      </div>

      <div v-else class="timeline-container">
        <div v-for="group in groupedTimeline" :key="group.label" class="timeline-group">
          <div class="timeline-header">
            <span class="timeline-dot"></span>
            <h2 class="timeline-label">{{ group.label }}</h2>
            <span class="timeline-count">{{ group.items.length }} 篇</span>
          </div>
          <div class="timeline-items">
            <div
              v-for="article in group.items"
              :key="article.id"
              class="timeline-item"
              @click="goToArticle(article.slug)"
            >
              <span class="item-date">{{ formatDate(article.published_at || article.created_at) }}</span>
              <span class="item-title">{{ article.title }}</span>
              <span v-if="article.category_name" class="item-category">{{ article.category_name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-page { padding-top: calc(var(--nav-height) + 20px); }
.page-title { font-size: 24px; font-weight: 600; color: var(--color-text); margin-bottom: 30px; }
.timeline-container { position: relative; padding-left: 20px; }
.timeline-container::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-border);
}
.timeline-group { margin-bottom: 36px; position: relative; }
.timeline-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid var(--color-bg);
  position: absolute;
  left: -20px;
  box-shadow: 0 0 0 2px var(--color-primary);
}
.timeline-label { font-size: 18px; font-weight: 600; color: var(--color-text); }
.timeline-count { font-size: 13px; color: var(--color-text-light); }
.timeline-items { display: flex; flex-direction: column; gap: 10px; }
.timeline-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
}
.timeline-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  transform: translateX(4px);
}
.item-date { font-size: 13px; color: var(--color-text-light); white-space: nowrap; }
.item-title { flex: 1; font-size: 15px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-category { font-size: 12px; color: var(--color-primary); background: var(--color-primary-light); padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
@media (max-width: 768px) {
  .item-title { white-space: normal; }
}
</style>
