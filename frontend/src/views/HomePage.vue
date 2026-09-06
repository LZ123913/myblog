<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useBackgroundStore } from '../stores/background'
import ArticleCard from '../components/ArticleCard.vue'
import InfiniteScroll from '../components/InfiniteScroll.vue'
import InterestSelectModal from '../components/InterestSelectModal.vue'

const router = useRouter()
const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const heroBackgrounds = [
  { id: 'spring', label: '春', url: '/hero-spring.jpg' },
  { id: 'summer', label: '夏', url: '/hero-summer.jpg' },
  { id: 'autumn', label: '秋', url: '/hero-autumn.jpg' },
  { id: 'winter', label: '冬', url: '/hero-winter.jpg' }
]

const isLeaving = ref(false)

let revealObserver = null
let returnWheelHandler = null
let upSwipeCount = 0
let upSwipeTimer = null
let cooldownTimer = null
const swipeHint = ref('')

const announcement = ref(null)
const searchQuery = ref('')
const searchError = ref('')

const articles = ref([])
const pageInfo = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
const loading = ref(false)
const loadError = ref('')

const hotArticles = ref([])
const categories = ref([])
const tags = ref([])

const cardLayout = ref('list')
const cardLayouts = [
  { id: 'list', label: '列表', icon: '☰' },
  { id: 'grid', label: '网格', icon: '▦' },
  { id: 'compact', label: '紧凑', icon: '≣' },
  { id: 'card', label: '卡片', icon: '❏' }
]

function setCardLayout(mode) {
  if (mode === cardLayout.value) return
  cardLayout.value = mode
  localStorage.setItem('shiguang-card-layout', mode)
}

const subEmail = ref('')
const subMessage = ref('')
const subLoading = ref(false)

const showInterestModal = ref(false)
const userInterests = ref([])
const recommendedArticles = ref([])
const recommendedBasedOn = ref(null)
const recLoading = ref(false)

const searchSuggestions = ref([])
const showSearchSuggestions = ref(false)
let suggestTimer = null

async function loadDefaultSuggestions() {
  try {
    const data = await api.get('/articles?sortBy=hot&page=1&pageSize=6')
    searchSuggestions.value = (data.items || []).map(a => {
      const raw = (a.likes || 0) * 2 + (a.bookmarks || 0) * 3 + (a.views || 0)
      const daysSince = (Date.now() - new Date(a.published_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
      const score = Math.round(raw * (1 / (1 + daysSince / 30)))
      return { ...a, hotScore: score, fireLevel: score >= 80 ? 3 : score >= 40 ? 2 : score >= 15 ? 1 : 0 }
    })
  } catch {}
}

function onHomeSearchInput() {
  const q = searchQuery.value.trim()
  if (suggestTimer) clearTimeout(suggestTimer)
  if (q.length < 1) {
    showSearchSuggestions.value = searchSuggestions.value.length > 0
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      const data = await api.get(`/search/suggestions?q=${encodeURIComponent(q)}`)
      searchSuggestions.value = data.items || []
      showSearchSuggestions.value = searchSuggestions.value.length > 0
    } catch {}
  }, 300)
}

function onHomeSearchFocus() {
  if (searchQuery.value.trim().length < 1) {
    showSearchSuggestions.value = searchSuggestions.value.length > 0
  }
}

function hideHomeSuggestions() {
  setTimeout(() => { showSearchSuggestions.value = false }, 200)
}

function selectHomeSuggestion(item) {
  if (item.slug) {
    router.push(`/article/${item.slug}`)
  } else {
    searchQuery.value = item.title
    handleSearch()
  }
  showSearchSuggestions.value = false
}

function fireText(level) {
  return ['', '🔥', '🔥🔥', '🔥🔥🔥'][level] || ''
}

