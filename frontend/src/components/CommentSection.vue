<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import api from '../utils/api'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  articleId: { type: [Number, String], required: true }
})

const authStore = useAuthStore()

const comments = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const loading = ref(false)
const loadError = ref('')

const newComment = ref('')
const parentId = ref(null)
const captcha = reactive({ question: '', token: '', answer: '' })
const captchaError = ref('')
const submitting = ref(false)
const submitError = ref('')

const hasMore = computed(() => page.value < totalPages.value)

onMounted(() => {
  loadCaptcha()
  loadComments()
})

async function loadCaptcha() {
  try {
    const data = await api.get('/comments/captcha')
    captcha.question = data.question
    captcha.token = data.token
    captcha.answer = ''
  } catch {}
}

async function loadComments() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.get(`/comments/article/${props.articleId}?page=${page.value}&pageSize=${pageSize.value}`)
    comments.value = data.items
    total.value = data.total
    totalPages.value = data.totalPages
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (hasMore.value) {
    page.value++
    loadComments()
  }
}

async function submitComment() {
  submitError.value = ''
  captchaError.value = ''

  if (!authStore.isLoggedIn) {
    authStore.showLoginModal = true
    return
  }
  if (newComment.value.trim().length < 5) {
    submitError.value = '评论内容至少 5 个字符'
    return
  }

  submitting.value = true
  try {
    const result = await api.post('/comments', {
      articleId: props.articleId,
      content: newComment.value,
      parentId: parentId.value,
      captchaToken: captcha.token,
      captchaAnswer: captcha.answer
    })

    comments.value.unshift(result)
    newComment.value = ''
    parentId.value = null
    await loadCaptcha()
  } catch (err) {
    if (err.code === 'captchaWrong') {
      captchaError.value = err.message
      await loadCaptcha()
    } else {
      submitError.value = err.message
    }
  } finally {
    submitting.value = false
  }
}

function replyTo(commentId) {
  parentId.value = parentId.value === commentId ? null : commentId
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function deleteComment(id) {
  if (!confirm('确定要删除此评论吗？')) return
  try {
    await api.delete(`/comments/${id}`)
    comments.value = comments.value.filter(c => c.id !== id)
  } catch (err) {
    alert(err.message)
  }
}

const canDelete = (comment) => {
  return authStore.isLoggedIn && (comment.user_id === authStore.user?.id || authStore.isAdmin)
}
</script>

<template>
  <div class="comment-section">
    <h3 class="section-title">评论 ({{ total }})</h3>

    <div class="comment-form">
      <div v-if="!authStore.isLoggedIn" class="login-hint">
        请<a @click="authStore.showLoginModal = true">登录</a>后参与评论
      </div>
      <template v-else>
        <div v-if="parentId" class="reply-hint">
          回复评论中...
          <a @click="parentId = null">取消</a>
        </div>
        <textarea
          v-model="newComment"
          class="comment-input"
          placeholder="写下你的评论..."
          rows="4"
          :disabled="submitting"
        ></textarea>
        <div class="captcha-row">
          <label class="captcha-label">真人验证：{{ captcha.question }}</label>
          <input v-model="captcha.answer" type="number" class="captcha-input" placeholder="答案" />
        </div>
        <div v-if="captchaError" class="error-msg">{{ captchaError }}</div>
        <div v-if="submitError" class="error-msg">{{ submitError }}</div>
        <button class="btn btn-primary" @click="submitComment" :disabled="submitting">
          {{ submitting ? '提交中...' : '提交评论' }}
        </button>
      </template>
    </div>

    <div class="comment-list">
      <div v-for="comment in comments" :key="comment.id" class="comment-item">
        <div class="comment-main">
          <div class="comment-avatar">
            <img v-if="comment.avatar" :src="comment.avatar" />
            <span v-else>{{ comment.nickname?.charAt(0) }}</span>
          </div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author">{{ comment.nickname }}</span>
              <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
            </div>
            <p class="comment-content">{{ comment.content }}</p>
            <div class="comment-actions">
              <button class="action-btn" @click="replyTo(comment.id)">回复</button>
              <button v-if="canDelete(comment)" class="action-btn danger" @click="deleteComment(comment.id)">删除</button>
            </div>
          </div>
        </div>

        <div v-if="comment.replies && comment.replies.length > 0" class="replies">
          <div v-for="reply in comment.replies" :key="reply.id" class="comment-item reply-item">
            <div class="comment-avatar small">
              <img v-if="reply.avatar" :src="reply.avatar" />
              <span v-else>{{ reply.nickname?.charAt(0) }}</span>
            </div>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-author">{{ reply.nickname }}</span>
                <span class="comment-date">{{ formatDate(reply.created_at) }}</span>
              </div>
              <p class="comment-content">{{ reply.content }}</p>
              <div v-if="canDelete(reply)" class="comment-actions">
                <button class="action-btn danger" @click="deleteComment(reply.id)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><span class="loading-spinner"></span> 加载中...</div>
    <div v-else-if="loadError" class="error-state">
      {{ loadError }}
      <button class="btn btn-outline" @click="loadComments">重试</button>
    </div>
    <div v-else-if="hasMore" class="load-more">
      <button class="btn btn-outline" @click="loadMore">加载更多</button>
    </div>
    <div v-else-if="comments.length === 0" class="empty-state">暂无评论</div>
  </div>
</template>

<style scoped>
.comment-section { margin-top: 40px; }
.section-title { font-size: 18px; margin-bottom: 20px; }
.comment-form { margin-bottom: 32px; }
.login-hint { padding: 16px; background: var(--color-bg-alt); border-radius: var(--radius); font-size: 14px; }
.login-hint a { cursor: pointer; color: var(--color-primary); }
.reply-hint { font-size: 13px; color: var(--color-primary); margin-bottom: 8px; }
.reply-hint a { cursor: pointer; margin-left: 8px; }
.comment-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  resize: vertical;
  background: var(--color-bg);
  color: var(--color-text);
}
.captcha-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.captcha-label { font-size: 14px; }
.captcha-input { width: 80px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-bg); color: var(--color-text); }
.error-msg { color: var(--color-danger); font-size: 13px; margin-top: 8px; }
.comment-list { display: flex; flex-direction: column; gap: 20px; }
.comment-item { display: flex; gap: 12px; }
.comment-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 600;
  flex-shrink: 0;
}
.comment-avatar.small { width: 32px; height: 32px; font-size: 14px; }
.comment-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.comment-body { flex: 1; }
.comment-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.comment-author { font-weight: 600; font-size: 14px; }
.comment-date { font-size: 12px; color: var(--color-text-light); }
.comment-content { font-size: 14px; line-height: 1.6; }
.comment-actions { display: flex; gap: 12px; margin-top: 8px; }
.action-btn { font-size: 13px; color: var(--color-text-light); cursor: pointer; }
.action-btn.danger { color: var(--color-danger); }
.replies { margin-left: 52px; margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
.loading-state, .error-state, .load-more { text-align: center; padding: 20px; }
.empty-state { text-align: center; padding: 40px; color: var(--color-text-light); }
</style>
