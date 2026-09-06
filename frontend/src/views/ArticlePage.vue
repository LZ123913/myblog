<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import html2canvas from 'html2canvas-pro'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useBackgroundStore } from '../stores/background'
import { useSiteStore } from '../stores/site'
import ReadingToolbar from '../components/ReadingToolbar.vue'
import TableOfContents from '../components/TableOfContents.vue'
import CommentSection from '../components/CommentSection.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const bgStore = useBackgroundStore()
const siteStore = useSiteStore()

const article = ref(null)
const loading = ref(true)
const error = ref('')
const liked = ref(false)
const bookmarked = ref(null)
const showShareMenu = ref(false)
const showShareCard = ref(false)
const showBookmarkModal = ref(false)
const summaryLoading = ref(false)
const summaryError = ref(false)
const summaryText = ref('')
const displayedSummary = ref('')
const summaryTyping = ref(false)
let summaryTypingTimer = null

function typeSummary(text) {
  if (summaryTypingTimer) {
    clearInterval(summaryTypingTimer)
    summaryTypingTimer = null
  }
  displayedSummary.value = ''
  summaryTyping.value = true
  let i = 0
  const len = text.length
  const speed = len > 100 ? 20 : 30
  summaryTypingTimer = setInterval(() => {
    if (i < len) {
      displayedSummary.value += text.charAt(i)
      i++
    } else {
      clearInterval(summaryTypingTimer)
      summaryTypingTimer = null
      summaryTyping.value = false
    }
  }, speed)
}

const renderedContent = computed(() => {
  if (!article.value) return ''
  return marked.parse(article.value.content || '')
})

onMounted(async () => {
  // 先淡出hero背景，再切换背景，避免闪烁
  const hasHero = !!bgStore.heroBg
  if (hasHero) {
    bgStore.heroOpacity = 0
    await new Promise(r => setTimeout(r, 500))
    bgStore.heroBg = null
    bgStore.heroOpacity = 1
  }
  await bgStore.setBackground('/bg-default.jpg', true)
  const savedLayout = localStorage.getItem('shiguang-layout')
  if (savedLayout) layoutMode.value = savedLayout
  loadArticle()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
  if (summaryTypingTimer) {
    clearInterval(summaryTypingTimer)
    summaryTypingTimer = null
  }
  if (mottoTypingTimer) {
    clearInterval(mottoTypingTimer)
    mottoTypingTimer = null
  }
})

watch(() => route.params.slug, () => loadArticle())

async function loadArticle() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get(`/articles/${route.params.slug}`)
    article.value = data
    liked.value = data.liked
    bookmarked.value = data.bookmarked

    if (!data.summary) {
      summaryLoading.value = true
      setTimeout(() => {
        const fallback = (data.content || '').slice(0, 100)
        summaryText.value = fallback
        summaryLoading.value = false
        summaryError.value = true
        typeSummary(fallback)
      }, 3500)
    } else {
      summaryText.value = data.summary
      typeSummary(data.summary)
    }
  } catch (err) {
    error.value = err.message || '文章加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleLike() {
  if (!authStore.isLoggedIn) {
    authStore.showLoginModal = true
    return
  }
  if (!article.value) return

  try {
    const data = await api.post(`/articles/${article.value.id}/like`)
    liked.value = data.liked
    article.value.likes = data.likes
  } catch (err) {
    if (err.code === 'loginRequired') {
      authStore.showLoginModal = true
    } else {
      alert(err.message)
    }
  }
}

