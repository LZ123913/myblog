<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'
import { useSiteStore } from '../stores/site'

const bgStore = useBackgroundStore()
const siteStore = useSiteStore()
const authors = ref([])
const projects = ref([])
const loading = ref(true)
const error = ref('')

// 合并站点设置的头像和昵称到作者信息
const displayAuthors = computed(() => {
  if (authors.value.length === 0) {
    return [{
      id: 0,
      name: siteStore.authorName,
      avatar: siteStore.authorAvatar,
      motto: '',
      bio: ''
    }]
  }
  return authors.value.map(author => ({
    ...author,
    name: siteStore.authorName || author.name,
    avatar: siteStore.authorAvatar || author.avatar
  }))
})

onMounted(async () => {
  bgStore.setBackground('/bg-cat.jpg', true)
  await siteStore.loadSettings()
  loadData()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [authorsData, projectsData] = await Promise.all([
      api.get('/authors'),
      api.get('/projects')
    ])
    authors.value = Array.isArray(authorsData) ? authorsData : (authorsData.items || [authorsData])
    projects.value = Array.isArray(projectsData) ? projectsData : (projectsData.items || [])
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="about-page">
    <div class="container">
      <div v-if="loading" class="loading-state" style="padding: 80px; text-align: center;">
        <span class="loading-spinner"></span> 加载中...
      </div>

      <div v-else-if="error" class="error-state">
        <h3>{{ error }}</h3>
        <button class="btn btn-outline" @click="loadData">重试</button>
      </div>

      <template v-else>
        <div v-for="author in displayAuthors" :key="author.id" class="author-card">
          <div class="author-avatar">
            <img v-if="author.avatar" :src="author.avatar" :alt="author.name" />
            <span v-else class="avatar-placeholder">{{ author.name?.charAt(0) }}</span>
          </div>
          <div class="author-info">
            <h1 class="author-name">{{ author.name }}</h1>
            <p v-if="author.motto" class="author-motto">{{ author.motto }}</p>
            <p v-if="author.bio" class="author-bio">{{ author.bio }}</p>
            <a
              v-if="author.github"
              :href="author.github"
              target="_blank"
              rel="noopener noreferrer"
              class="github-link"
            >
              GitHub
            </a>
          </div>
        </div>

        <div class="projects-section">
          <h2 class="section-title">项目</h2>
          <div v-if="projects.length === 0" class="empty-state">
            <p>暂无项目</p>
          </div>
          <div v-else class="projects-grid">
            <a
              v-for="project in projects"
              :key="project.id"
              :href="project.url || project.github"
              target="_blank"
              rel="noopener noreferrer"
              class="project-card"
            >
              <h3 class="project-name">{{ project.name }}</h3>
              <p v-if="project.description" class="project-desc">{{ project.description }}</p>
              <div class="project-footer">
                <span v-if="project.tech_stack" class="tech-stack">{{ project.tech_stack }}</span>
                <span class="github-text">GitHub →</span>
              </div>
            </a>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.about-page { padding-top: calc(var(--nav-height) + 20px); }
.author-card {
  display: flex;
  gap: 30px;
  align-items: center;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 32px;
  margin-bottom: 40px;
  box-shadow: var(--shadow-sm);
}
.author-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.author-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: #fff;
  font-size: 36px;
  font-weight: 600;
}
.author-info { flex: 1; min-width: 0; }
.author-name { font-size: 26px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
.author-motto {
  font-size: 16px;
  color: var(--color-primary);
  margin-bottom: 12px;
  font-style: italic;
}
.author-bio { font-size: 14px; color: var(--color-text-light); line-height: 1.8; }
.github-link {
  display: inline-block;
  margin-top: 12px;
  color: var(--color-primary);
  font-size: 14px;
}
.projects-section { margin-top: 20px; }
.section-title { font-size: 22px; font-weight: 600; color: var(--color-text); margin-bottom: 24px; }
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
.project-card {
  display: block;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 24px;
  transition: all var(--transition);
  text-decoration: none;
}
.project-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: #1F4E79;
}
.project-name { font-size: 18px; font-weight: 600; color: var(--color-text); margin-bottom: 12px; }
.project-desc {
  font-size: 14px;
  color: var(--color-text-light);
  line-height: 1.6;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-footer { display: flex; align-items: center; justify-content: space-between; }
.tech-stack { font-size: 12px; color: var(--color-primary); background: var(--color-primary-light); padding: 2px 10px; border-radius: 4px; }
.github-text { font-size: 13px; color: var(--color-primary); }
@media (max-width: 768px) {
  .author-card { flex-direction: column; text-align: center; }
  .author-avatar { width: 80px; height: 80px; }
}
</style>
