<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/api'
import { useBackgroundStore } from '../stores/background'

const router = useRouter()
const bgStore = useBackgroundStore()

const categories = ref([])
const loading = ref(true)
const error = ref('')
const expanded = ref(new Set())

onMounted(() => {
  bgStore.setBackground('/bg-cat.jpg', true)
  loadCategories()
})

onUnmounted(() => {
  bgStore.clearHeroBg()
})

async function loadCategories() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.get('/categories')
    categories.value = Array.isArray(data) ? data : (data.items || [])
    const rootCats = categories.value.filter(c => !c.parent_id)
    rootCats.forEach(c => expanded.value.add(c.id))
  } catch (err) {
    error.value = err.message || '加载分类失败'
  } finally {
    loading.value = false
  }
}

function getChildren(parentId) {
  return categories.value.filter(c => c.parent_id === parentId)
}

function hasChildren(categoryId) {
  return categories.value.some(c => c.parent_id === categoryId)
}

function toggleExpand(categoryId) {
  if (expanded.value.has(categoryId)) {
    expanded.value.delete(categoryId)
  } else {
    expanded.value.add(categoryId)
  }
}

function goToTopic(categoryId) {
  router.push(`/topic/${categoryId}`)
}
</script>

<template>
  <div class="category-tree-page">
    <div class="container">
      <h1 class="page-title">分类归档</h1>

      <div v-if="loading" class="loading-state" style="padding: 80px; text-align: center;">
        <span class="loading-spinner"></span> 加载中...
      </div>

      <div v-else-if="error" class="error-state">
        <h3>{{ error }}</h3>
        <button class="btn btn-outline" @click="loadCategories">重试</button>
      </div>

      <div v-else-if="categories.length === 0" class="empty-state">
        <p>暂无分类</p>
      </div>

      <div v-else class="category-tree">
        <template v-for="category in categories.filter(c => !c.parent_id)" :key="category.id">
          <div class="category-node">
            <div class="category-row">
              <button
                v-if="hasChildren(category.id)"
                class="expand-btn"
                @click="toggleExpand(category.id)"
              >
                {{ expanded.has(category.id) ? '▾' : '▸' }}
              </button>
              <span v-else class="expand-placeholder"></span>
              <span class="category-name" @click="goToTopic(category.id)">
                {{ category.name }}
              </span>
              <span v-if="category.article_count" class="category-count">{{ category.article_count }} 篇</span>
            </div>

            <div v-if="expanded.has(category.id) && hasChildren(category.id)" class="category-children">
              <template v-for="child in getChildren(category.id)" :key="child.id">
                <div class="category-node child-node">
                  <div class="category-row">
                    <button
                      v-if="hasChildren(child.id)"
                      class="expand-btn"
                      @click="toggleExpand(child.id)"
                    >
                      {{ expanded.has(child.id) ? '▾' : '▸' }}
                    </button>
                    <span v-else class="expand-placeholder"></span>
                    <span class="category-name" @click="goToTopic(child.id)">
                      {{ child.name }}
                    </span>
                    <span v-if="child.article_count" class="category-count">{{ child.article_count }} 篇</span>
                  </div>

                  <div v-if="expanded.has(child.id) && hasChildren(child.id)" class="category-children">
                    <div
                      v-for="grandchild in getChildren(child.id)"
                      :key="grandchild.id"
                      class="category-node child-node"
                    >
                      <div class="category-row">
                        <span class="expand-placeholder"></span>
                        <span class="category-name" @click="goToTopic(grandchild.id)">
                          {{ grandchild.name }}
                        </span>
                        <span v-if="grandchild.article_count" class="category-count">{{ grandchild.article_count }} 篇</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-tree-page { padding-top: calc(var(--nav-height) + 20px); }
.page-title { font-size: 24px; font-weight: 600; color: var(--color-text); margin-bottom: 30px; }
.category-tree {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 20px;
}
.category-node { margin-bottom: 4px; }
.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  transition: background var(--transition);
}
.category-row:hover { background: var(--color-bg-alt); }
.expand-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--color-text-light);
  flex-shrink: 0;
}
.expand-placeholder { width: 20px; flex-shrink: 0; }
.category-name {
  flex: 1;
  font-size: 15px;
  color: var(--color-text);
  cursor: pointer;
  transition: color var(--transition);
}
.category-name:hover { color: var(--color-primary); }
.category-count { font-size: 13px; color: var(--color-text-light); }
.category-children { margin-left: 24px; border-left: 2px solid var(--color-border); padding-left: 8px; }
.child-node { margin-bottom: 2px; }
</style>