async function toggleBookmark(privacy) {
  if (!authStore.isLoggedIn) {
    authStore.showLoginModal = true
    return
  }
  if (!article.value) return

  if (bookmarked.value) {
    try {
      const data = await api.post(`/articles/${article.value.id}/bookmark`, { privacy: bookmarked.value.privacy || 'public' })
      bookmarked.value = data.bookmarked
      article.value.bookmarks = data.bookmarks
    } catch (err) {
      alert(err.message)
    }
    return
  }

  if (!privacy) {
    showBookmarkModal.value = true
    return
  }

  try {
    const data = await api.post(`/articles/${article.value.id}/bookmark`, { privacy })
    bookmarked.value = data.bookmarked
    article.value.bookmarks = data.bookmarks
    showBookmarkModal.value = false
  } catch (err) {
    alert(err.message)
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function shareToPlatform(platform) {
  const url = window.location.href
  const title = article.value?.title || '拾光集文章'
  const summary = summaryText.value || ''

  const shareUrls = {
    weibo: `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    qq: `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`,
    wechat: url
  }

  if (platform === 'wechat') {
    if (navigator.share) {
      navigator.share({ title, text: summary, url }).catch(() => {})
    } else {
      copyLink()
    }
  } else {
    window.open(shareUrls[platform], '_blank', 'width=600,height=500')
  }
  showShareMenu.value = false
}

function copyLink() {
  const url = window.location.href
  navigator.clipboard.writeText(url).then(() => {
    alert('链接已复制到剪贴板')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    alert('链接已复制到剪贴板')
  })
}

async function generateShareCard() {
  showShareCard.value = true
  await siteStore.loadSettings()
  startMottoTyping()
}

const cardGenerating = ref(false)
const mottoDisplay = ref('')
let mottoTypingTimer = null

function startMottoTyping() {
  mottoDisplay.value = ''
  if (mottoTypingTimer) clearInterval(mottoTypingTimer)
  const mottoList = siteStore.mottos.length > 0 ? siteStore.mottos : ['记录每一束思想的光']
  const randomMotto = mottoList[Math.floor(Math.random() * mottoList.length)] || '记录每一束思想的光'
  let idx = 0
  mottoTypingTimer = setInterval(() => {
    if (idx < randomMotto.length) {
      mottoDisplay.value = randomMotto.slice(0, idx + 1)
      idx++
    } else {
      clearInterval(mottoTypingTimer)
    }
  }, 80)
}

const layoutMode = ref('standard')
const layoutModes = [
  { id: 'standard', label: '标准', icon: '☰' },
  { id: 'magazine', label: '杂志', icon: '▧' },
  { id: 'minimal', label: '极简', icon: '∥' },
  { id: 'comfortable', label: '舒适', icon: '≋' }
]

function setLayout(mode) {
  layoutMode.value = mode
  localStorage.setItem('shiguang-layout', mode)
}

const cardBackgrounds = [
  { css: 'linear-gradient(135deg, #667eea, #764ba2)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #f093fb, #f5576c)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #4facfe, #00f2fe)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #43e97b, #38f9d7)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #fa709a, #fee140)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #30cfd0, #330867)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #a8edea, #fed6e3)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #ff9a9e, #fad0c4)', type: 'gradient' },
  { css: 'linear-gradient(135deg, #1F4E79, #2E75B6)', type: 'gradient' },
]
const selectedBg = ref(0)
const customBgImage = ref(null)

const cardBgStyle = computed(() => {
  if (customBgImage.value) {
    return { backgroundImage: `url(${customBgImage.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: cardBackgrounds[selectedBg.value].css }
})

function onUploadBg(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    customBgImage.value = ev.target.result
  }
  reader.readAsDataURL(file)
}

async function downloadShareCard() {
  const el = document.getElementById('share-card')
  if (!el) return
  cardGenerating.value = true
  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true })
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    const titlePrefix = (article.value?.title || 'article').substring(0, 10)
    link.download = `拾光集-${titlePrefix}.png`
    link.href = dataUrl
    link.click()
  } catch (err) {
    alert('卡片生成失败：' + err.message)
  } finally {
    cardGenerating.value = false
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

const hasSummary = computed(() => displayedSummary.value && !summaryLoading.value)
</script>

<template>
  <div class="article-page" v-if="article">
    <div class="article-layout">
      <div class="article-main">
        <div class="back-bar">
          <button class="back-btn" @click="goBack">
            <span class="back-icon">←</span> 返回上一步
          </button>
        </div>
        <div class="article-header">
          <h1 class="article-title">{{ article.title }}</h1>
          <div class="article-meta">
            <span>{{ formatDate(article.published_at) }}</span>
            <span v-if="article.category_name">· {{ article.category_name }}</span>
            <div class="article-tags">
              <span v-for="tag in (article.tags || [])" :key="tag" class="tag-pill" @click="$router.push(`/tags?tag=${tag}`)">{{ tag }}</span>
            </div>
          </div>
        </div>

        <div v-if="summaryLoading" class="summary-box loading">
          <span class="loading-spinner"></span> AI 摘要生成中...
        </div>
        <div v-else-if="hasSummary" class="summary-box" :class="{ fallback: summaryError, typing: summaryTyping }">
          <div class="summary-label">
            <span class="summary-icon">✨</span>
            {{ summaryError ? '摘要（前100字）' : 'AI 摘要' }}
          </div>
          <p class="summary-text-content">
            {{ displayedSummary }}<span v-if="summaryTyping" class="typing-cursor"></span>
          </p>
        </div>

        <div class="layout-toolbar">
          <span class="layout-label">排版：</span>
          <button
            v-for="mode in layoutModes"
            :key="mode.id"
            :class="['layout-btn', { active: layoutMode === mode.id }]"
            @click="setLayout(mode.id)"
          >
            <span class="layout-icon">{{ mode.icon }}</span>
            <span class="layout-text">{{ mode.label }}</span>
          </button>
        </div>

        <div class="article-content" :class="`layout-${layoutMode}`" v-html="renderedContent"></div>

        <div class="article-actions">
          <button class="action-btn like-btn" :class="{ active: liked }" @click="toggleLike">
            <span class="icon">♡</span>
            <span>{{ article.likes || 0 }}</span>
          </button>

          <button class="action-btn bookmark-btn" :class="{ active: !!bookmarked }" @click="toggleBookmark()">
            <span class="icon">★</span>
            <span>{{ article.bookmarks || 0 }}</span>
          </button>

          <button class="action-btn" @click="showShareMenu = !showShareMenu">
            <span class="icon">↗</span> 分享
          </button>

          <button class="action-btn" @click="generateShareCard">
            <span class="icon">🖼</span> 分享卡片
          </button>
        </div>

        <div v-if="showShareMenu" class="share-menu">
          <button @click="shareToPlatform('wechat')">微信</button>
          <button @click="shareToPlatform('weibo')">微博</button>
          <button @click="shareToPlatform('qq')">QQ</button>
          <button @click="copyLink">复制链接</button>
        </div>

        <CommentSection :article-id="article.id" />
      </div>

      <div class="article-toc">
        <TableOfContents :content="renderedContent" />
      </div>
    </div>

    <ReadingToolbar />

    <div v-if="showBookmarkModal" class="modal-overlay" @click.self="showBookmarkModal = false">
      <div class="modal-content bookmark-modal">
        <button class="close-btn" @click="showBookmarkModal = false">×</button>
        <h2>选择收藏方式</h2>
        <p class="modal-desc">选择这篇文章的收藏可见性</p>
        <div class="bookmark-choices">
          <button class="bookmark-choice" @click="toggleBookmark('public')">
            <span class="choice-icon">🌍</span>
            <span class="choice-label">公开收藏</span>
            <span class="choice-desc">其他人可以看到你的收藏</span>
          </button>
          <button class="bookmark-choice" @click="toggleBookmark('private')">
            <span class="choice-icon">🔒</span>
            <span class="choice-label">私密收藏</span>
            <span class="choice-desc">仅你自己可见</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showShareCard" class="modal-overlay" @click.self="showShareCard = false">
      <div class="modal-content share-card-modal">
        <button class="close-btn" @click="showShareCard = false">×</button>
        <h2>生成分享卡片</h2>
        <div class="bg-selector">
          <span class="bg-label">选择背景：</span>
          <div class="bg-options">
            <button
              v-for="(bg, idx) in cardBackgrounds"
              :key="idx"
              class="bg-option"
              :class="{ active: selectedBg === idx }"
              :style="{ background: bg.css }"
              @click="selectedBg = idx"
            ></button>
            <label class="bg-option upload-bg">
              <span>+</span>
              <input type="file" accept="image/*" @change="onUploadBg" hidden />
            </label>
          </div>
        </div>
        <div class="card-preview" id="share-card">
          <div class="card-bg" :style="cardBgStyle">
            <div class="card-content">
              <div class="card-author">
                <img :src="siteStore.authorAvatar" class="card-avatar" />
                <div class="card-author-info">
                  <div class="card-blog-name">{{ siteStore.blogName }}</div>
                  <div class="card-motto">
                    <span>{{ mottoDisplay }}</span>
                    <span class="typing-cursor">|</span>
                  </div>
                </div>
              </div>
              <h3 class="card-title">{{ article.title }}</h3>
              <p class="card-summary">{{ summaryText }}</p>
              <div class="card-tags">
                <span v-for="tag in (article.tags || []).slice(0, 3)" :key="tag">#{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" @click="downloadShareCard" :disabled="cardGenerating">
            {{ cardGenerating ? '生成中...' : '下载图片' }}
          </button>
          <button class="btn btn-outline" @click="showShareCard = false">取消</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="loading" class="loading-state" style="padding: 80px; text-align: center;">
    <span class="loading-spinner"></span> 文章加载中...
  </div>

  <div v-else-if="error" class="error-state" style="padding: 80px 20px; text-align: center;">
    <h3>{{ error }}</h3>
    <button class="btn btn-outline" @click="$router.push('/')">返回首页</button>
  </div>
</template>

<style scoped>
.article-page { padding-top: calc(var(--nav-height) + 20px); }
.back-bar { margin-bottom: 16px; }
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-solid);
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition);
}
.back-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.back-icon { font-size: 16px; font-weight: 600; }
.article-layout { display: flex; gap: 30px; max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.article-main {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 32px 36px;
  box-shadow: var(--shadow-md);
}
.article-toc { width: 240px; flex-shrink: 0; align-self: flex-start; position: sticky; top: calc(var(--nav-height) + 20px); max-height: calc(100vh - var(--nav-height) - 40px); overflow-y: auto; }
.article-header { margin-bottom: 24px; }
.article-title { font-size: 28px; font-weight: 700; color: var(--color-text); line-height: 1.4; margin-bottom: 12px; }
.article-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; color: var(--color-text-light); font-size: 14px; }
.article-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.summary-box {
  border-left: 4px solid var(--color-primary);
  background: var(--color-primary-light);
  padding: 16px 20px;
  margin-bottom: 24px;
  border-radius: 0 var(--radius) var(--radius) 0;
  position: relative;
  overflow: hidden;
}
.summary-box::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle at top right, rgba(0, 212, 255, 0.12), transparent 70%);
  pointer-events: none;
}
.summary-box.loading { display: flex; align-items: center; gap: 8px; color: var(--color-text-light); }
.summary-box.fallback { border-left-color: var(--color-warning); background: #FFF8E6; }
.summary-box.typing {
  animation: summaryGlow 2s ease-in-out infinite;
}
@keyframes summaryGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
  50% { box-shadow: 0 0 20px 2px rgba(0, 212, 255, 0.15); }
}
.summary-label { font-size: 13px; font-weight: 600; color: var(--color-primary); margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
.summary-icon { font-size: 14px; }
.summary-text-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text);
}
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursorBlink 0.8s step-end infinite;
}
@keyframes cursorBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.article-content { font-size: 16px; line-height: 1.8; color: var(--color-text); transition: all 0.3s ease; }

