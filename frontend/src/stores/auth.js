import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../utils/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('shiguang-token') || '')
  const user = ref(null)
  const showLoginModal = ref(false)
  const loginMode = ref('password')

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function restoreAuth() {
    if (!token.value) return
    try {
      const data = await api.get('/auth/me')
      user.value = data
    } catch {
      clearAuth()
    }
  }

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('shiguang-token', data.token)
    showLoginModal.value = false
    return data
  }

  async function register(email, nickname, password, confirmPassword) {
    const data = await api.post('/auth/register', { email, nickname, password, confirmPassword })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('shiguang-token', data.token)
    showLoginModal.value = false
    return data
  }

  async function otpLogin(email, code) {
    const data = await api.post('/otp/verify', { email, code })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('shiguang-token', data.token)
    showLoginModal.value = false
    return data
  }

  function logout() {
    clearAuth()
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem('shiguang-token')
  }

  return {
    token, user, showLoginModal, loginMode,
    isLoggedIn, isAdmin,
    restoreAuth, login, register, otpLogin, logout, clearAuth
  }
})
