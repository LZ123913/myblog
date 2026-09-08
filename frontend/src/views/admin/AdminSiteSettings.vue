<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'
import { useSiteStore } from '../../stores/site'

const authStore = useAuthStore()
const bgStore = useBackgroundStore()
const siteStore = useSiteStore()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saveMsg = ref('')

const settings = reactive({
  blog_name: '',
  blog_subtitle: '',
  author_name: '',
  author_avatar: '',
  mottos: []
})

// 关于我（authors 表）：座右铭式一句话介绍 + 自我介绍
const authorProfile = reactive({
  id: null,
  motto: '',
  bio: ''
})

const newMotto = ref('')

onMounted(() => {
  bgStore.setBackground('/bg-default.jpg', true)
  loadSettings()
  loadAuthor()
})

async function loadAuthor() {
  try {
    const data = await api.get('/authors')
    if (data && data.id) {
      authorProfile.id = data.id
      authorProfile.motto = data.motto || ''
      authorProfile.bio = data.bio || ''
    }
  } catch (err) {
    error.value = err.message || '加载作者信息失败'
  }
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/site-settings')
    Object.assign(settings, data)
    if (!Array.isArray(settings.mottos)) settings.mottos = []
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  saveMsg.value = ''
  error.value = ''
  try {
    const data = await api.put('/site-settings', {
      blog_name: settings.blog_name,
      blog_subtitle: settings.blog_subtitle,
      author_name: settings.author_name,
      author_avatar: settings.author_avatar,
      mottos: settings.mottos
    })
    Object.assign(settings, data)
    // 同步保存「关于我」（昵称/头像同步进 authors 表，保持全站一致）
    if (authorProfile.id) {
      await api.put(`/authors/${authorProfile.id}`, {
        name: settings.author_name,
        avatar: settings.author_avatar,
        motto: authorProfile.motto,
        bio: authorProfile.bio
      })
    }
    // 同步更新全局store，导航栏、关于我等页面立即生效
    siteStore.settings = data
    siteStore.loaded = true
    saveMsg.value = '保存成功 ✓'
    setTimeout(() => { saveMsg.value = '' }, 2000)
  } catch (err) {
    error.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function addMotto() {
  const text = newMotto.value.trim()
  if (!text) return
  settings.mottos.push(text)
  newMotto.value = ''
}

function removeMotto(idx) {
  settings.mottos.splice(idx, 1)
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const data = await api.upload('/uploads/image', formData)
    if (data.urls && data.urls.length > 0) {
      settings.author_avatar = data.urls[0]
    }
  } catch (err) {
    error.value = '头像上传失败：' + err.message
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h1 class="page-title">
        <span class="title-icon">🏠</span> 主页编辑
      </h1>
      <p class="page-desc">设置博客名称、作者信息和座右铭，打造你的专属主页</p>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span> 加载中...
    </div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-primary" @click="loadSettings">重试</button>
    </div>

    <div v-else class="settings-container">
      <!-- 基础信息卡片 -->
      <div class="setting-card">
        <div class="card-header">
          <span class="card-icon">📝</span>
          <h3>基础信息</h3>
        </div>
        <div class="card-body">
          <div class="form-row avatar-row">
            <div class="form-label">作者头像</div>
            <div class="form-value">
              <div class="avatar-upload">
                <div class="avatar-preview">
                  <img v-if="settings.author_avatar" :src="settings.author_avatar" />
                  <span v-else class="avatar-placeholder">
                    {{ settings.author_name?.charAt(0) || '作' }}
                  </span>
                </div>
                <label class="upload-btn">
                  <span>更换头像</span>
                  <input type="file" accept="image/*" @change="handleAvatarUpload" hidden />
                </label>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">博客名称</div>
            <div class="form-value">
              <input type="text" v-model="settings.blog_name" class="form-input" placeholder="拾光集" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">博客副标题</div>
            <div class="form-value">
              <input type="text" v-model="settings.blog_subtitle" class="form-input" placeholder="记录每一束思想的光" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-label">作者昵称</div>
            <div class="form-value">
              <input type="text" v-model="settings.author_name" class="form-input" placeholder="拾光者" />
            </div>
          </div>
        </div>
      </div>

      <!-- 关于我卡片 -->
      <div class="setting-card">
        <div class="card-header">
          <span class="card-icon">🙋</span>
          <div>
            <h3>关于我</h3>
            <p class="card-desc">展示在「关于」页面，仅管理员可编辑</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-label">一句话介绍</div>
            <div class="form-value">
              <input type="text" v-model="authorProfile.motto" class="form-input" placeholder="例如：全栈新手，记录学习的每一步" />
            </div>
          </div>
          <div class="form-row bio-row">
            <div class="form-label">自我介绍</div>
            <div class="form-value">
              <textarea
                v-model="authorProfile.bio"
                class="form-input form-textarea"
                rows="5"
                placeholder="介绍一下自己：经历、兴趣、想分享的事..."
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- 座右铭卡片 -->
      <div class="setting-card">
        <div class="card-header">
          <span class="card-icon">✨</span>
          <div>
            <h3>座右铭</h3>
            <p class="card-desc">分享卡片会随机展示一条，每次都不一样</p>
          </div>
        </div>
        <div class="card-body">
          <div class="motto-add">
            <input
              type="text"
              v-model="newMotto"
              class="form-input"
              placeholder="输入一句座右铭..."
              @keyup.enter="addMotto"
            />
            <button class="btn btn-primary" @click="addMotto">添加</button>
          </div>
          <div class="motto-list">
            <div
              v-for="(motto, idx) in settings.mottos"
              :key="idx"
              class="motto-item"
            >
              <span class="motto-num">{{ idx + 1 }}</span>
              <span class="motto-text">{{ motto }}</span>
              <button class="motto-delete" @click="removeMotto(idx)" title="删除">×</button>
            </div>
            <div v-if="settings.mottos.length === 0" class="empty-hint">
              还没有座右铭，添加几条试试吧～
            </div>
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="save-section">
        <span v-if="saveMsg" class="save-success">{{ saveMsg }}</span>
        <button class="btn btn-primary btn-save" @click="saveSettings" :disabled="saving">
          {{ saving ? '保存中...' : '💾 保存设置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}
.page-header {
  text-align: center;
  margin-bottom: 40px;
}
.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--color-text);
}
.title-icon { margin-right: 8px; }
.page-desc {
  color: var(--color-text-muted);
  font-size: 14px;
  margin: 0;
}

.setting-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  margin-bottom: 24px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--glass-border);
}
.card-icon { font-size: 24px; }
.card-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}
.card-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
}
.card-body { padding: 24px; }

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 20px;
}
.form-row:last-child { margin-bottom: 0; }
.form-label {
  width: 100px;
  font-size: 14px;
  color: var(--color-text-light);
  flex-shrink: 0;
  font-weight: 500;
}
.form-value { flex: 1; }
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.5);
  color: var(--color-text);
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #00d4ff);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
}