.layout-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  padding: 10px 14px;
  background: var(--color-bg-alt);
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
}
.layout-label { font-size: 13px; color: var(--color-text-light); font-weight: 600; margin-right: 4px; }
.layout-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 13px;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all var(--transition);
}
.layout-btn:hover { color: var(--color-primary); background: var(--color-bg-solid); }
.layout-btn.active {
  color: #fff;
  background: var(--color-gradient-1);
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.25);
}
.layout-icon { font-size: 15px; }

.article-content.layout-standard { font-size: 16px; line-height: 1.8; }
.article-content.layout-standard :deep(h2) { font-size: 22px; margin: 28px 0 16px; padding-top: 20px; border-top: 1px solid var(--color-border); }
.article-content.layout-standard :deep(p) { margin-bottom: 16px; }

.article-content.layout-magazine { font-size: 17px; line-height: 2; font-family: 'Georgia', 'Noto Serif SC', serif; }
.article-content.layout-magazine :deep(h2) { font-size: 26px; margin: 36px 0 20px; text-align: center; border-top: 2px solid var(--color-primary); border-bottom: 2px solid var(--color-primary); padding: 12px 0; }
.article-content.layout-magazine :deep(h3) { font-size: 20px; margin: 28px 0 14px; border-left: 4px solid var(--color-accent); padding-left: 12px; }
.article-content.layout-magazine :deep(p) { margin-bottom: 20px; text-indent: 2em; }
.article-content.layout-magazine :deep(blockquote) { border-left: 4px solid var(--color-accent); margin: 24px 0; padding: 16px 20px; background: var(--color-bg-alt); border-radius: 0 var(--radius) var(--radius) 0; font-style: italic; }

