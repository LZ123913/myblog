<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/api'

const route = useRoute()
const router = useRouter()

const email = ref(route.query.email || '')
const loading = ref(false)
const success = ref('')
const error = ref('')
const confirmed = ref(false)
const invalidEmail = ref(!email.value)

onMounted(() => {
  if (email.value && !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    invalidEmail.value = true
  }
})

async function handleUnsubscribe() {
  error.value = ''
  success.value = ''
  if (invalidEmail.value) return
  loading.value = true
  try {
    const data = await api.post('/subscriptions/unsubscribe', { email: email.value })
    success.value = data.message || '退订成功'
    confirmed.value = true
  } catch (err) {
    error.value = err.message || '退订失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function goToHome() {
  router.push('/')
}
</script>

<template>
  <div class="subscription-unsubscribe-page">
    <div class="container">
      <div class="unsubscribe-card">
        <h1 class="page-title">取消订阅</h1>

        <div v-if="invalidEmail" class="error-state" style="padding: 40px 20px; text-align: center;">
          <h3>链接无效</h3>
          <p>退订链接缺少有效的邮箱参数，请检查邮件中的链接是否完整。</p>
          <button class="btn btn-outline" @click="goToHome">返回首页</button>
        </div>

        <template v-else>
          <div v-if="confirmed" class="success-state">
            <div class="status-icon success-icon">✓</div>
            <h2 class="status-title">退订成功</h2>
            <p class="status-message">{{ success }}</p>
            <p class="status-hint">您将不再收到来自该邮箱的文章更新通知。</p>
            <button class="btn btn-primary" @click="goToHome">返回首页</button>
          </div>

          <div v-else class="confirm-section">
            <p class="confirm-text">
              您正在取消邮箱 <strong>{{ email }}</strong> 的文章订阅。
            </p>
            <p class="confirm-hint">退订后将不再收到最新的文章更新通知。</p>

            <div v-if="error" class="submit-error">{{ error }}</div>

            <div class="confirm-actions">
              <button class="btn btn-danger" @click="handleUnsubscribe" :disabled="loading">
                {{ loading ? '处理中...' : '确认退订' }}
              </button>
              <button class="btn btn-outline" @click="goToHome">取消</button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subscription-unsubscribe-page {
  padding-top: calc(var(--nav-height) + 20px);
  display: flex;
  justify-content: center;
}
.unsubscribe-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 40px;
  max-width: 480px;
  width: 100%;
  box-shadow: var(--shadow-md);
  margin-top: 20px;
}
.page-title { font-size: 22px; font-weight: 600; color: var(--color-text); text-align: center; margin-bottom: 28px; }
.success-state { text-align: center; padding: 20px; }
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
.status-title { font-size: 20px; font-weight: 600; color: var(--color-text); margin-bottom: 12px; }
.status-message { font-size: 15px; color: var(--color-text); margin-bottom: 8px; }
.status-hint { font-size: 13px; color: var(--color-text-light); margin-bottom: 24px; }
.confirm-section { text-align: center; }
.confirm-text { font-size: 15px; color: var(--color-text); margin-bottom: 8px; line-height: 1.6; }
.confirm-text strong { color: var(--color-primary); }
.confirm-hint { font-size: 13px; color: var(--color-text-light); margin-bottom: 28px; }
.submit-error {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
  font-size: 14px;
  padding: 10px 14px;
  border-radius: var(--radius);
  margin-bottom: 20px;
}
.confirm-actions { display: flex; gap: 12px; justify-content: center; }
.confirm-actions .btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
