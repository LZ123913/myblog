<script setup>
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/api'

const route = useRoute()
const router = useRouter()

const form = reactive({
  newPassword: '',
  confirmPassword: ''
})
const errors = reactive({
  newPassword: '',
  confirmPassword: ''
})
const loading = ref(false)
const success = ref('')
const error = ref('')
const invalidToken = ref(!route.query.token)

function validatePassword() {
  if (!form.newPassword) {
    errors.newPassword = '请输入新密码'
    return false
  }
  if (form.newPassword.length < 6 || form.newPassword.length > 20) {
    errors.newPassword = '密码长度需为 6-20 个字符'
    return false
  }
  errors.newPassword = ''
  return true
}

function validateConfirmPassword() {
  if (!form.confirmPassword) {
    errors.confirmPassword = '请确认密码'
    return false
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = '两次输入的密码不一致'
    return false
  }
  errors.confirmPassword = ''
  return true
}

async function handleSubmit() {
  error.value = ''
  success.value = ''
  const ok1 = validatePassword()
  const ok2 = validateConfirmPassword()
  if (!ok1 || !ok2) return
  if (invalidToken.value) return

  loading.value = true
  try {
    const data = await api.post('/password/reset', {
      token: route.query.token,
      newPassword: form.newPassword,
      confirmPassword: form.confirmPassword
    })
    success.value = data.message || '密码重置成功'
    setTimeout(() => {
      router.push('/')
    }, 2000)
  } catch (err) {
    error.value = err.message || '密码重置失败'
  } finally {
    loading.value = false
  }
}

function goToHome() {
  router.push('/')
}
</script>

<template>
  <div class="reset-password-page">
    <div class="container">
      <div class="reset-card">
        <h1 class="reset-title">重置密码</h1>

        <div v-if="invalidToken" class="error-state" style="padding: 40px 20px;">
          <h3>链接无效</h3>
          <p>密码重置链接缺少必要的令牌参数，请检查邮件中的链接是否完整。</p>
          <button class="btn btn-outline" @click="goToHome">返回首页</button>
        </div>

        <template v-else>
          <div v-if="success" class="success-state">
            <div class="success-icon">✓</div>
            <p class="success-message">{{ success }}</p>
            <p class="success-hint">即将跳转到首页...</p>
          </div>

          <form v-else class="reset-form" @submit.prevent="handleSubmit">
            <div v-if="error" class="submit-error">{{ error }}</div>

            <div class="form-group">
              <label class="form-label">新密码</label>
              <input
                v-model="form.newPassword"
                type="password"
                class="form-input"
                :class="{ error: errors.newPassword }"
                placeholder="6-20 个字符"
                @blur="validatePassword"
              />
              <span v-if="errors.newPassword" class="form-error">{{ errors.newPassword }}</span>
            </div>

            <div class="form-group">
              <label class="form-label">确认密码</label>
              <input
                v-model="form.confirmPassword"
                type="password"
                class="form-input"
                :class="{ error: errors.confirmPassword }"
                placeholder="请再次输入新密码"
                @blur="validateConfirmPassword"
              />
              <span v-if="errors.confirmPassword" class="form-error">{{ errors.confirmPassword }}</span>
            </div>

            <button type="submit" class="btn btn-primary reset-btn" :disabled="loading">
              {{ loading ? '提交中...' : '重置密码' }}
            </button>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-password-page {
  padding-top: calc(var(--nav-height) + 20px);
  display: flex;
  justify-content: center;
}
.reset-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 40px;
  max-width: 440px;
  width: 100%;
  box-shadow: var(--shadow-md);
  margin-top: 20px;
}
.reset-title { font-size: 24px; font-weight: 600; color: var(--color-text); text-align: center; margin-bottom: 28px; }
.success-state { text-align: center; padding: 20px; }
.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-success);
  color: #fff;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}
.success-message { font-size: 16px; color: var(--color-text); margin-bottom: 8px; }
.success-hint { font-size: 13px; color: var(--color-text-light); }
.submit-error {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
  font-size: 14px;
  padding: 10px 14px;
  border-radius: var(--radius);
  margin-bottom: 20px;
}
.reset-form { display: flex; flex-direction: column; gap: 18px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 14px; color: var(--color-text); font-weight: 500; }
.form-input {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color var(--transition);
}
.form-input:focus { border-color: var(--color-primary); outline: none; }
.form-input.error { border-color: var(--color-danger); }
.form-error { font-size: 12px; color: var(--color-danger); }
.reset-btn { margin-top: 8px; padding: 12px; font-size: 16px; }
.reset-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