async function loadRecommendedArticles() {
  if (userInterests.value.length === 0) return
  recLoading.value = true
  try {
    const excludeIds = recommendedArticles.value.map(a => a.id)
    const params = new URLSearchParams()
    params.set('tags', userInterests.value.join(','))
    if (excludeIds.length > 0) {
      params.set('exclude', JSON.stringify(excludeIds))
    }
    let data = await api.get(`/articles/recommendations?${params.toString()}`)
    // If excluding current items returns nothing, retry without exclude
    if ((!data.items || data.items.length === 0) && excludeIds.length > 0) {
      const retryParams = new URLSearchParams()
      retryParams.set('tags', userInterests.value.join(','))
      data = await api.get(`/articles/recommendations?${retryParams.toString()}`)
    }
    if (data.items && data.items.length > 0) {
      recommendedArticles.value = data.items
      recommendedBasedOn.value = data.basedOn
    } else {
      recommendedArticles.value = []
      recommendedBasedOn.value = null
    }
  } catch {}
  recLoading.value = false
}

function handleInterestConfirm(tags) {
  userInterests.value = tags
  localStorage.setItem('shiguang-interests', JSON.stringify(tags))
  showInterestModal.value = false
  loadRecommendedArticles()
}

function handleInterestSkip() {
  localStorage.setItem('shiguang-interests-skip', '1')
  showInterestModal.value = false
}

function reopenInterestModal() {
  showInterestModal.value = true
}

function clearInterests() {
  userInterests.value = []
  recommendedArticles.value = []
  recommendedBasedOn.value = null
  localStorage.removeItem('shiguang-interests')
  localStorage.removeItem('shiguang-interests-skip')
  showInterestModal.value = true
}

const maxTagUsage = computed(() => {
  if (tags.value.length === 0) return 1
  return Math.max(...tags.value.map(t => t.usage_count || 1))
})

const tagColors = ['#6C5CE7', '#FF6B6B', '#00B894', '#FDCB6E', '#0984E3', '#E84393', '#00CEC9', '#E17055']

function getTagStyle(tag) {
  const usage = tag.usage_count || 1
  const ratio = usage / maxTagUsage.value
  const fontSize = 12 + ratio * 10
  const colorIdx = (tag.name?.charCodeAt(0) || 0) % tagColors.length
  return {
    fontSize: `${fontSize}px`,
    color: tagColors[colorIdx],
    opacity: 0.65 + ratio * 0.35
  }
}

onMounted(() => {
  const savedLayout = localStorage.getItem('shiguang-card-layout')
  if (savedLayout) cardLayout.value = savedLayout
  bgStore.setBackground('/bg-default.jpg', true)
  loadAnnouncement()
  loadArticles()
  loadHotArticles()
  loadCategories()
  loadTags()
  loadDefaultSuggestions()

  // Interest-based recommendations
  const savedInterests = localStorage.getItem('shiguang-interests')
  const interestSkip = localStorage.getItem('shiguang-interests-skip')
  if (savedInterests) {
    try {
      userInterests.value = JSON.parse(savedInterests)
      if (userInterests.value.length > 0) {
        loadRecommendedArticles()
      }
    } catch {}
  } else if (!interestSkip) {
    setTimeout(() => {
      showInterestModal.value = true
    }, 800)
  }
  // Detect scroll up at top to return to splash (requires 3 consecutive swipes)
  returnWheelHandler = (e) => {
    if (window.scrollY <= 0 && e.deltaY < 0 && !isLeaving.value && !cooldownTimer) {
      upSwipeCount++
      if (upSwipeTimer) clearTimeout(upSwipeTimer)
      swipeHint.value = `再上滑 ${3 - upSwipeCount} 次返回初始页`
      upSwipeTimer = setTimeout(() => {
        upSwipeCount = 0
        swipeHint.value = ''
      }, 1500)
      if (upSwipeCount >= 3) {
        upSwipeCount = 0
        swipeHint.value = ''
        returnToSplash()
      }
    }
  }
  window.addEventListener('wheel', returnWheelHandler, { passive: true })
  // Set cooldown after arriving from splash
  cooldownTimer = setTimeout(() => {
    cooldownTimer = null
  }, 2000)
  nextTick(() => {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target
          const delay = parseInt(el.dataset.revealDelay || '0')
          setTimeout(() => {
            el.classList.add('visible')
            el.classList.add('is-visible')
          }, delay)
          revealObserver.unobserve(el)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px 200px 0px' })
    observeRevealElements()
  })
})

