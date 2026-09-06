<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'
import ArticleCard from '../components/ArticleCard.vue'

const router = useRouter()
const bgStore = useBackgroundStore()

const recommendations = ref([])
const loading = ref(true)
const error = ref('')
const basedOn = ref(null)

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadRecommendations()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

async function loadRecommendations() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/articles/recommendations')
    recommendations.value = data.items || []
    basedOn.value = data.basedOn || null
  } catch (err) {
    error.value = err.message || '推荐加载失败'
  } finally {
    loading.value = false
  }
}

function goHome() {
  router.push('/')
}

function viewArticle(slug) {
  router.push(`/article/${slug}`)
}
</script>

<template>
  <div class="rec-page">
    <div class="container">
        <div class="rec-header">
          <h1 class="rec-title">✨ 个性化推荐</h1>
          <p class="rec-subtitle" v-if="basedOn">根据您喜欢的标签：{{ basedOn.join('、') }}，为您精选</p>
          <p class="rec-subtitle" v-else>为您推荐以下热门文章</p>
        </div>

        <div v-if="loading" class="loading-state" style="padding: 80px; text-align: center;">
          <span class="loading-spinner"></span> 正在为您挑选...
        </div>

        <div v-else-if="error" class="error-state">
          <h3>{{ error }}</h3>
          <button class="btn btn-outline" @click="goHome">返回首页</button>
        </div>

        <template v-else>
          <div v-if="recommendations.length > 0" class="articles-grid">
            <ArticleCard
              v-for="(article, idx) in recommendations"
              :key="article.id"
              :article="article"
              :index="idx"
              :recommended="true"
            />
          </div>
          <div v-else class="empty-state">
            <p>暂无推荐内容，请先阅读一些文章</p>
          </div>

          <div class="rec-footer">
            <button class="btn btn-outline" @click="goHome">返回首页</button>
          </div>
        </template>
    </div>
  </div>
</template>

<style scoped>
.rec-page { padding-top: calc(var(--nav-height) + 40px); padding-bottom: 60px; }
.rec-header { text-align: center; margin-bottom: 40px; }
.rec-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}
.rec-subtitle {
  font-size: 15px;
  color: var(--color-text-light);
}
.articles-grid { display: flex; flex-direction: column; gap: 20px; max-width: 800px; margin: 0 auto; }
.rec-footer {
  text-align: center;
  margin-top: 40px;
}
.dismissed-state {
  text-align: center;
  padding: 120px 20px;
}
.dismiss-icon {
  font-size: 48px;
  color: var(--color-primary);
  margin-bottom: 16px;
}
.dismissed-state p {
  font-size: 16px;
  color: var(--color-text-light);
}
</style>
