<script setup>
import { ref, reactive, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref('password')
const form = reactive({ email: '', password: '', nickname: '', confirmPassword: '', code: '' })
const error = ref('')
const notice = ref('')
const loading = ref(false)
const otpCooldown = ref(0)
const otpSent = ref(false)
let otpTimer = null

function close() {
  authStore.showLoginModal = false
  error.value = ''
  notice.value = ''
}

function goRegister() {
  close()
  router.push('/register')
}

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(form.email, form.password)
    close()
  } catch (err) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function handleOtpSend() {
  error.value = ''
  notice.value = ''
  try {
    const data = await api.post('/otp/send', { email: form.email })
    otpSent.value = true
    otpCooldown.value = 60
    if (data.developmentCode) {
      notice.value = `SMTP 未配置，开发验证码：${data.developmentCode}`
    } else {
      notice.value = '验证码已发送，请查收邮件（10 分钟内有效）'
    }
    clearInterval(otpTimer)
    otpTimer = setInterval(() => {
      otpCooldown.value--
      if (otpCooldown.value <= 0) clearInterval(otpTimer)
    }, 1000)
  } catch (err) {
    error.value = err.message
  }
}

async function handleOtpLogin() {
  error.value = ''
  notice.value = ''
  loading.value = true
  try {
    await authStore.otpLogin(form.email, form.code)
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => clearInterval(otpTimer))

function goForgotPassword() {
  error.value = ''
  if (!form.email) {
    error.value = '请先输入邮箱'
    return
  }
  api.post('/password/forgot', { email: form.email }).then(() => {
    error.value = '如果该邮箱已注册，您将收到重置邮件'
  }).catch(err => {
    error.value = err.message
  })
}
</script>

<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content login-modal">
      <button class="close-btn" @click="close">×</button>
      <h2>登录</h2>

      <div class="tabs">
        <button :class="{ active: mode === 'password' }" @click="mode = 'password'">密码登录</button>
        <button :class="{ active: mode === 'otp' }" @click="mode = 'otp'">邮箱验证码登录</button>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
      <div v-if="notice" class="notice-msg">{{ notice }}</div>

      <form v-if="mode === 'password'" @submit.prevent="handleLogin">
        <input type="email" v-model="form.email" placeholder="邮箱" required />
        <input type="password" v-model="form.password" placeholder="密码" required />
        <button type="submit" class="btn btn-primary" :disabled="loading" style="width:100%; margin-top:12px;">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <div class="links">
          <a @click="goForgotPassword">忘记密码</a>
          <a @click="goRegister">还没有账号？去注册</a>
        </div>
      </form>

      <form v-else @submit.prevent="handleOtpLogin">
        <div class="otp-row">
          <input type="email" v-model="form.email" placeholder="邮箱" required />
          <button type="button" @click="handleOtpSend" :disabled="otpCooldown > 0" class="btn btn-outline">
            {{ otpCooldown > 0 ? `${otpCooldown}s` : '发送验证码' }}
          </button>
        </div>
        <input type="text" v-model="form.code" placeholder="6 位验证码" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required />
        <button type="submit" class="btn btn-primary" :disabled="loading" style="width:100%; margin-top:12px;">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <div class="links">
          <a @click="mode = 'password'">返回密码登录</a>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-modal { max-width: 420px; }
.close-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  font-size: 24px;
  color: var(--color-text-light);
}
h2 { margin-bottom: 20px; color: var(--color-primary); }
.tabs { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 1px solid var(--color-border); }
.tabs button { padding: 8px 16px; font-size: 14px; border-bottom: 2px solid transparent; }
.tabs button.active { border-color: var(--color-primary); color: var(--color-primary); }
input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  margin-bottom: 12px;
  background: var(--color-bg);
  color: var(--color-text);
}
input:focus { border-color: var(--color-primary); outline: none; }
.error-msg { color: var(--color-danger); font-size: 13px; margin-bottom: 12px; }
.notice-msg { color: var(--color-primary); font-size: 13px; margin-bottom: 12px; }
.otp-row { display: flex; gap: 8px; }
.otp-row input { flex: 1; margin-bottom: 12px; }
.links { display: flex; justify-content: space-between; margin-top: 16px; font-size: 13px; }
.links a { cursor: pointer; color: var(--color-primary); }
</style>
