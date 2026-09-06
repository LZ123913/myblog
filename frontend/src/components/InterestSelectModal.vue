<template>
  <div v-if="visible" class="interest-overlay" @click.self="handleClose">
    <div class="interest-modal">
      <div class="interest-header">
        <h2>选择你感兴趣的方向</h2>
        <p>选择 3~5 个标签，我们将为你精准推荐文章</p>
      </div>

      <div class="interest-tags">
        <button
          v-for="tag in availableTags"
          :key="tag"
          class="interest-tag"
          :class="{ active: selectedTags.includes(tag) }"
          @click="toggleTag(tag)"
        >
          <span class="tag-check" v-if="selectedTags.includes(tag)">✓</span>
          {{ tag }}
        </button>
      </div>

      <div class="interest-footer">
        <span class="select-count" :class="{ valid: selectedTags.length >= 3 }">
          已选 {{ selectedTags.length }} 个{{ selectedTags.length >= 3 ? ' ✓' : ` (至少选3个)` }}
        </span>
        <div class="footer-actions">
          <button class="btn-skip" @click="handleSkip">跳过</button>
          <button
            class="btn-confirm"
            :disabled="selectedTags.length < 3"
            @click="handleConfirm"
          >
            确认选择
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['confirm', 'skip'])

const availableTags = [
  'Vue', 'Node.js', 'JavaScript', '工程化', 'Express', 'SQLite',
  'AI', '通义千问', '性能优化', 'Vite', 'TypeScript', '随笔'
]

const selectedTags = ref([])

function toggleTag(tag) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx > -1) {
    selectedTags.value.splice(idx, 1)
  } else {
    if (selectedTags.value.length < 8) {
      selectedTags.value.push(tag)
    }
  }
}

function handleConfirm() {
  if (selectedTags.value.length < 3) return
  emit('confirm', [...selectedTags.value])
  selectedTags.value = []
}

function handleSkip() {
  emit('skip')
  selectedTags.value = []
}

function handleClose() {
  emit('close')
  selectedTags.value = []
}
</script>

<style scoped>
.interest-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.4s ease;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.interest-modal {
  background: rgba(30, 35, 60, 0.95);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 20px;
  padding: 40px 36px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 212, 255, 0.1);
  animation: modalIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.interest-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
  text-align: center;
}

.interest-header p {
  font-size: 14px;
  color: #b0b0c0;
  text-align: center;
  margin-bottom: 28px;
}

.interest-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-bottom: 28px;
}

.interest-tag {
  position: relative;
  padding: 10px 20px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.05);
  color: #d0d0e0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.interest-tag:hover {
  border-color: rgba(0, 212, 255, 0.5);
  background: rgba(0, 212, 255, 0.08);
  color: #fff;
  transform: translateY(-2px);
}

.interest-tag.active {
  border-color: #00d4ff;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 150, 200, 0.15));
  color: #fff;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
}

.tag-check {
  font-size: 14px;
  color: #00d4ff;
  font-weight: bold;
}

.interest-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.select-count {
  font-size: 13px;
  color: #808090;
  transition: color 0.3s;
}

.select-count.valid {
  color: #00ff88;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn-skip {
  padding: 10px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: transparent;
  color: #b0b0c0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s;
}

.btn-skip:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.btn-confirm {
  padding: 10px 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #00d4ff, #0099cc);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s;
}

.btn-confirm:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  transform: translateY(-1px);
}

.btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

:global(body.light-bg-mode) .interest-modal {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 150, 200, 0.3);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

:global(body.light-bg-mode) .interest-header h2 {
  color: #1a1a2e;
}

:global(body.light-bg-mode) .interest-header p {
  color: #5a5a6a;
}

:global(body.light-bg-mode) .interest-tag {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.03);
  color: #3a3a4a;
}

:global(body.light-bg-mode) .interest-tag:hover {
  border-color: rgba(0, 150, 200, 0.5);
  background: rgba(0, 212, 255, 0.08);
  color: #1a1a2e;
}

:global(body.light-bg-mode) .interest-tag.active {
  border-color: #0099cc;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 150, 200, 0.1));
  color: #0066aa;
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2);
}

:global(body.light-bg-mode) .tag-check {
  color: #0099cc;
}

:global(body.light-bg-mode) .btn-skip {
  border-color: rgba(0, 0, 0, 0.12);
  color: #5a5a6a;
}

:global(body.light-bg-mode) .btn-skip:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1a1a2e;
}

:global(body.light-bg-mode) .btn-confirm {
  background: linear-gradient(135deg, #0099cc, #0066aa);
  color: #fff;
}
</style>
