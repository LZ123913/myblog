<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'
import { useBackgroundStore } from '../stores/background'

const router = useRouter()
const authStore = useAuthStore()
const bgStore = useBackgroundStore()

const step = ref(1)
const draftId = ref(null)
const loading = ref(false)
const error = ref('')

const importForm = reactive({
  rawContent: '',
  title: '',
  images: []
})
const imagePreviews = ref([])

const polishForm = reactive({
  polishedContent: '',
  originalContent: '',
  polishing: false,
  polishError: ''
})

const tagForm = reactive({
  recommendedTags: [],
  selectedTags: [],
  customTag: '',
  loadingTags: false
})

const publishForm = reactive({
  title: '',
  content: '',
  categoryId: '',
  coverImage: ''
})
const categories = ref([])
const coverPreview = ref(null)

async function handleCoverUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const data = await api.upload('/uploads/image', formData)
    if (data.urls && data.urls.length > 0) {
      publishForm.coverImage = data.urls[0]
      coverPreview.value = data.urls[0]
    }
  } catch (err) {
    error.value = '封面上传失败：' + err.message
  }
}

function selectDefaultCover(idx) {
  publishForm.coverImage = `/cover-${idx}.jpg`
  coverPreview.value = `/cover-${idx}.jpg`
}

const steps = [
  { num: 1, label: '导入笔记' },
  { num: 2, label: 'AI润色' },
  { num: 3, label: '标签推荐' },
  { num: 4, label: '发布确认' }
]

onMounted(async () => {
  try {
    const data = await api.get('/categories')
    categories.value = data.items || []
  } catch {}
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const editDraftId = urlParams.get('draft')
  bgStore.setBackground('/bg-default.jpg', true)
  if (editDraftId) {
    await loadDraft(parseInt(editDraftId))
  }
})

async function loadDraft(id) {
  try {
    const draft = await api.get(`/drafts/${id}`)
    draftId.value = id
    importForm.rawContent = draft.raw_content || ''
    importForm.title = draft.title || ''
    polishForm.originalContent = draft.raw_content || ''
    polishForm.polishedContent = draft.polished_content || ''
    tagForm.selectedTags = JSON.parse(draft.tags || '[]')
    publishForm.categoryId = draft.category_id || ''
    if (draft.status === 'imported') step.value = 2
    else if (draft.status === 'polished') step.value = 3
    else if (draft.status === 'tagged') step.value = 4
  } catch (err) {
    error.value = err.message
  }
}

async function handleFileUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const data = await api.upload('/uploads/note', formData)
    importForm.rawContent = data.content
    importForm.title = data.metadata.title
    polishForm.originalContent = data.content
  } catch (err) {
    error.value = err.message
  }
}

function handleTextInput() {
  polishForm.originalContent = importForm.rawContent
}

function handleImageDrop(e) {
  e.preventDefault()
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  for (const file of files) {
    const url = URL.createObjectURL(file)
    imagePreviews.value.push({ url, file })
  }
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
  for (const file of files) {
    const url = URL.createObjectURL(file)
    imagePreviews.value.push({ url, file })
  }
}

function removeImage(idx) {
  imagePreviews.value.splice(idx, 1)
}

