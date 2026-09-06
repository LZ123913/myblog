<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})
const errors = reactive({
  email: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})
const submitError = ref('')
const loading = ref(false)

function validateEmail() {
  if (!form.email) {
    errors.email = '请输入邮箱'
    return false
  }
  if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.email = '邮箱格式不正确'
    return false
  }
  errors.email = ''
  return true
}

function validateNickname() {
  if (!form.nickname || form.nickname.trim().length < 1) {
    errors.nickname = '请输入昵称'
    return false
  }
  errors.nickname = ''
  return true
}

function validatePassword() {
  if (!form.password) {
    errors.password = '请输入密码'
    return false
  }
  if (form.password.length < 6 || form.password.length > 20) {
    errors.password = '密码长度需为 6-20 个字符'
    return false
  }
  errors.password = ''
  return true
}

function validateConfirmPassword() {
  if (!form.confirmPassword) {
    errors.confirmPassword = '请确认密码'
    return false
  }
  if (form.confirmPassword !== form.password) {
    errors.confirmPassword = '两次输入的密码不一致'
    return false
  }
  errors.confirmPassword = ''
  return true
}

function validate() {
  const ok1 = validateEmail()
  const ok2 = validateNickname()
  const ok3 = validatePassword()
  const ok4 = validateConfirmPassword()
  return ok1 && ok2 && ok3 && ok4
}

async function handleRegister() {
  submitError.value = ''
  if (!validate()) return
  loading.value = true
  try {
    await authStore.register(form.email, form.nickname, form.password, form.confirmPassword)
    router.push('/')
  } catch (err) {
    submitError.value = err.message || '注册失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  authStore.showLoginModal = true
  router.push('/')
}
</script>

<template>
  <div class="register-page">
    <div class="container">
      <div class="register-card">
        <h1 class="register-title">注册</h1>

        <div v-if="submitError" class="submit-error">{{ submitError }}</div>

        <form class="register-form" @submit.prevent="handleRegister">
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input
              v-model="form.email"
              type="email"
              class="form-input"
              :class="{ error: errors.email }"
              placeholder="请输入邮箱"
              @blur="validateEmail"
            />
            <span v-if="errors.email" class="form-error">{{ errors.email }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">昵称</label>
            <input
              v-model="form.nickname"
              type="text"
              class="form-input"
              :class="{ error: errors.nickname }"
              placeholder="请输入昵称"
              @blur="validateNickname"
            />
            <span v-if="errors.nickname" class="form-error">{{ errors.nickname }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              v-model="form.password"
              type="password"
              class="form-input"
              :class="{ error: errors.password }"
              placeholder="6-20 个字符"
              @blur="validatePassword"
            />
            <span v-if="errors.password" class="form-error">{{ errors.password }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">确认密码</label>
            <input
              v-model="form.confirmPassword"
              type="password"
              class="form-input"
              :class="{ error: errors.confirmPassword }"
              placeholder="请再次输入密码"
              @blur="validateConfirmPassword"
            />
            <span v-if="errors.confirmPassword" class="form-error">{{ errors.confirmPassword }}</span>
          </div>

          <button type="submit" class="btn btn-primary register-btn" :disabled="loading">
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>

        <p class="login-link">
          已有账号？<a href="#" @click.prevent="goToLogin">去登录</a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  padding-top: calc(var(--nav-height) + 20px);
  display: flex;
  justify-content: center;
}
.register-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 40px;
  max-width: 440px;
  width: 100%;
  box-shadow: var(--shadow-md);
  margin-top: 20px;
}
.register-title { font-size: 24px; font-weight: 600; color: var(--color-text); text-align: center; margin-bottom: 28px; }
.submit-error {
  background: rgba(245, 108, 108, 0.1);
  color: var(--color-danger);
  font-size: 14px;
  padding: 10px 14px;
  border-radius: var(--radius);
  margin-bottom: 20px;
}
.register-form { display: flex; flex-direction: column; gap: 18px; }
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
.register-btn { margin-top: 8px; padding: 12px; font-size: 16px; }
.register-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-link { text-align: center; margin-top: 20px; font-size: 14px; color: var(--color-text-light); }
.login-link a { color: var(--color-primary); }
</style>
