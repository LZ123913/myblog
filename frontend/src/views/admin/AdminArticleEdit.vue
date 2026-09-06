<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/auth'
import { useBackgroundStore } from '../../stores/background'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const articleId = computed(() => route.params.id)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const formError = ref('')
const showToast = ref(false)

const categories = ref([])

const form = reactive({
  title: '',
  content: '',
  tags: '',
  categoryId: '',
  coverImage: ''
})

onMounted(async () => {
  bgStore.setBackground('/bg-default.jpg', true)
  await Promise.all([loadArticle(), loadCategories()])
})

async function loadCategories() {
  try {
    const data = await api.get('/categories')
    categories.value = data.items || data || []
  } catch {
    // categories optional
  }
}

async function loadArticle() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get(`/articles/admin/list?page=1&pageSize=1000`)
    const items = data.items || data.articles || []
    const found = items.find(a => String(a.id) === String(articleId.value))
    if (!found) throw { message: '文章不存在' }
    form.title = found.title || ''
    form.content = found.content || ''
    form.tags = Array.isArray(found.tags) ? found.tags.join(', ') : (found.tags || '')
    form.categoryId = found.category_id || found.categoryId || ''
    form.coverImage = found.cover_image || found.coverImage || ''
  } catch (err) {
    error.value = err.message || '文章加载失败'
  } finally {
    loading.value = false
  }
}

function validate() {
  formError.value = ''
  if (!form.title.trim()) {
    formError.value = '标题不能为空'
    return false
  }
  if (!form.content.trim()) {
    formError.value = '正文不能为空'
    return false
  }
  return true
}

async function handleCoverUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const data = await api.upload('/uploads/image', formData)
    form.coverImage = data.url || data.path || ''
  } catch (err) {
    formError.value = err.message || '封面上传失败'
  }
}

async function save() {
  if (!validate()) return
  saving.value = true
  formError.value = ''
  try {
    const tagsArray = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      title: form.title.trim(),
      content: form.content,
      tags: tagsArray,
      categoryId: form.categoryId || undefined,
      coverImage: form.coverImage || undefined
    }
    await api.put(`/articles/${articleId.value}`, payload)
    showToast.value = true
    setTimeout(() => {
      showToast.value = false
      router.push('/admin/articles')
    }, 1200)
  } catch (err) {
    formError.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push('/admin/articles')
}
</script>

<template>
  <div class="container admin-article-edit">
    <div class="page-header">
      <h1 class="page-title">编辑文章</h1>
      <button class="btn btn-outline" @click="cancel">返回列表</button>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>

    <div v-else-if="error" class="error-state">
      <h3>{{ error }}</h3>
      <button class="btn btn-outline" @click="cancel">返回列表</button>
    </div>

    <div v-else class="edit-form">
      <div v-if="formError" class="error-msg">{{ formError }}</div>

      <div class="form-group">
        <label class="form-label">标题 <span class="required">*</span></label>
        <input v-model="form.title" class="form-input" placeholder="请输入文章标题" />
      </div>

      <div class="form-group">
        <label class="form-label">分类</label>
        <select v-model="form.categoryId" class="form-input">
          <option value="">请选择分类</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">标签</label>
        <input v-model="form.tags" class="form-input" placeholder="多个标签用逗号分隔" />
      </div>

      <div class="form-group">
        <label class="form-label">封面图片</label>
        <div class="cover-upload">
          <div v-if="form.coverImage" class="cover-preview">
            <img :src="form.coverImage" alt="封面预览" />
            <button class="remove-cover" @click="form.coverImage = ''">×</button>
          </div>
          <label v-else class="upload-area">
            <span>点击上传封面</span>
            <input type="file" accept="image/*" @change="handleCoverUpload" hidden />
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">正文内容 <span class="required">*</span></label>
        <textarea v-model="form.content" class="form-input content-textarea" rows="20" placeholder="请输入正文（支持 Markdown）"></textarea>
      </div>

      <div class="form-actions">
        <button class="btn btn-outline" @click="cancel" :disabled="saving">取消</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="showToast" class="toast">保存成功</div>
    </Transition>
  </div>
</template>

<style scoped>
.admin-article-edit { padding-top: calc(var(--nav-height) + 20px); padding-bottom: 40px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 700; }
.edit-form { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow-sm); }
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.required { color: var(--color-danger); }
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: inherit;
}
.form-input:focus { outline: none; border-color: var(--color-primary); }
.content-textarea { resize: vertical; min-height: 300px; font-family: 'Fira Code', 'Consolas', monospace; line-height: 1.6; }
.cover-upload { width: 100%; }
.cover-preview { position: relative; display: inline-block; }
.cover-preview img { max-width: 300px; max-height: 200px; border-radius: var(--radius); border: 1px solid var(--color-border); }
.remove-cover { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: var(--color-danger); color: #fff; font-size: 14px; display: flex; align-items: center; justify-content: center; }
.upload-area { display: flex; align-items: center; justify-content: center; width: 300px; height: 180px; border: 2px dashed var(--color-border); border-radius: var(--radius); color: var(--color-text-light); cursor: pointer; font-size: 14px; }
.upload-area:hover { border-color: var(--color-primary); color: var(--color-primary); }
.form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.error-msg { color: var(--color-danger); padding: 12px; background: rgba(245, 108, 108, 0.1); border-radius: var(--radius); margin-bottom: 16px; font-size: 14px; }
.loading-state { text-align: center; padding: 60px 20px; }
.toast {
  position: fixed;
  top: calc(var(--nav-height) + 20px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-success);
  color: #fff;
  padding: 10px 24px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 1000;
  font-size: 14px;
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
@media (max-width: 768px) {
  .edit-form { padding: 16px; }
  .upload-area { width: 100%; }
}
</style>