.avatar-row { align-items: flex-start; }
.bio-row { align-items: flex-start; }
.form-textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.7;
  font-family: inherit;
}
.avatar-upload {
  display: flex;
  align-items: center;
  gap: 20px;
}
.avatar-preview {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid rgba(0, 212, 255, 0.3);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 28px;
  font-weight: 600;
}
.upload-btn {
  padding: 8px 18px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
}
.upload-btn:hover {
  border-color: var(--color-primary, #00d4ff);
  color: var(--color-primary, #00d4ff);
}

.motto-add {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.motto-add .form-input { flex: 1; }

.motto-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.motto-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  transition: transform 0.2s, box-shadow 0.2s;
}
.motto-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.motto-num {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
}
.motto-text {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
}
.motto-delete {
  width: 26px;
  height: 26px;
  border: none;
  background: rgba(255, 100, 100, 0.1);
  color: #ff6b6b;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.motto-delete:hover {
  background: #ff6b6b;
  color: #fff;
  transform: scale(1.1);
}

.empty-hint {
  text-align: center;
  padding: 30px 20px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.save-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 32px;
}
.save-success {
  color: #10b981;
  font-size: 14px;
  font-weight: 500;
}
.btn-save {
  padding: 12px 40px;
  font-size: 15px;
  font-weight: 600;
}

.loading-state, .error-state {
  text-align: center;
  padding: 80px 20px;
}
.loading-spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary, #00d4ff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