.article-content.layout-minimal { font-size: 15px; line-height: 1.9; max-width: 680px; margin: 0 auto; }
.article-content.layout-minimal :deep(h2) { font-size: 18px; margin: 32px 0 12px; text-transform: uppercase; letter-spacing: 2px; color: var(--color-text-light); }
.article-content.layout-minimal :deep(h3) { font-size: 16px; margin: 24px 0 10px; }
.article-content.layout-minimal :deep(p) { margin-bottom: 14px; }
.article-content.layout-minimal :deep(pre) { font-size: 13px; }

.article-content.layout-comfortable { font-size: 18px; line-height: 2.2; }
.article-content.layout-comfortable :deep(h2) { font-size: 24px; margin: 36px 0 20px; color: var(--color-primary); }
.article-content.layout-comfortable :deep(h3) { font-size: 20px; margin: 28px 0 16px; color: var(--color-accent); }
.article-content.layout-comfortable :deep(p) { margin-bottom: 24px; }
.article-content.layout-comfortable :deep(blockquote) { border-left: 4px solid var(--color-primary); padding: 16px 24px; margin: 24px 0; background: var(--color-primary-light); border-radius: var(--radius); }
.article-content :deep(h2) { font-size: 22px; margin: 28px 0 16px; padding-top: 20px; border-top: 1px solid var(--color-border); }
.article-content :deep(h3) { font-size: 18px; margin: 24px 0 12px; }
.article-content :deep(p) { margin-bottom: 16px; }
.article-content :deep(pre) { background: var(--color-bg-alt); padding: 16px; border-radius: var(--radius); overflow-x: auto; }
.article-content :deep(code) { font-family: 'Fira Code', monospace; font-size: 14px; }
.article-content :deep(ul), .article-content :deep(ol) { margin-bottom: 16px; padding-left: 24px; }
.article-content :deep(blockquote) { border-left: 3px solid var(--color-primary); padding-left: 16px; color: var(--color-text-light); margin-bottom: 16px; }
.article-content :deep(img) { max-width: 100%; border-radius: var(--radius); }
.article-actions { display: flex; gap: 16px; padding: 24px 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); margin: 32px 0; }
.action-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 14px; color: var(--color-text); cursor: pointer; transition: all var(--transition); }
.action-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.action-btn.active.like-btn { color: var(--color-accent); border-color: var(--color-accent); }
.action-btn.active.bookmark-btn { color: var(--color-warning); border-color: var(--color-warning); }
.action-btn .icon { font-size: 18px; }
.bookmark-wrapper { position: relative; }
.bookmark-options { position: absolute; top: 100%; left: 0; background: var(--color-bg-solid); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 4px; padding: 8px; white-space: nowrap; z-index: 10; }
.bookmark-options button { padding: 6px 12px; font-size: 13px; text-align: left; border-radius: 4px; }
.bookmark-options button:hover { background: var(--color-bg-alt); }
.bookmark-modal { max-width: 380px; text-align: center; }
.bookmark-modal h2 { margin-bottom: 8px; }
.modal-desc { font-size: 14px; color: var(--color-text-light); margin-bottom: 20px; }
.bookmark-choices { display: flex; flex-direction: column; gap: 12px; }
.bookmark-choice {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 20px; border: 2px solid var(--color-border-solid); border-radius: var(--radius-lg);
  cursor: pointer; transition: all var(--transition); background: var(--color-bg-solid);
}
.bookmark-choice:hover { border-color: var(--color-primary); background: var(--color-primary-light); }
.choice-icon { font-size: 28px; }
.choice-label { font-size: 16px; font-weight: 600; color: var(--color-text); }
.choice-desc { font-size: 12px; color: var(--color-text-light); }
.share-menu { display: flex; gap: 12px; padding: 12px 0; }
.share-menu button { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 14px; }
.share-menu button:hover { border-color: var(--color-primary); color: var(--color-primary); }
.share-card-modal { max-width: 500px; }
.bg-selector { margin: 16px 0; }
.bg-label { font-size: 13px; color: var(--color-text-light); display: block; margin-bottom: 8px; }
.bg-options { display: flex; gap: 8px; flex-wrap: wrap; }
.bg-option {
  width: 40px; height: 40px; border-radius: var(--radius); cursor: pointer;
  border: 2px solid transparent; transition: all var(--transition);
}
.bg-option.active { border-color: var(--color-primary); transform: scale(1.1); }
.bg-option.upload-bg {
  display: flex; align-items: center; justify-content: center;
  border: 2px dashed var(--color-border-solid); color: var(--color-text-light);
  font-size: 20px;
}
.bg-option.upload-bg:hover { border-color: var(--color-primary); color: var(--color-primary); }
.card-preview { margin: 20px 0; }
.card-bg {
  border-radius: 16px;
  padding: 36px 32px;
  min-height: 340px;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.card-bg::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%);
  border-radius: 50%;
}
.card-bg::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%);
  border-radius: 50%;
}
.card-content {
  text-align: center;
  color: #fff;
  width: 100%;
  position: relative;
  z-index: 1;
}
.card-author {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.card-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255,255,255,0.5);
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}
.card-author-info { text-align: left; }
.card-blog-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}
.card-motto {
  font-size: 12px;
  opacity: 0.85;
  font-style: italic;
  min-height: 16px;
}
.typing-cursor {
  display: inline-block;
  margin-left: 2px;
  animation: mottoBlink 0.8s step-end infinite;
}
@keyframes mottoBlink {
  50% { opacity: 0; }
}
.card-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  line-height: 1.4;
  text-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.card-summary {
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.7;
  margin-bottom: 20px;
}
.card-tags {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}
.card-tags span {
  padding: 4px 12px;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
}
.card-actions { display: flex; gap: 12px; justify-content: center; }
.close-btn { position: absolute; top: 12px; right: 16px; font-size: 24px; color: var(--color-text-light); }
@media (max-width: 768px) {
  .article-layout { flex-direction: column; }
  .article-toc { width: 100%; }
  .article-title { font-size: 22px; }
}
</style>
