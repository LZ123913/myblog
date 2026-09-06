<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSiteStore } from '../stores/site'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const siteStore = useSiteStore()

const showDiscover = ref(false)
const showUserMenu = ref(false)
const hidden = ref(false)
const lastScrollY = ref(0)
const isHome = computed(() => route.name === 'home' || route.name === 'splash')

function handleScroll() {
  const y = window.scrollY
  const delta = y - lastScrollY.value
  if (delta > 10 && y > 60) {
    hidden.value = true
  } else if (delta < -5) {
    hidden.value = false
  }
  lastScrollY.value = y
}

onMounted(() => window.addEventListener('scroll', handleScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', handleScroll))

function goBack() {
  if (window.history.length > 2) {
    router.back()
  } else {
    router.push('/')
  }
}

function logout() {
  authStore.logout()
  router.push('/')
}
</script>

<template>
  <nav class="navbar" :class="{ hidden }">
    <div class="container nav-inner">
      <div class="nav-left">
        <button class="back-btn" @click="goBack" title="返回上一步">
          <span class="back-icon">←</span>
        </button>
        <router-link to="/" class="logo">
          <span class="logo-text">拾光集</span>
        </router-link>
      </div>

      <div class="nav-links">
        <router-link to="/" class="nav-link">首页</router-link>

        <div class="dropdown" @mouseenter="showDiscover = true" @mouseleave="showDiscover = false">
          <span class="dropdown-trigger">发现 ▾</span>
          <div v-if="showDiscover" class="dropdown-menu">
            <router-link to="/tags">标签归档</router-link>
            <router-link to="/timeline">时间轴</router-link>
          </div>
        </div>

        <div class="dropdown" @mouseenter="showDiscover = false">
          <span class="dropdown-trigger" @click="$router.push('/categories')">专题分类</span>
        </div>

        <router-link to="/about" class="nav-link">关于我</router-link>
      </div>

      <div class="nav-actions">
        <template v-if="authStore.isLoggedIn">
          <div class="dropdown" @mouseenter="showUserMenu = true" @mouseleave="showUserMenu = false">
            <span class="avatar-btn">
              <img v-if="siteStore.authorAvatar" :src="siteStore.authorAvatar" class="avatar" />
              <span v-else class="avatar-placeholder">{{ siteStore.authorName?.charAt(0) || authStore.user?.nickname?.charAt(0) || '用' }}</span>
            </span>
            <div v-if="showUserMenu" class="dropdown-menu user-menu">
              <router-link to="/bookmarks">我的收藏</router-link>
              <router-link to="/recommendations">个性化推荐</router-link>
              <router-link to="/creator" v-if="authStore.isAdmin">创作中心</router-link>
              <router-link to="/admin/articles" v-if="authStore.isAdmin">文章管理</router-link>
              <router-link to="/admin/drafts" v-if="authStore.isAdmin">草稿管理</router-link>
              <router-link to="/admin/recycle" v-if="authStore.isAdmin">回收站</router-link>
              <router-link to="/admin/users" v-if="authStore.isAdmin">用户管理</router-link>
              <router-link to="/admin/email-templates" v-if="authStore.isAdmin">邮件模板</router-link>
              <router-link to="/admin/ai-configs" v-if="authStore.isAdmin">AI配置</router-link>
              <router-link to="/admin/site-settings" v-if="authStore.isAdmin">主页编辑</router-link>
              <button @click="logout" class="logout-btn">退出登录</button>
            </div>
          </div>
        </template>
        <template v-else>
          <button class="btn btn-primary" @click="authStore.showLoginModal = true">登录</button>
        </template>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
  z-index: 100;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.navbar.hidden {
  transform: translateY(-100%);
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}
.nav-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-alt);
  color: var(--color-text);
  transition: all var(--transition);
  font-size: 16px;
}
.back-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
  transform: translateX(-2px);
}
.back-icon { font-weight: 600; }
.logo {
  font-size: 22px;
  font-weight: 800;
  background: var(--color-gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

.nav-links {
  display: flex;
  gap: 32px;
  align-items: center;
}

.nav-link {
  color: var(--color-text);
  font-size: 15px;
  font-weight: 500;
  transition: all var(--transition);
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--color-gradient-1);
  border-radius: 2px;
  transition: all var(--transition);
  transform: translateX(-50%);
}

.nav-link:hover::after,
.nav-link.router-link-active::after {
  width: 100%;
}

.nav-links a:hover, .nav-links a.router-link-active {
  opacity: 1;
  color: var(--color-primary);
}

.dropdown {
  position: relative;
}

.dropdown-trigger {
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text);
  transition: color var(--transition);
  padding: 20px 0;
  margin: -20px 0;
}
.dropdown-trigger:hover { color: var(--color-primary); }

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--color-bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 8px 0;
  min-width: 140px;
  box-shadow: var(--shadow-lg);
  animation: dropdownFade 0.15s ease;
  z-index: 200;
}
.dropdown-menu::before {
  content: '';
  position: absolute;
  top: -16px;
  left: 0;
  right: 0;
  height: 16px;
}
@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.dropdown-menu a {
  display: block;
  padding: 10px 20px;
  color: var(--color-text);
  font-size: 14px;
  transition: all var(--transition);
}
.dropdown-menu a:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-btn {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-primary);
}
.avatar-placeholder {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-gradient-1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.user-menu {
  right: 0;
  left: auto;
  min-width: 180px;
}
.user-menu::before {
  content: '';
  position: absolute;
  top: -16px;
  left: 0;
  right: 0;
  height: 16px;
}

.logout-btn {
  width: 100%;
  padding: 10px 20px;
  text-align: left;
  color: var(--color-danger);
  font-size: 14px;
  transition: background var(--transition);
}
.logout-btn:hover {
  background: var(--color-accent-light);
}

@media (max-width: 768px) {
  .nav-links { display: none; }
  .logo-text { font-size: 18px; }
}
</style>
