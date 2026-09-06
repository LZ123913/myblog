# Vue 3 Composition API 完全指南

## 为什么需要 Composition API

Vue 2 的 Options API 在大型组件中面临逻辑复用困难和代码组织混乱的问题。Composition API 通过函数式的方式解决了这些痛点。

## 核心概念

### ref 与 reactive

```javascript
import { ref, reactive } from 'vue'

const count = ref(0)
const state = reactive({ name: '拾光集', version: '1.0' })

function increment() {
  count.value++
}
```

### computed

```javascript
import { ref, computed } from 'vue'

const count = ref(10)
const double = computed(() => count.value * 2)
```

### watch 与 watchEffect

```javascript
import { ref, watch, watchEffect } from 'vue'

const keyword = ref('')

watch(keyword, (newVal, oldVal) => {
  console.log('关键词变化:', newVal)
})

watchEffect(() => {
  console.log('当前值:', keyword.value)
})
```

## 生命周期钩子

```javascript
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  console.log('组件已挂载')
})

onUnmounted(() => {
  console.log('组件已卸载')
})
```

## 最佳实践

1. 逻辑关注点分离：将相关逻辑组织到同一个 composable 函数中
2. 合理使用 ref 和 reactive：基本类型用 ref，对象用 reactive
3. 避免过度解构：reactive 解构后会失去响应性

## 总结

Composition API 是 Vue 3 最重要的特性之一，掌握它能让你写出更清晰、更可维护的代码。