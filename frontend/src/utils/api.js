import { useAuthStore } from '../stores/auth'
import router from '../router'

const BASE = '/api'

async function request(method, path, body, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('shiguang-token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const config = {
    method,
    headers: { ...headers, ...options.headers },
    signal: options.signal
  }

  if (body) {
    if (body instanceof FormData) {
      delete config.headers['Content-Type']
      config.body = body
    } else {
      config.body = JSON.stringify(body)
    }
  }

  try {
    const res = await fetch(`${BASE}${path}`, config)

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      const authStore = useAuthStore()
      authStore.clearAuth()
      if (data.error === 'tokenExpired' || data.error === 'tokenInvalid' || data.error === 'loginRequired') {
        if (router.currentRoute.value.meta.requiresAuth !== false) {
          authStore.showLoginModal = true
        }
      }
      throw { code: data.error || 'loginRequired', message: data.message || '请先登录' }
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      throw { code: data.error || 'forbidden', message: data.message || '无权限操作' }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw { code: data.error || 'requestFailed', message: data.message || '请求失败', retryable: data.retryable }
    }

    return await res.json()
  } catch (err) {
    if (err.code) throw err
    if (err.name === 'AbortError') throw { code: 'timeout', message: '请求超时' }
    throw { code: 'networkError', message: '网络错误，请检查连接', retryable: true }
  }
}

export const api = {
  get: (path, options) => request('GET', path, null, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  delete: (path, body, options) => request('DELETE', path, body, options),
  upload: (path, formData, options) => request('POST', path, formData, options)
}

export default api
