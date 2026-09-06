<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="not-found-page">
    <div class="container">
      <div class="not-found-content">
        <h1 class="error-code">404</h1>
        <p class="error-text">抱歉，您访问的页面不存在</p>
        <p class="error-hint">页面可能已被移除或链接已失效</p>
        <button class="btn btn-primary go-home-btn" @click="goHome">返回首页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  padding-top: calc(var(--nav-height) + 20px);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--nav-height) - 20px);
}
.not-found-content { text-align: center; }
.error-code {
  font-size: 120px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: 20px;
  opacity: 0.8;
}
.error-text { font-size: 20px; color: var(--color-text); margin-bottom: 8px; }
.error-hint { font-size: 14px; color: var(--color-text-light); margin-bottom: 32px; }
.go-home-btn { padding: 10px 32px; font-size: 15px; }
</style>
