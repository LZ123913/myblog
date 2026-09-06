import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'splash', component: () => import('../views/SplashPage.vue') },
  { path: '/home', name: 'home', component: () => import('../views/HomePage.vue') },
  { path: '/search', name: 'search', component: () => import('../views/SearchPage.vue') },
  { path: '/article/:slug', name: 'article', component: () => import('../views/ArticlePage.vue') },
  { path: '/about', name: 'about', component: () => import('../views/AboutPage.vue') },
  { path: '/tags', name: 'tagCloud', component: () => import('../views/TagCloudPage.vue') },
  { path: '/categories', name: 'categoryTree', component: () => import('../views/CategoryTreePage.vue') },
  { path: '/timeline', name: 'timeline', component: () => import('../views/TimelinePage.vue') },
  { path: '/topic/:categoryId', name: 'topicBrowse', component: () => import('../views/TopicBrowsePage.vue') },
  { path: '/register', name: 'register', component: () => import('../views/RegisterPage.vue') },
  { path: '/reset-password', name: 'resetPassword', component: () => import('../views/ResetPasswordPage.vue') },
  { path: '/subscription-verify', name: 'subscriptionVerify', component: () => import('../views/SubscriptionVerifyPage.vue') },
  { path: '/subscription-unsubscribe', name: 'subscriptionUnsubscribe', component: () => import('../views/SubscriptionUnsubscribePage.vue') },

  { path: '/creator', name: 'creator', component: () => import('../views/CreatorPage.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/articles', name: 'adminArticleList', component: () => import('../views/admin/AdminArticleList.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/articles/:id/edit', name: 'adminArticleEdit', component: () => import('../views/admin/AdminArticleEdit.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/drafts', name: 'adminDraftList', component: () => import('../views/admin/AdminDraftList.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/recycle', name: 'adminRecycle', component: () => import('../views/admin/AdminRecycle.vue'), meta: { requiresAdmin: true } },
  { path: '/bookmarks', name: 'bookmarks', component: () => import('../views/admin/AdminBookmarks.vue'), meta: { requiresAuth: true } },
  { path: '/recommendations', name: 'recommendations', component: () => import('../views/RecommendationPage.vue') },
  { path: '/admin/users', name: 'adminUsers', component: () => import('../views/admin/AdminUsers.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/email-templates', name: 'adminEmailTemplates', component: () => import('../views/admin/AdminEmailTemplates.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/ai-configs', name: 'adminAiConfigs', component: () => import('../views/admin/AdminAiConfigs.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/site-settings', name: 'adminSiteSettings', component: () => import('../views/admin/AdminSiteSettings.vue'), meta: { requiresAdmin: true } },

  { path: '/:pathMatch(.*)*', name: 'notFound', component: () => import('../views/NotFoundPage.vue') }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'auto' }
  }
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.user && authStore.token) {
    await authStore.restoreAuth()
  }

  if (to.meta.requiresAuth) {
    if (!authStore.isLoggedIn) {
      authStore.showLoginModal = true
      return { name: 'splash' }
    }
  }

  if (to.meta.requiresAdmin) {
    if (!authStore.isLoggedIn) {
      authStore.showLoginModal = true
      return { name: 'splash' }
    }
    if (!authStore.isAdmin) {
      return { name: 'splash' }
    }
  }
})

export default router