async function confirmImport() {
  if (!importForm.rawContent) {
    error.value = '请导入笔记内容'
    return
  }
  loading.value = true
  try {
    let uploadedImages = []
    if (imagePreviews.value.length > 0) {
      const formData = new FormData()
      for (const preview of imagePreviews.value) {
        formData.append('images', preview.file)
      }
      const uploadResult = await api.upload('/uploads/image', formData)
      uploadedImages = uploadResult.urls
    }

    if (draftId.value) {
      await api.put(`/drafts/${draftId.value}`, {
        title: importForm.title,
        rawContent: importForm.rawContent,
        images: uploadedImages,
        status: 'imported'
      })
    } else {
      const result = await api.post('/drafts', {
        title: importForm.title,
        rawContent: importForm.rawContent,
        status: 'imported'
      })
      draftId.value = result.id
      if (uploadedImages.length > 0) {
        await api.put(`/drafts/${draftId.value}`, { images: uploadedImages })
      }
    }
    polishForm.originalContent = importForm.rawContent
    step.value = 2
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function doPolish() {
  polishForm.polishing = true
  polishForm.polishError = ''
  try {
    const result = await api.post(`/drafts/${draftId.value}/polish`, {})
    polishForm.polishedContent = result.polishedContent
    await api.put(`/drafts/${draftId.value}`, {
      polishedContent: result.polishedContent,
      status: 'polished'
    })
  } catch (err) {
    if (err.code === 'aiTimeout') {
      polishForm.polishError = 'AI服务繁忙，请稍后重试'
    } else {
      polishForm.polishError = err.message
    }
  } finally {
    polishForm.polishing = false
  }
}

function acceptPolish() {
  step.value = 3
  loadRecommendedTags()
}

async function loadRecommendedTags() {
  tagForm.loadingTags = true
  try {
    const result = await api.post(`/drafts/${draftId.value}/recommend-tags`, {})
    tagForm.recommendedTags = result.tags || []
  } catch {
    tagForm.recommendedTags = []
  } finally {
    tagForm.loadingTags = false
  }
}

function toggleTag(tag) {
  const idx = tagForm.selectedTags.indexOf(tag)
  if (idx > -1) {
    tagForm.selectedTags.splice(idx, 1)
  } else {
    tagForm.selectedTags.push(tag)
  }
}

function addCustomTag() {
  const tag = tagForm.customTag.trim()
  if (!tag) return
  if (!tagForm.recommendedTags.includes(tag)) {
    tagForm.recommendedTags.push(tag)
  }
  if (!tagForm.selectedTags.includes(tag)) {
    tagForm.selectedTags.push(tag)
  }
  tagForm.customTag = ''
}

async function confirmTags() {
  if (tagForm.selectedTags.length === 0) {
    error.value = '请至少选择一个标签'
    return
  }
  try {
    await api.put(`/drafts/${draftId.value}`, {
      tags: tagForm.selectedTags,
      status: 'tagged'
    })
    publishForm.title = importForm.title
    publishForm.content = polishForm.polishedContent
    step.value = 4
  } catch (err) {
    error.value = err.message
  }
}

async function publish() {
  if (!publishForm.title || !publishForm.content || !publishForm.categoryId) {
    error.value = '标题、正文和分类不能为空'
    return
  }
  loading.value = true
  try {
    const result = await api.post(`/drafts/${draftId.value}/publish`, {
      title: publishForm.title,
      content: publishForm.content,
      tags: tagForm.selectedTags,
      categoryId: publishForm.categoryId,
      coverImage: publishForm.coverImage
    })
    router.push(`/article/${result.slug}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="creator-page container">
    <h1 class="page-title">创作中心</h1>

    <div class="steps-bar">
      <div v-for="s in steps" :key="s.num" :class="['step', { active: step >= s.num, current: step === s.num }]">
        <span class="step-num">{{ s.num }}</span>
        <span class="step-label">{{ s.label }}</span>
      </div>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <!-- Step 1: Import -->
    <div v-if="step === 1" class="step-content">
      <h2>第一步：导入笔记</h2>
      <div class="import-panel">
        <div class="import-options">
          <label class="upload-btn">
            上传文件 (.md/.txt/.docx)
            <input type="file" accept=".md,.txt,.doc,.docx" @change="handleFileUpload" hidden />
          </label>
        </div>
        <div class="text-input">
          <input v-model="importForm.title" placeholder="笔记标题" class="title-input" />
          <textarea v-model="importForm.rawContent" placeholder="或粘贴纯文本内容..." rows="10" class="content-input" @input="handleTextInput"></textarea>
        </div>
        <div class="image-upload" @drop="handleImageDrop" @dragover.prevent>
          <p>拖拽图片到此处或 <label class="upload-btn">选择图片<input type="file" accept="image/*" multiple @change="handleImageSelect" hidden /></label></p>
          <div v-if="imagePreviews.length > 0" class="image-previews">
            <div v-for="(preview, idx) in imagePreviews" :key="idx" class="image-preview">
              <img :src="preview.url" />
              <button @click="removeImage(idx)">×</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" @click="confirmImport" :disabled="loading">确认导入</button>
      </div>
    </div>

    <!-- Step 2: Polish -->
    <div v-if="step === 2" class="step-content">
      <h2>第二步：AI润色</h2>
      <div class="polish-panel">
        <div class="compare-view">
          <div class="compare-left">
            <h3>原始内容</h3>
            <div class="compare-content original">{{ polishForm.originalContent }}</div>
          </div>
          <div class="compare-right">
            <h3>润色结果</h3>
            <div class="compare-content polished">{{ polishForm.polishedContent || '点击"一键润色"生成...' }}</div>
          </div>
        </div>
        <div v-if="polishForm.polishError" class="error-msg">{{ polishForm.polishError }}</div>
        <div class="polish-actions">
          <button class="btn btn-primary" @click="doPolish" :disabled="polishForm.polishing">
            {{ polishForm.polishing ? '润色中...' : '一键润色' }}
          </button>
          <button v-if="polishForm.polishedContent" class="btn btn-outline" @click="doPolish" :disabled="polishForm.polishing">重新润色</button>
          <button v-if="polishForm.polishedContent" class="btn btn-primary" @click="acceptPolish">接受全部</button>
        </div>
      </div>
    </div>

    <!-- Step 3: Tags -->
    <div v-if="step === 3" class="step-content">
      <h2>第三步：标签推荐</h2>
      <div class="tag-panel">
        <div v-if="tagForm.loadingTags" class="loading-state"><span class="loading-spinner"></span> 推荐标签中...</div>
        <div v-else class="recommended-tags">
          <span v-for="tag in tagForm.recommendedTags" :key="tag"
            :class="['tag-pill', { selected: tagForm.selectedTags.includes(tag) }]"
            @click="toggleTag(tag)">{{ tag }}</span>
        </div>
        <div class="custom-tag">
          <input v-model="tagForm.customTag" placeholder="输入新标签" @keyup.enter="addCustomTag" class="tag-input" />
          <button class="btn btn-outline" @click="addCustomTag">添加</button>
        </div>
        <button class="btn btn-primary" @click="confirmTags">下一步</button>
      </div>
    </div>

    <!-- Step 4: Publish -->
    <div v-if="step === 4" class="step-content">
      <h2>第四步：发布确认</h2>
      <div class="publish-panel">
        <div class="publish-preview">
          <label>标题</label>
          <input v-model="publishForm.title" class="form-input" />
          <label>分类</label>
          <select v-model="publishForm.categoryId" class="form-input">
            <option value="">请选择分类</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <label>正文预览</label>
          <div class="content-preview">{{ publishForm.content.substring(0, 500) }}...</div>
          <label>标签</label>
          <div class="tag-list">
            <span v-for="tag in tagForm.selectedTags" :key="tag" class="tag-pill selected">{{ tag }}</span>
          </div>
          <label>封面图</label>
          <div class="cover-selector">
            <div class="cover-preview" v-if="coverPreview">
              <img :src="coverPreview" alt="封面预览" />
            </div>
            <div class="cover-options">
              <label class="cover-upload-btn">
                上传自定义封面
                <input type="file" accept="image/*" @change="handleCoverUpload" hidden />
              </label>
              <div class="default-covers">
                <span class="default-covers-label">或选择预设：</span>
                <div class="default-cover-list">
                  <img v-for="i in 3" :key="i" :src="`/cover-${i}.jpg`"
                    :class="['default-cover', { selected: publishForm.coverImage === `/cover-${i}.jpg` }]"
                    @click="selectDefaultCover(i)" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" @click="publish" :disabled="loading">确认发布</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.creator-page {
  padding-top: calc(var(--nav-height) + 20px);
  padding-bottom: 40px;
  max-width: 900px;
  background: var(--color-bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  margin-top: 20px;
  margin-bottom: 20px;
  padding: 30px;
}
.page-title { font-size: 24px; margin-bottom: 24px; }
.steps-bar { display: flex; gap: 0; margin-bottom: 30px; }
.step { display: flex; align-items: center; gap: 8px; padding: 8px 16px; opacity: 0.5; }
.step.active { opacity: 1; }
.step.current .step-num { background: var(--color-primary); color: #fff; }
.step-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--color-border); font-size: 14px; }
.step-label { font-size: 14px; }
.step-content h2 { font-size: 20px; margin-bottom: 20px; }
.import-panel { display: flex; flex-direction: column; gap: 20px; }
.upload-btn { display: inline-block; padding: 8px 16px; border: 1px dashed var(--color-border); border-radius: var(--radius); cursor: pointer; font-size: 14px; color: var(--color-primary); }
.upload-btn:hover { background: var(--color-bg-alt); }
.title-input, .content-input, .form-input, .tag-input { width: 100%; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 14px; background: var(--color-bg); color: var(--color-text); }
.content-input { resize: vertical; font-family: monospace; }
.image-upload { padding: 30px; border: 2px dashed var(--color-border); border-radius: var(--radius); text-align: center; }
.image-previews { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.image-preview { position: relative; width: 80px; height: 80px; }
.image-preview img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius); }
.image-preview button { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border-radius: 50%; background: var(--color-danger); color: #fff; font-size: 12px; }
.compare-view { display: flex; gap: 20px; }
.compare-left, .compare-right { flex: 1; }
.compare-left h3, .compare-right h3 { font-size: 14px; margin-bottom: 12px; color: var(--color-text-light); }
.compare-content { padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius); min-height: 300px; max-height: 400px; overflow-y: auto; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
.compare-content.original { background: var(--color-bg-alt); color: var(--color-text-light); }
.polish-actions { display: flex; gap: 12px; margin-top: 20px; }
.recommended-tags { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.custom-tag { display: flex; gap: 8px; margin-bottom: 20px; }
.custom-tag input { flex: 1; margin-bottom: 20px; }
.publish-preview { display: flex; flex-direction: column; gap: 12px; }
.cover-selector { display: flex; gap: 20px; flex-wrap: wrap; }
.cover-preview { width: 200px; height: 120px; overflow: hidden; border-radius: var(--radius); box-shadow: var(--shadow-sm); }
.cover-preview img { width: 100%; height: 100%; object-fit: cover; }
.cover-options { flex: 1; display: flex; flex-direction: column; gap: 12px; }
.cover-upload-btn { display: inline-block; padding: 8px 16px; border: 1px dashed var(--color-primary); border-radius: var(--radius); cursor: pointer; font-size: 14px; color: var(--color-primary); text-align: center; transition: all var(--transition); }
.cover-upload-btn:hover { background: var(--color-primary-light); }
.default-covers-label { font-size: 13px; color: var(--color-text-light); }
.default-cover-list { display: flex; gap: 8px; margin-top: 6px; }
.default-cover { width: 60px; height: 40px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all var(--transition); }
.default-cover:hover { border-color: var(--color-primary); }
.default-cover.selected { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3); }
.publish-preview label { font-size: 14px; font-weight: 600; }
.content-preview { padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 14px; color: var(--color-text-light); max-height: 200px; overflow-y: auto; }
.tag-list { display: flex; gap: 8px; flex-wrap: wrap; }
.error-msg { color: var(--color-danger); padding: 12px; background: #FFF0F0; border-radius: var(--radius); margin-bottom: 16px; }
.loading-state { text-align: center; padding: 20px; }
@media (max-width: 768px) {
  .compare-view { flex-direction: column; }
  .steps-bar { overflow-x: auto; }
}
</style>