function observeRevealElements() {
  nextTick(() => {
    if (!revealObserver) return
    const vh = window.innerHeight
    document.querySelectorAll('.reveal:not(.visible), .card-enter:not(.is-visible)').forEach(el => {
      const rect = el.getBoundingClientRect()
      // 如果元素已经在视口内（或接近视口），直接显示
      if (rect.top < vh - 50) {
        const delay = parseInt(el.dataset.revealDelay || '0')
        setTimeout(() => {
          el.classList.add('visible')
          el.classList.add('is-visible')
        }, delay)
      } else {
        revealObserver.observe(el)
      }
    })
  })
}

function returnToSplash() {
  if (isLeaving.value) return
  isLeaving.value = true

  const savedHeroBg = localStorage.getItem('shiguang-hero-bg')
  if (savedHeroBg) {
    const bg = heroBackgrounds.find(b => b.id === savedHeroBg)
    if (bg) {
      // 先设置hero背景（opacity为0），然后淡入
      bgStore.heroBg = bg.url
      bgStore.heroOpacity = 0
      bgStore.isLightBg = true
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bgStore.heroOpacity = 1
        })
      })
      // hero淡入500ms后就跳转，和页面切换重叠，视觉上更连贯
      setTimeout(() => router.push('/'), 500)
      return
    }
  }
  // 没有保存的hero背景，直接跳转
  setTimeout(() => router.push('/'), 400)
}

onUnmounted(() => {
  if (revealObserver) revealObserver.disconnect()
  if (returnWheelHandler) window.removeEventListener('wheel', returnWheelHandler)
  if (upSwipeTimer) clearTimeout(upSwipeTimer)
  if (cooldownTimer) clearTimeout(cooldownTimer)
  cleanupParticles()
})

// 离开首页前先淡出hero背景，避免跳转到其他页面时hero瞬间消失
// 返回初始页（/）时不需要淡出，因为returnToSplash已经处理了淡入
onBeforeRouteLeave(async (to, from, next) => {
  if (to.path === '/') {
    // 返回初始页，不淡出（由returnToSplash处理淡入）
    next()
    return
  }
  if (bgStore.heroBg && bgStore.heroOpacity > 0) {
    bgStore.heroOpacity = 0
    // 等400ms让淡出动画播放一部分再跳转
    await new Promise(r => setTimeout(r, 400))
  }
  next()
})

async function loadHotArticles() {
  try {
    const data = await api.get('/articles?sortBy=hot&page=1&pageSize=5')
    hotArticles.value = data.items || []
  } catch {}
}

async function loadCategories() {
  try {
    const data = await api.get('/categories')
    categories.value = data.items || data || []
  } catch {}
}

async function loadTags() {
  try {
    const data = await api.get('/tags')
    tags.value = (data.items || data || []).sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 20)
  } catch {}
}

async function loadAnnouncement() {
  try {
    const data = await api.get('/announcements/latest')
    if (data) {
      const dismissed = JSON.parse(localStorage.getItem('shiguang-announcement-dismissed') || '{}')
      if (dismissed.id === data.id) {
        const dismissedTime = new Date(dismissed.time).getTime()
        if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) return
      }
      announcement.value = data
    }
  } catch {}
}

function dismissAnnouncement() {
  if (announcement.value) {
    localStorage.setItem('shiguang-announcement-dismissed', JSON.stringify({
      id: announcement.value.id,
      time: new Date().toISOString()
    }))
    announcement.value = null
  }
}

function handleSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 1) {
    searchError.value = '请输入至少 1 个字符'
    return
  }
  searchError.value = ''
  router.push({ path: '/search', query: { q, sortBy: 'hot' } })
}

