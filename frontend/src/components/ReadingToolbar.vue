<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['change-theme', 'change-font-size'])

const themes = [
  { key: 'day', label: '日间', icon: '☀' },
  { key: 'dark', label: '夜间', icon: '☾' },
  { key: 'eye', label: '护眼', icon: '🍃' }
]
const currentTheme = ref('day')
const fontSize = ref(18)

onMounted(() => {
  const prefs = JSON.parse(localStorage.getItem('shiguang-reading-prefs') || '{}')
  if (prefs.theme) currentTheme.value = prefs.theme
  if (prefs.fontSize) fontSize.value = parseInt(prefs.fontSize)
})

function setTheme(theme) {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  savePrefs()
  emit('change-theme', theme)
}

function changeFontSize(delta) {
  const newSize = Math.min(24, Math.max(14, fontSize.value + delta))
  fontSize.value = newSize
  document.documentElement.style.fontSize = newSize + 'px'
  savePrefs()
  emit('change-font-size', newSize)
}

function savePrefs() {
  localStorage.setItem('shiguang-reading-prefs', JSON.stringify({
    theme: currentTheme.value,
    fontSize: fontSize.value
  }))
}
</script>

<template>
  <div class="reading-toolbar">
    <div class="theme-buttons">
      <button
        v-for="t in themes"
        :key="t.key"
        :class="['theme-btn', { active: currentTheme === t.key }]"
        @click="setTheme(t.key)"
        :title="t.label"
      >
        {{ t.icon }}
      </button>
    </div>
    <div class="font-buttons">
      <button class="font-btn" @click="changeFontSize(-2)">A-</button>
      <span class="font-size">{{ fontSize }}px</span>
      <button class="font-btn" @click="changeFontSize(2)">A+</button>
    </div>
  </div>
</template>

<style scoped>
.reading-toolbar {
  position: fixed;
  right: 20px;
  bottom: 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 50;
}
.theme-buttons, .font-buttons { display: flex; align-items: center; gap: 6px; }
.theme-btn, .font-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  font-size: 16px;
  background: var(--color-bg);
  color: var(--color-text);
  transition: all var(--transition);
}
.theme-btn.active, .font-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}
.font-size { font-size: 12px; color: var(--color-text-light); }
@media (max-width: 375px) {
  .reading-toolbar { display: none; }
}
</style>
