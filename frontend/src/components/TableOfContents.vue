<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  content: { type: String, default: '' }
})

const headings = ref([])
const activeId = ref('')
const showDrawer = ref(false)
const observer = ref(null)
const sidebar = ref(null)

function extractHeadings() {
  nextTick(() => {
    const articleEl = document.querySelector('.article-content')
    if (!articleEl) return
    const els = articleEl.querySelectorAll('h2, h3')
    headings.value = Array.from(els).map((el, i) => {
      if (!el.id) el.id = `heading-${i}`
      return {
        id: el.id,
        text: el.textContent,
        level: el.tagName === 'H2' ? 2 : 3
      }
    })

    if (observer.value) observer.value.disconnect()
    if (headings.value.length > 0) {
      observer.value = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeId.value = entry.target.id
          }
        }
      }, { rootMargin: '-80px 0px -70% 0px' })

      els.forEach(el => observer.value.observe(el))
    }
  })
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    showDrawer.value = false
  }
}

const isMobile = ref(window.innerWidth < 375)

function handleResize() {
  isMobile.value = window.innerWidth < 375
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  extractHeadings()
})

onUnmounted(() => {
  if (observer.value) observer.value.disconnect()
  window.removeEventListener('resize', handleResize)
})

watch(() => props.content, () => extractHeadings())
</script>

<template>
  <div v-if="headings.length > 0">
    <!-- Desktop sidebar TOC -->
    <div v-if="!isMobile" ref="sidebar" class="toc-sidebar">
      <div class="toc-title">目录</div>
      <nav class="toc-nav">
        <a
          v-for="h in headings"
          :key="h.id"
          :class="['toc-item', `level-${h.level}`, { active: activeId === h.id }]"
          @click="scrollTo(h.id)"
        >
          {{ h.text }}
        </a>
      </nav>
    </div>

    <!-- Mobile drawer TOC -->
    <div v-else class="toc-mobile">
      <button class="toc-mobile-btn" @click="showDrawer = true">目录</button>
      <div v-if="showDrawer" class="toc-drawer-overlay" @click="showDrawer = false">
        <div class="toc-drawer" @click.stop>
          <div class="toc-drawer-title">目录</div>
          <nav class="toc-nav">
            <a
              v-for="h in headings"
              :key="h.id"
              :class="['toc-item', `level-${h.level}`, { active: activeId === h.id }]"
              @click="scrollTo(h.id)"
            >
              {{ h.text }}
            </a>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toc-sidebar {
  position: sticky;
  top: calc(var(--nav-height) + 20px);
  max-height: calc(100vh - var(--nav-height) - 40px);
  overflow-y: auto;
  padding: 16px;
}
.toc-title, .toc-drawer-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text-light);
}
.toc-nav { display: flex; flex-direction: column; gap: 4px; }
.toc-item {
  font-size: 13px;
  color: var(--color-text-light);
  cursor: pointer;
  padding: 4px 12px;
  border-left: 3px solid transparent;
  transition: all var(--transition);
  line-height: 1.5;
}
.toc-item.level-3 { padding-left: 24px; }
.toc-item:hover { color: var(--color-primary); }
.toc-item.active {
  color: var(--color-primary);
  font-weight: 600;
  transform: scale(1.05);
  border-left-color: var(--color-accent);
}
.toc-mobile-btn {
  position: fixed;
  top: calc(var(--nav-height) + 10px);
  left: 10px;
  z-index: 50;
  padding: 6px 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 13px;
}
.toc-drawer-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 200;
}
.toc-drawer {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50vh;
  background: var(--color-bg);
  border-radius: 0 0 var(--radius) var(--radius);
  padding: 20px;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  animation: slideDown 0.3s ease;
}
@keyframes slideDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
</style>