async function loadArticles() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.get(`/articles?page=${pageInfo.page}&pageSize=${pageInfo.pageSize}`)
    const newItems = data.items
    const existingIds = new Set(articles.value.map(a => a.id))
    const deduped = newItems.filter(a => !existingIds.has(a.id))
    articles.value.push(...deduped)
    pageInfo.total = data.total
    pageInfo.totalPages = data.totalPages
    observeRevealElements()
  } catch (err) {
    loadError.value = err.message || '加载失败'
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

async function subscribe() {
  if (!subEmail.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    subMessage.value = '邮箱格式不合法'
    return
  }
  subLoading.value = true
  try {
    const data = await api.post('/subscriptions', { email: subEmail.value })
    subMessage.value = data.message
    if (data.status === 'already_subscribed') {
      subMessage.value = '您已订阅'
    } else {
      subMessage.value = '订阅成功，请查收验证邮件'
    }
    subEmail.value = ''
  } catch (err) {
    subMessage.value = err.message
  } finally {
    subLoading.value = false
  }
}

// ===== 粒子破碎效果 =====
const particleCanvas = ref(null)
const isShattering = ref(false)
let particles = []
let particleAnimId = null
let particleCtx = null

function handleCardClick({ article, element }) {
  if (isShattering.value) return
  shatterAndNavigate(article.slug, element)
}

function shatterAndNavigate(slug, clickedElement) {
  isShattering.value = true

  const canvas = particleCanvas.value
  if (!canvas) {
    router.push(`/article/${slug}`)
    return
  }

  // 冻结滚动，防止页面上滚
  document.body.style.overflow = 'hidden'

  const ctx = canvas.getContext('2d')
  particleCtx = ctx
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  // 找到所有文章卡片
  const allCards = document.querySelectorAll('.articles-grid .article-card-wrapper')
  particles = []

  allCards.forEach((card, cardIdx) => {
    const rect = card.getBoundingClientRect()
    const isClicked = card === clickedElement || card.contains(clickedElement)

    // 被点击的卡片不破碎
    if (isClicked) return

    // 每个卡片生成 12-18 个粒子，少而精
    const particleCount = 12 + Math.floor(Math.random() * 6)
    for (let i = 0; i < particleCount; i++) {
      const px = rect.left + Math.random() * rect.width
      const py = rect.top + Math.random() * rect.height
      const size = 8 + Math.random() * 10
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 8
      const delay = cardIdx * 20 + Math.random() * 60

      particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        opacity: 1,
        delay,
        started: false,
        type: Math.floor(Math.random() * 3) // 0=paw, 1=bone, 2=dot
      })
    }

    // 卡片快速淡出缩小
    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
    card.style.opacity = '0'
    card.style.transform = 'scale(0.92)'
  })

  let startTime = null
  let hasNavigated = false
  const NAV_DELAY = 500 // 500ms 后跳转，不用等粒子全消失

  function animate(timestamp) {
    if (!startTime) startTime = timestamp
    const elapsed = timestamp - startTime

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const p of particles) {
      if (elapsed < p.delay) continue
      p.started = true

      p.vy += 0.25
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.opacity -= 0.015

      if (p.opacity <= 0) continue

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      if (p.type === 0) {
        // 狗爪印
        drawPaw(ctx, p.size)
      } else if (p.type === 1) {
        // 小骨头
        drawBone(ctx, p.size)
      } else {
        // 小圆点
        ctx.fillStyle = 'rgba(255, 180, 100, 0.9)'
        ctx.beginPath()
        ctx.arc(0, 0, p.size * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    // 到时间就跳转，不等粒子消失
    if (elapsed >= NAV_DELAY && !hasNavigated) {
      hasNavigated = true
      router.push(`/article/${slug}`)
    }

    if (elapsed < 1200) {
      particleAnimId = requestAnimationFrame(animate)
    } else if (!hasNavigated) {
      hasNavigated = true
      router.push(`/article/${slug}`)
    }
  }

  particleAnimId = requestAnimationFrame(animate)
}

// 画狗爪印
function drawPaw(ctx, size) {
  const s = size * 0.5
  ctx.fillStyle = 'rgba(255, 150, 80, 0.85)'
  // 掌垫
  ctx.beginPath()
  ctx.ellipse(0, s * 0.3, s * 0.5, s * 0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  // 四个脚趾
  const toePositions = [
    [-s * 0.55, -s * 0.15],
    [-s * 0.2, -s * 0.45],
    [s * 0.2, -s * 0.45],
    [s * 0.55, -s * 0.15]
  ]
  for (const [tx, ty] of toePositions) {
    ctx.beginPath()
    ctx.ellipse(tx, ty, s * 0.18, s * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 画小骨头
function drawBone(ctx, size) {
  const s = size * 0.5
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  // 中间杆
  ctx.fillRect(-s * 0.6, -s * 0.15, s * 1.2, s * 0.3)
  // 两端圆头
  ctx.beginPath()
  ctx.arc(-s * 0.6, -s * 0.2, s * 0.2, 0, Math.PI * 2)
  ctx.arc(-s * 0.6, s * 0.2, s * 0.2, 0, Math.PI * 2)
  ctx.arc(s * 0.6, -s * 0.2, s * 0.2, 0, Math.PI * 2)
  ctx.arc(s * 0.6, s * 0.2, s * 0.2, 0, Math.PI * 2)
  ctx.fill()
}

function cleanupParticles() {
  if (particleAnimId) {
    cancelAnimationFrame(particleAnimId)
    particleAnimId = null
  }
  particles = []
  isShattering.value = false
  document.body.style.overflow = ''
}
</script>

<template>
  <div class="home-page" :class="{ leaving: isLeaving }">
    <div class="swipe-hint-bar" :class="{ show: swipeHint }">{{ swipeHint }}</div>
    <!-- Content Area -->
    <div id="home-content" class="content-wrap">
      <div v-if="announcement" class="announcement-bar">
        <div class="container announcement-inner">
          <span class="announcement-label">公告</span>
          <span class="announcement-content">{{ announcement.content }}</span>
          <button class="close-btn" @click="dismissAnnouncement">×</button>
        </div>
      </div>

      <div class="container content-area">
        <div class="home-layout">
          <div class="articles-section">
            <!-- Interest-based recommendations -->
            <div v-if="recommendedArticles.length > 0" class="recommend-section recommend-fade-in">
              <div class="recommend-header">
                <h3 class="recommend-title">
                  <span class="recommend-icon">✨</span> 为你推荐
                </h3>
                <div class="recommend-actions">
                  <button class="recommend-refresh-btn" @click="loadRecommendedArticles" :disabled="recLoading">
                    <span :class="{ 'spin': recLoading }">↻</span> 换一批
                  </button>
                  <button class="recommend-edit-btn" @click="reopenInterestModal">管理兴趣</button>
                  <button class="recommend-clear-btn" @click="clearInterests">×</button>
                </div>
              </div>
              <p v-if="recommendedBasedOn" class="recommend-based-on">
                根据你选择的兴趣：{{ recommendedBasedOn.join('、') }}
              </p>
              <div class="recommend-grid">
                <div
                  v-for="(article, idx) in recommendedArticles.slice(0, 6)"
                  :key="'rec-' + article.id"
                  class="recommend-card"
                  @click="router.push(`/article/${article.slug}`)"
                >
                  <div class="recommend-cover" v-if="article.cover_image">
                    <img :src="article.cover_image" :alt="article.title" />
                  </div>
                  <div class="recommend-info">
                    <h4 class="recommend-card-title">{{ article.title }}</h4>
                    <p class="recommend-summary">{{ article.summary }}</p>
                    <div class="recommend-meta">
                      <span>♡ {{ article.likes || 0 }}</span>
                      <span>👁 {{ article.views || 0 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section-header reveal">
              <h2 class="section-title">
                <span class="section-icon">✦</span> 最新文章
              </h2>
              <div class="card-layout-switch">
                <button
                  v-for="mode in cardLayouts"
                  :key="mode.id"
                  :class="['layout-toggle-btn', { active: cardLayout === mode.id }]"
                  @click="setCardLayout(mode.id)"
                  :title="mode.label"
                >{{ mode.icon }}</button>
              </div>
            </div>
            <div :class="['articles-grid', `layout-${cardLayout}`]">
              <ArticleCard
                v-for="(article, idx) in articles"
                :key="article.id"
                :article="article"
                :layout="cardLayout"
                :index="idx"
                :custom-click="true"
                @card-click="handleCardClick"
              />
            </div>
            <InfiniteScroll
              :has-more="hasMore()"
              :loading="loading"
              :error="loadError"
              @load-more="loadMore"
            />
          </div>

          <aside class="sidebar">
          <div class="sidebar-card search-card reveal reveal-delay-1">
            <h3 class="card-title"><span>🔍</span> 搜索文章</h3>
            <div class="search-box">
              <div class="search-input-wrapper">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="输入关键词..."
                  class="search-input"
                  @keyup.enter="handleSearch"
                  @input="onHomeSearchInput"
                  @focus="onHomeSearchFocus"
                  @blur="hideHomeSuggestions"
                />
                <div v-if="showSearchSuggestions" class="suggestions-dropdown">
                  <div class="suggest-header">{{ searchQuery.trim().length < 1 ? '🔥 热门推荐' : '搜索结果' }}</div>
                  <div
                    v-for="s in searchSuggestions"
                    :key="s.slug"
                    class="suggest-item"
                    @mousedown.prevent="selectHomeSuggestion(s)"
                  >
                    <span class="suggest-text">{{ s.title }}</span>
                    <span v-if="s.fireLevel > 0" class="suggest-fire">{{ fireText(s.fireLevel) }}</span>
                  </div>
                </div>
              </div>
              <button class="btn btn-primary search-btn" @click="handleSearch">搜索</button>
            </div>
            <div v-if="searchError" class="search-error">{{ searchError }}</div>
          </div>

          <div v-if="userInterests.length === 0 && recommendedArticles.length === 0" class="sidebar-card rec-card" @click="reopenInterestModal">
            <div class="rec-icon">✨</div>
            <h3>个性化推荐</h3>
            <p>选择感兴趣的标签，获取精准推荐</p>
            <span class="rec-link">立即设置 →</span>
          </div>

          <div class="sidebar-card hot-card reveal reveal-delay-3">
            <h3 class="card-title"><span>🔥</span> 最火排行榜</h3>
            <div v-if="hotArticles.length > 0" class="hot-list">
              <div
                v-for="(article, index) in hotArticles"
                :key="article.id"
                class="hot-item"
                @click="$router.push(`/article/${article.slug}`)"
              >
                <span class="hot-num" :class="{ top: index < 3 }">{{ index + 1 }}</span>
                <div class="hot-info">
                  <span class="hot-title">{{ article.title }}</span>
                  <div class="hot-stats">
                    <span>♡ {{ article.likes || 0 }}</span>
                    <span>👁 {{ article.views || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="hot-loading">加载中...</div>
          </div>

          <div class="sidebar-card category-card reveal reveal-delay-4">
            <h3 class="card-title"><span>📂</span> 专题分类</h3>
            <div class="category-list">
              <div
                v-for="cat in categories"
                :key="cat.id"
                class="category-item"
                @click="$router.push(`/topic/${cat.id}`)"
              >
                <span class="cat-name">{{ cat.name }}</span>
                <span class="cat-arrow">→</span>
              </div>
            </div>
          </div>

          <div class="sidebar-card tag-card reveal reveal-delay-5">
            <h3 class="card-title"><span>🏷️</span> 标签云</h3>
            <div class="tag-cloud">
              <span
                v-for="tag in tags"
                :key="tag.id || tag.name"
                class="tag-cloud-item"
                :style="getTagStyle(tag)"
                @click="$router.push(`/tags?tag=${tag.name}`)"
              >{{ tag.name }}</span>
            </div>
          </div>

          <div class="sidebar-card subscribe-card reveal reveal-delay-5">
            <h3 class="card-title"><span>📮</span> 订阅更新</h3>
            <p>输入邮箱，获取最新文章通知</p>
            <div class="subscribe-form">
              <input v-model="subEmail" type="email" placeholder="your@email.com" class="sub-input" />
              <button class="btn btn-primary" @click="subscribe" :disabled="subLoading">
                {{ subLoading ? '订阅中...' : '订阅' }}
              </button>
            </div>
            <div v-if="subMessage" class="sub-message">{{ subMessage }}</div>
          </div>
        </aside>
      </div>
      </div>
    </div>

    <InterestSelectModal
      :visible="showInterestModal"
      @confirm="handleInterestConfirm"
      @skip="handleInterestSkip"
      @close="showInterestModal = false"
    />

    <canvas
      ref="particleCanvas"
      class="particle-canvas"
      :class="{ active: isShattering }"
    ></canvas>
  </div>
</template>

<style scoped>
.swipe-hint-bar {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: var(--color-text);
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  z-index: 9999;
  pointer-events: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.swipe-hint-bar.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.particle-canvas.active {
  opacity: 1;
}

.home-page {
  padding-top: 20px;

  --rec-card-bg: rgba(20, 25, 50, 0.35);
  --rec-card-border: rgba(0, 212, 255, 0.12);
  --rec-text: #e8e8f0;
  --rec-text-light: #b0b0c0;
  --rec-text-muted: #808090;
}

:global(body.light-bg-mode) .home-page {
  --rec-card-bg: rgba(255, 255, 255, 0.65);
  --rec-card-border: rgba(0, 0, 0, 0.08);
  --rec-text: #1a1a2e;
  --rec-text-light: #3a3a4a;
  --rec-text-muted: #5a5a6a;
}

/* Recommend section */
.recommend-section {
  margin-bottom: 32px;
  padding: 20px;
  background: var(--rec-card-bg);
  border: 1px solid var(--rec-card-border);
  border-radius: 14px;
}

.recommend-fade-in {
  animation: recFadeIn 0.6s ease-out;
}

@keyframes recFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.recommend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.recommend-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--rec-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.recommend-icon {
  font-size: 20px;
}

.recommend-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recommend-refresh-btn,
.recommend-edit-btn,
.recommend-clear-btn {
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s;
  color: var(--rec-text-light);
  background: rgba(0, 212, 255, 0.08);
}

.recommend-refresh-btn:hover:not(:disabled),
.recommend-edit-btn:hover {
  background: rgba(0, 212, 255, 0.18);
  color: var(--rec-text);
}

.recommend-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recommend-clear-btn {
  padding: 6px 10px;
  background: rgba(255, 68, 102, 0.08);
  color: #ff6b80;
}

.recommend-clear-btn:hover {
  background: rgba(255, 68, 102, 0.2);
}

.spin {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.recommend-based-on {
  font-size: 12px;
  color: var(--rec-text-muted);
  margin-bottom: 14px;
}

.recommend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.recommend-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--rec-card-bg);
  border: 1px solid var(--rec-card-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s;
}

.recommend-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-color: rgba(0, 212, 255, 0.3);
}

.recommend-cover {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
}

.recommend-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recommend-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.recommend-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--rec-text);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.recommend-summary {
  font-size: 12px;
  color: var(--rec-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 6px;
}

.recommend-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--rec-text-muted);
}
.home-page {
  transition: opacity 1.2s ease-in-out, transform 1.2s ease-in-out;
}
.home-page.leaving {
  opacity: 0;
  transform: translateY(-30px);
}

/* Content wrap */
.content-wrap {
  background: transparent;
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding-bottom: 60px;
}

/* Glassmorphism cards */
.sidebar-card {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.announcement-bar {
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
  color: var(--color-text);
  padding: 10px 0;
  position: relative;
  z-index: 1;
}
.announcement-inner { display: flex; align-items: center; gap: 12px; }
.announcement-label {
  background: var(--color-accent);
  color: #fff;
  padding: 3px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.announcement-content { flex: 1; font-size: 14px; }
.close-btn { color: var(--color-text); font-size: 22px; line-height: 1; opacity: 0.6; transition: opacity var(--transition); }
.close-btn:hover { opacity: 1; }

.content-area { padding: 30px 20px 60px; }
.home-layout { display: flex; gap: 32px; }
.articles-section { flex: 1; min-width: 0; }
.section-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-icon {
  background: var(--color-gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 20px;
}
.articles-grid { display: flex; flex-direction: column; gap: 20px; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.section-header .section-title { margin-bottom: 0; }
.card-layout-switch { display: flex; gap: 4px; }
.layout-toggle-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-solid);
  border-radius: var(--radius-sm);
  font-size: 16px;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--color-bg-solid);
}
.layout-toggle-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-2px);
}
.layout-toggle-btn.active {
  background: var(--color-gradient-1);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.25);
  animation: btnPop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes btnPop {
  0% { transform: scale(0.85); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}

.articles-grid.layout-list { display: flex; flex-direction: column; gap: 20px; }
.articles-grid.layout-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.articles-grid.layout-compact { display: flex; flex-direction: column; gap: 8px; }
.articles-grid.layout-card { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

/* Layout switch smooth transition */
.articles-grid > * {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (max-width: 768px) {
  .articles-grid.layout-grid { grid-template-columns: 1fr; }
  .articles-grid.layout-card { grid-template-columns: 1fr; }
}

.sidebar { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 20px; }

.sidebar-card {
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition);
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text);
}

.search-card .search-box { display: flex; gap: 8px; }
.search-card { position: relative; z-index: 100; overflow: visible; }
.search-input-wrapper { flex: 1; position: relative; }
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: -8px;
  right: -8px;
  margin-top: 4px;
  background: var(--color-bg-solid);
  border: 1px solid var(--color-border-solid);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  z-index: 9999;
  max-height: 400px;
  overflow-y: auto;
  animation: floatUp 0.2s ease;
}
.suggest-header {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.suggest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  transition: background var(--transition);
  border-bottom: 1px solid var(--color-border);
}
.suggest-item:last-child { border-bottom: none; }
.suggest-item:hover { background: var(--color-primary-light); }
.suggest-text {
  font-size: 13px;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggest-fire { font-size: 12px; flex-shrink: 0; margin-left: 8px; }
.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1.5px solid var(--color-border-solid);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg-solid);
  color: var(--color-text);
  transition: all var(--transition);
}
.search-input:focus { border-color: var(--color-primary); outline: none; box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.1); }
.search-input::placeholder { color: var(--color-text-muted); }
.search-btn { padding: 10px 18px; font-size: 13px; white-space: nowrap; }
.search-error { color: var(--color-danger); font-size: 12px; margin-top: 8px; }

.rec-card {
  cursor: pointer;
  border: 2px solid transparent;
  background: linear-gradient(135deg, rgba(108, 92, 231, 0.08), rgba(162, 155, 254, 0.12));
  text-align: center;
  transition: all var(--transition);
}
.rec-card:hover {
  box-shadow: var(--shadow-glow);
  transform: translateY(-3px);
  border-color: rgba(108, 92, 231, 0.3);
}
.rec-icon { font-size: 32px; margin-bottom: 8px; }
.rec-card h3 { color: var(--color-primary); font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.rec-card p { font-size: 13px; color: var(--color-text-light); margin-bottom: 12px; }
.rec-link { font-size: 14px; color: var(--color-primary); font-weight: 600; }

.hot-card { }
.hot-list { display: flex; flex-direction: column; gap: 8px; }
.hot-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
}
.hot-item:hover { background: var(--color-primary-light); }
.hot-num {
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
.hot-num.top {
  color: #fff;
  background: var(--color-gradient-2);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}
.hot-info { flex: 1; min-width: 0; }
.hot-title {
  font-size: 13px;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.hot-stats { display: flex; gap: 12px; font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }
.hot-loading { font-size: 13px; color: var(--color-text-light); text-align: center; padding: 20px 0; }

.category-card { }
.category-list { display: flex; flex-direction: column; gap: 4px; }
.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  margin: 0 -8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition);
}
.category-item:hover { background: var(--color-primary-light); }
.cat-name { font-size: 14px; color: var(--color-text); font-weight: 500; }
.cat-arrow { font-size: 14px; color: var(--color-text-muted); transition: transform var(--transition); }
.category-item:hover .cat-arrow { transform: translateX(4px); color: var(--color-primary); }

.tag-card { }
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.tag-cloud-item {
  cursor: pointer;
  font-weight: 600;
  transition: all var(--transition);
  display: inline-block;
  padding: 2px 4px;
}
.tag-cloud-item:hover {
  transform: scale(1.15);
  text-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.subscribe-card p { font-size: 13px; color: var(--color-text-light); margin-bottom: 14px; }
.subscribe-form { display: flex; flex-direction: column; gap: 10px; }
.sub-input {
  padding: 10px 14px;
  border: 1.5px solid var(--color-border-solid);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg-solid);
  color: var(--color-text);
  transition: all var(--transition);
}
.sub-input:focus { border-color: var(--color-primary); outline: none; }
.sub-input::placeholder { color: var(--color-text-muted); }
.sub-message { font-size: 13px; margin-top: 10px; color: var(--color-primary); font-weight: 500; }

@media (max-width: 768px) {
  .home-layout { flex-direction: column; }
  .sidebar { width: 100%; }
}
</style>
