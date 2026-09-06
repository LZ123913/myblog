<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  hasMore: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

const emit = defineEmits(['load-more'])
const sentinel = ref(null)
const observer = ref(null)

onMounted(() => {
  if ('IntersectionObserver' in window) {
    observer.value = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && props.hasMore && !props.loading) {
        emit('load-more')
      }
    }, { rootMargin: '200px' })
    if (sentinel.value) observer.value.observe(sentinel.value)
  } else {
    window.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  if (observer.value) observer.value.disconnect()
  window.removeEventListener('scroll', handleScroll)
})

function handleScroll() {
  if (!props.hasMore || props.loading) return
  const el = sentinel.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.top < window.innerHeight + 200) {
    emit('load-more')
  }
}
</script>

<template>
  <div ref="sentinel" class="infinite-scroll-sentinel">
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span> 加载中...
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button class="btn btn-outline" @click="$emit('load-more')">重试</button>
    </div>
    <div v-else-if="!hasMore" class="end-state">
      没有更多了
    </div>
  </div>
</template>

<style scoped>
.infinite-scroll-sentinel { padding: 20px; text-align: center; }
.loading-state, .end-state { color: var(--color-text-light); font-size: 14px; }
.error-state { color: var(--color-danger); }
.error-state button { margin-top: 8px; }
</style>
