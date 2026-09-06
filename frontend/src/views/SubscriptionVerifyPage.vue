<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const success = ref('')
const error = ref('')

onMounted(() => verify())

async function verify() {
  const token = route.query.token
  if (!token) {
    error.value = '缺少验证令牌，请检查邮件中的链接是否完整'
    loading.value = false
    return
  }
  loading.value = true
  try {
    const data = await api.get(`/subscriptions/verify?token=${encodeURIComponent(token)}`)
    success.value = data.message || '订阅验证成功！'
  } catch (err) {
    error.value = err.message || '验证失败，链接可能已过期'
  } finally {
    loading.value = false
  }
}

function goToHome() {
  router.push('/')
}
</script>

<template>
  <div class="subscription-verify-page">
    <div class="container">
      <div class="verify-card">
        <div v-if="loading" class="loading-state" style="padding: 60px; text-align: center;">
          <span class="loading-spinner"></span>
          <p class="status-text">正在验证您的订阅...</p>
        </div>

        <div v-else-if="success" class="success-state">
          <div class="status-icon success-icon">✓</div>
          <h2 class="status-title">验证成功</h2>
          <p class="status-message">{{ success }}</p>
          <p class="status-hint">您已成功订阅，将收到最新文章的更新通知。</p>
          <button class="btn btn-primary" @click="goToHome">返回首页</button>
        </div>

        <div v-else class="error-state-content">
          <div class="status-icon error-icon">✕</div>
          <h2 class="status-title">验证失败</h2>
          <p class="status-message">{{ error }}</p>
          <button class="btn btn-outline" @click="goToHome">返回首页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subscription-verify-page {
  padding-top: calc(var(--nav-height) + 20px);
  display: flex;
  justify-content: center;
}
.verify-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 48px 40px;
  max-width: 480px;
  width: 100%;
  box-shadow: var(--shadow-md);
  margin-top: 20px;
  text-align: center;
}
.status-text { color: var(--color-text-light); font-size: 15px; margin-top: 16px; }
.status-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #fff;
  margin: 0 auto 20px;
}
.success-icon { background: var(--color-success); }
.error-icon { background: var(--color-danger); }
.status-title { font-size: 22px; font-weight: 600; color: var(--color-text); margin-bottom: 12px; }
.status-message { font-size: 15px; color: var(--color-text); margin-bottom: 8px; }
.status-hint { font-size: 13px; color: var(--color-text-light); margin-bottom: 24px; }
.verify-card .btn { margin-top: 8px; }
</style>
