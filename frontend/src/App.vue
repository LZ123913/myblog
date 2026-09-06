<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useAuthStore } from './stores/auth'
import { useBackgroundStore } from './stores/background'
import { useSiteStore } from './stores/site'
import NavBar from './components/NavBar.vue'
import LoginModal from './components/LoginModal.vue'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()
const siteStore = useSiteStore()
const oldBgFading = ref(false)
const newBgFadingIn = ref(false)
const isBgTransitioning = ref(false)

onMounted(() => {
  authStore.restoreAuth()
  loadReadingPrefs()
  // 初始化 light-bg-mode class
  applyLightBgClass(bgStore.isLightBg)
  // 加载站点设置
  siteStore.loadSettings()
})

function loadReadingPrefs() {
  const prefs = JSON.parse(localStorage.getItem('shiguang-reading-prefs') || '{}')
  if (prefs.theme) document.documentElement.setAttribute('data-theme', prefs.theme)
  if (prefs.fontSize) document.documentElement.style.fontSize = prefs.fontSize
}

function applyLightBgClass(isLight) {
  if (isLight) {
    document.body.classList.add('light-bg-mode')
  } else {
    document.body.classList.remove('light-bg-mode')
  }
}

// 监听 isLightBg 变化，通过 body class 切换 CSS 变量
// 所有过渡由 CSS 统一控制，避免 inline style 瞬间跳变
watch(() => bgStore.isLightBg, (val) => {
  applyLightBgClass(val)
})

// 背景切换：先加载新图，再做交叉淡入
watch(() => bgStore.previousBg, (val) => {
  if (val) {
    oldBgFading.value = false
    newBgFadingIn.value = false
    nextTick(() => {
      requestAnimationFrame(() => {
        // 先设为透明，下一帧再淡入
        isBgTransitioning.value = true
        requestAnimationFrame(() => {
          oldBgFading.value = true
          newBgFadingIn.value = true
        })
      })
    })
    setTimeout(() => {
      bgStore.previousBg = null
      oldBgFading.value = false
      newBgFadingIn.value = false
      isBgTransitioning.value = false
    }, 800)
  }
})
</script>

<template>
  <div class="bg-layer">
    <!-- 旧背景（淡出层） -->
    <div
      class="bg-image base-bg-old"
      :class="{ fading: oldBgFading }"
      v-if="bgStore.previousBg"
      :style="{ backgroundImage: `url(${bgStore.previousBg})` }"
    ></div>
    <!-- 新背景（淡入层） -->
    <div
      class="bg-image base-bg-new"
      :class="{ 'fading-in': isBgTransitioning, 'fade-in': newBgFadingIn }"
      :style="{ backgroundImage: `url(${bgStore.currentBg})` }"
    ></div>
    <!-- Hero 背景层（只用 opacity 控制显示/隐藏，backgroundImage 不变） -->
    <div
      v-if="bgStore.heroBg"
      class="bg-image hero-bg"
      :style="{
        backgroundImage: `url(${bgStore.heroBg})`,
        opacity: bgStore.heroOpacity
      }"
    ></div>
    <!-- 遮罩层 -->
    <div class="bg-overlay" :class="{ 'light-overlay': bgStore.isLightBg }"></div>
  </div>
  <div id="app-root">
    <NavBar />
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="page-enter" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </transition>
      </router-view>
    </main>
    <LoginModal v-if="authStore.showLoginModal" />
  </div>
</template>

<style>
.bg-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;
}
.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
/* 旧背景：先显示，然后淡出 */
.base-bg-old {
  opacity: 1;
  transition: opacity 0.8s ease-in-out;
  z-index: 1;
}
.base-bg-old.fading {
  opacity: 0;
}
/* 新背景：默认显示，切换时从透明淡入 */
.base-bg-new {
  opacity: 1;
  transition: opacity 0.8s ease-in-out;
  z-index: 2;
}
.base-bg-new.fading-in {
  opacity: 0;
}
.base-bg-new.fading-in.fade-in {
  opacity: 1;
}
/* Hero 背景：只用 opacity 过渡，backgroundImage 不变化 */
.hero-bg {
  opacity: 1;
  transition: opacity 0.8s ease-in-out;
  z-index: 3;
}
.bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(5, 8, 20, 0.05);
  transition: background 0.8s ease;
  pointer-events: none;
  z-index: 4;
}
.bg-overlay.light-overlay {
  background: rgba(255, 255, 255, 0.25);
}

/* Light background mode: dark text */
.light-bg-mode {
  --color-text: #000000;
  --color-text-light: #1a1a1a;
  --color-text-muted: #3a3a3a;
  --color-bg-card: rgba(255, 255, 255, 0.65);
  --glass-bg: rgba(255, 255, 255, 0.6);
  --glass-border: rgba(0, 0, 0, 0.1);
  --color-border: rgba(0, 0, 0, 0.08);
  --color-border-solid: rgba(0, 0, 0, 0.12);
  --color-primary-light: rgba(0, 120, 180, 0.06);
  --color-bg-solid: rgba(255, 255, 255, 0.75);
  --color-bg-alt: rgba(255, 255, 255, 0.45);
  --shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .light-bg-mode,
[data-theme="dark"].light-bg-mode {
  --color-text: #000000;
  --color-text-light: #1a1a1a;
  --color-text-muted: #3a3a3a;
  --color-bg-card: rgba(255, 255, 255, 0.65);
  --glass-bg: rgba(255, 255, 255, 0.6);
  --glass-border: rgba(0, 0, 0, 0.1);
}
</style>

<style scoped>
.main-content {
  min-height: 100vh;
  position: relative;
  z-index: 1;
  padding-top: var(--nav-height);
}

/* 页面切换：只做淡入，没有位移和模糊，避免震动感 */
.page-enter-leave-active {
  transition: opacity 0s;
}
.page-enter-leave-to {
  opacity: 0;
}
.page-enter-enter-active {
  transition: opacity 0.5s ease-out;
}
.page-enter-enter-from {
  opacity: 0;
}
</style>
