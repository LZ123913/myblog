<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  article: { type: Object, required: true },
  recommended: { type: Boolean, default: false },
  layout: { type: String, default: 'list' },
  index: { type: Number, default: 0 },
  customClick: { type: Boolean, default: false }
})

const router = useRouter()
const emit = defineEmits(['card-click'])

function handleCardClick(e) {
  if (props.customClick) {
    emit('card-click', { article: props.article, element: wrapperRef.value, event: e })
  } else {
    router.push(`/article/${props.article.slug}`)
  }
}

const wrapperRef = ref(null)
const isVisible = ref(false)

onMounted(() => {
  if (wrapperRef.value) {
    const el = wrapperRef.value
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible.value = true
          observer.unobserve(el)
        }
      })
    }, { threshold: 0.05, rootMargin: '0px 0px 50px 0px' })
    observer.observe(el)
  }
})

const dateStr = computed(() => {
  if (!props.article.published_at) return ''
  const d = new Date(props.article.published_at)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

const hotScore = computed(() => {
  if (props.article.hotScore !== undefined) return props.article.hotScore
  const raw = (props.article.likes || 0) * 2 + (props.article.bookmarks || 0) * 3 + (props.article.views || 0)
  const publishedAt = new Date(props.article.published_at || props.article.created_at || Date.now())
  const daysSince = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
  const decayFactor = 1 / (1 + daysSince / 30)
  return Math.round(raw * decayFactor)
})

const fireLevel = computed(() => {
  if (props.article.fireLevel !== undefined) return props.article.fireLevel
  const s = hotScore.value
  if (s >= 80) return 3
  if (s >= 40) return 2
  if (s >= 15) return 1
  return 0
})

const fireText = computed(() => ['', '🔥', '🔥🔥', '🔥🔥🔥'][fireLevel.value] || '')

const coverSrc = computed(() => {
  if (props.article.cover_image) return props.article.cover_image
  const idx = ((props.article.id || 0) % 3) + 1
  return `/cover-${idx}.jpg`
})

const animDelay = computed(() => `${Math.min(props.index, 8) * 0.05}s`)
const revealDelay = computed(() => 0)

</script>

<template>
  <div ref="wrapperRef" class="article-card-wrapper card-enter" :class="{ 'is-visible': isVisible }" :style="{ animationDelay: animDelay }" :data-reveal-delay="revealDelay">
    <!-- List: horizontal card -->
    <div v-show="layout === 'list'" class="article-card card-list" :class="{ 'card-reverse': props.index % 2 === 1 }">
      <div class="card-link" @click="handleCardClick">
        <div class="card-inner">
          <div class="card-cover">
            <img :src="coverSrc" :alt="article.title" loading="lazy" />
          </div>
          <div class="card-body">
            <div class="card-meta">
              <span v-if="article.category_name" class="category-tag">{{ article.category_name }}</span>
              <span class="date">{{ dateStr }}</span>
              <div class="badges">
                <span v-if="fireLevel > 0" class="fire-badge" :class="`fire${fireLevel}`">
                  <span v-for="n in fireLevel" :key="n" class="fire-icon" :style="{ animationDelay: `${(n - 1) * 0.15}s` }">🔥</span>
                </span>
                <span v-if="recommended" class="recommend-tag">推荐</span>
              </div>
            </div>
            <h3 class="title">{{ article.title }}</h3>
            <p v-if="article.summary" class="summary">{{ article.summary }}</p>
            <div class="card-footer">
              <div class="tags-row">
                <span v-for="tag in (article.tags || []).slice(0, 3)" :key="tag" class="tag-hashtag">#{{ tag }}</span>
              </div>
              <div class="stats">
                <span class="stat-item like">♡ {{ article.likes || 0 }}</span>
                <span class="stat-item bookmark">★ {{ article.bookmarks || 0 }}</span>
                <span class="stat-item views">👁 {{ article.views || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Grid: vertical card -->
    <div v-show="layout === 'grid'" class="article-card card-grid">
      <div class="card-link" @click="handleCardClick">
        <div class="grid-cover">
          <img :src="coverSrc" :alt="article.title" loading="lazy" />
          <div class="grid-overlay">
            <span v-if="fireLevel > 0" class="fire-badge" :class="`fire${fireLevel}`">
              <span v-for="n in fireLevel" :key="n" class="fire-icon" :style="{ animationDelay: `${(n - 1) * 0.15}s` }">🔥</span>
            </span>
            <span v-if="recommended" class="recommend-tag">推荐</span>
          </div>
        </div>
        <div class="grid-body">
          <span v-if="article.category_name" class="category-tag">{{ article.category_name }}</span>
          <h3 class="title">{{ article.title }}</h3>
          <p v-if="article.summary" class="summary">{{ article.summary }}</p>
          <div class="grid-footer">
            <span class="date">{{ dateStr }}</span>
            <div class="stats">
              <span class="stat-item like">♡ {{ article.likes || 0 }}</span>
              <span class="stat-item views">👁 {{ article.views || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact: text-focused list -->
    <div v-show="layout === 'compact'" class="article-card card-compact">
      <div class="card-link compact-link" @click="handleCardClick">
        <div class="compact-left">
          <img :src="coverSrc" :alt="article.title" loading="lazy" class="compact-thumb" />
        </div>
        <div class="compact-body">
          <div class="compact-header">
            <h3 class="compact-title">{{ article.title }}</h3>
            <span v-if="fireLevel > 0" class="fire-badge" :class="`fire${fireLevel}`">
              <span v-for="n in fireLevel" :key="n" class="fire-icon" :style="{ animationDelay: `${(n - 1) * 0.15}s` }">🔥</span>
            </span>
          </div>
          <div class="compact-meta">
            <span class="date">{{ dateStr }}</span>
            <span v-for="tag in (article.tags || []).slice(0, 2)" :key="tag" class="tag-hashtag">#{{ tag }}</span>
            <span class="stat-item like">♡ {{ article.likes || 0 }}</span>
            <span class="stat-item views">👁 {{ article.views || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Card: image-forward card -->
    <div v-show="layout === 'card'" class="article-card card-image">
      <div class="card-link" @click="handleCardClick">
        <div class="image-cover">
          <img :src="coverSrc" :alt="article.title" loading="lazy" />
          <div class="image-overlay">
            <div class="image-badges">
              <span v-if="fireLevel > 0" class="fire-badge" :class="`fire${fireLevel}`">
                <span v-for="n in fireLevel" :key="n" class="fire-icon" :style="{ animationDelay: `${(n - 1) * 0.15}s` }">🔥</span>
              </span>
              <span v-if="recommended" class="recommend-tag">推荐</span>
            </div>
            <div class="image-content">
              <span v-if="article.category_name" class="category-tag">{{ article.category_name }}</span>
              <h3 class="title">{{ article.title }}</h3>
              <div class="image-stats">
                <span class="stat-item like">♡ {{ article.likes || 0 }}</span>
                <span class="stat-item views">👁 {{ article.views || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.article-card-wrapper {
  width: 100%;
  height: 100%;
}
.article-card {
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition);
  box-shadow: var(--shadow-sm);
  height: 100%;
}
.article-card:hover {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.15);
  transform: translateY(-3px);
  border-color: var(--color-primary);
}
.card-link { display: block; height: 100%; }

/* === List Layout === */
.card-list .card-inner { display: flex; min-height: 180px; }
.card-list .card-cover { width: 240px; flex-shrink: 0; overflow: hidden; }
.card-list .card-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.card-reverse .card-inner { flex-direction: row-reverse; }
.article-card:hover .card-list .card-cover img,
.article-card:hover .card-cover img { transform: scale(1.05); }
.card-list .card-body { flex: 1; padding: 20px 24px; display: flex; flex-direction: column; min-width: 0; }
.card-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; }
.category-tag { background: var(--color-primary-light); color: var(--color-primary); padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
.date { color: var(--color-text-muted); font-size: 12px; }
.badges { display: flex; gap: 6px; align-items: center; margin-left: auto; }
.fire-badge {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  line-height: 1;
  background: rgba(255, 140, 0, 0.1);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}
.fire-badge .fire-icon {
  display: inline-block;
  transform: scale(0.7) translateY(2px);
  filter: grayscale(0.6) brightness(0.7);
  opacity: 0.6;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              filter 0.4s ease,
              opacity 0.4s ease;
  transition-delay: 0s;
}

/* 悬停卡片时，火焰从左到右依次燃烧 */
.article-card:hover .fire-badge .fire-icon:nth-child(1) {
  transform: scale(1.1) translateY(-1px);
  filter: grayscale(0) brightness(1.2) drop-shadow(0 0 4px rgba(255, 120, 0, 0.8));
  opacity: 1;
  transition-delay: 0s;
  animation: fireFlicker 0.6s ease-in-out infinite alternate;
  animation-delay: 0.4s;
}
.article-card:hover .fire-badge .fire-icon:nth-child(2) {
  transform: scale(1.1) translateY(-1px);
  filter: grayscale(0) brightness(1.2) drop-shadow(0 0 4px rgba(255, 120, 0, 0.8));
  opacity: 1;
  transition-delay: 0.15s;
  animation: fireFlicker 0.6s ease-in-out infinite alternate;
  animation-delay: 0.55s;
}
.article-card:hover .fire-badge .fire-icon:nth-child(3) {
  transform: scale(1.1) translateY(-1px);
  filter: grayscale(0) brightness(1.2) drop-shadow(0 0 4px rgba(255, 120, 0, 0.8));
  opacity: 1;
  transition-delay: 0.3s;
  animation: fireFlicker 0.6s ease-in-out infinite alternate;
  animation-delay: 0.7s;
}

/* 移开时依次熄灭（反向延迟） */
.fire-badge .fire-icon:nth-child(1) { transition-delay: 0.3s; }
.fire-badge .fire-icon:nth-child(2) { transition-delay: 0.15s; }
.fire-badge .fire-icon:nth-child(3) { transition-delay: 0s; }

.article-card:hover .fire-badge.fire1 {
  background: rgba(255, 140, 0, 0.18);
}
.article-card:hover .fire-badge.fire2 {
  background: rgba(255, 100, 0, 0.22);
  box-shadow: 0 0 8px rgba(255, 100, 0, 0.25);
}
.article-card:hover .fire-badge.fire3 {
  background: rgba(255, 60, 0, 0.28);
  box-shadow: 0 0 14px rgba(255, 60, 0, 0.35);
}

@keyframes fireFlicker {
  0% {
    transform: scale(1) translateY(0);
    filter: grayscale(0) brightness(1.1) drop-shadow(0 0 3px rgba(255, 100, 0, 0.6));
  }
  100% {
    transform: scale(1.15) translateY(-2px);
    filter: grayscale(0) brightness(1.3) drop-shadow(0 0 7px rgba(255, 150, 0, 0.9));
  }
}
.recommend-tag { background: var(--color-gradient-2); color: #fff; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 6px; }
.title { font-size: 18px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; line-height: 1.4; transition: color var(--transition); }
.article-card:hover .title { color: var(--color-primary); }
.summary { font-size: 13px; color: var(--color-text-light); margin-bottom: auto; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6; padding-bottom: 12px; }
.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 10px; border-top: 1px solid var(--color-border); }
.tags-row { display: flex; gap: 10px; flex-wrap: wrap; }
.tag-hashtag { font-size: 13px; color: var(--color-primary); font-weight: 500; }
.stats { display: flex; gap: 14px; flex-shrink: 0; }
.stat-item { font-size: 13px; color: var(--color-text-light); transition: color var(--transition); }
.article-card:hover .stat-item.like { color: var(--color-accent); }
.article-card:hover .stat-item.bookmark { color: var(--color-warning); }
.article-card:hover .stat-item.views { color: var(--color-primary); }

/* === Grid Layout === */
.card-grid { display: flex; flex-direction: column; }
.grid-cover { width: 100%; height: 180px; overflow: hidden; position: relative; }
.grid-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.article-card:hover .grid-cover img { transform: scale(1.05); }
.grid-overlay { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
.grid-body { padding: 16px 18px; flex: 1; display: flex; flex-direction: column; }
.grid-body .category-tag { margin-bottom: 8px; align-self: flex-start; }
.grid-body .title { font-size: 16px; margin-bottom: 6px; }
.grid-body .summary { font-size: 12px; -webkit-line-clamp: 2; margin-bottom: 12px; }
.grid-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--color-border); }

/* === Compact Layout === */
.card-compact { border-radius: var(--radius); }
.compact-link { display: flex; gap: 12px; padding: 12px 16px; align-items: center; }
.compact-left { flex-shrink: 0; }
.compact-thumb { width: 64px; height: 64px; border-radius: var(--radius-sm); object-fit: cover; }
.compact-body { flex: 1; min-width: 0; }
.compact-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.compact-title { font-size: 15px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; transition: color var(--transition); }
.article-card:hover .compact-title { color: var(--color-primary); }
.compact-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--color-text-muted); }

/* === Card/Image Layout === */
.card-image { border-radius: var(--radius-lg); }
.image-cover { width: 100%; height: 220px; overflow: hidden; position: relative; }
.image-cover img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }
.article-card:hover .image-cover img { transform: scale(1.08); }
.image-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%);
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 16px;
}
.image-badges { position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; }
.image-content { color: #fff; }
.image-content .category-tag { background: rgba(255,255,255,0.2); color: #fff; backdrop-filter: blur(4px); }
.image-content .title { color: #fff; font-size: 16px; margin-bottom: 6px; }
.image-stats { display: flex; gap: 12px; }
.image-stats .stat-item { color: rgba(255,255,255,0.8); font-size: 12px; }

@media (max-width: 768px) {
  .card-list .card-inner { flex-direction: column; }
  .card-list .card-cover { width: 100%; height: 160px; }
  .compact-thumb { width: 48px; height: 48px; }
}

.card-enter {
  opacity: 0;
  transform: translateY(30px) rotateX(8deg);
  transform-origin: center bottom;
  will-change: transform, opacity;
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.6s cubic-bezier(0.16, 1, 0.3, 1),
              filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  filter: blur(4px);
}

.card-enter.is-visible {
  opacity: 1;
  transform: translateY(0) rotateX(0);
  filter: blur(0);
}
</style>
