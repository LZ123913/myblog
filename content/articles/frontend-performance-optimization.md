# 前端性能优化的 10 个实践

## 1. 路由懒加载

```javascript
const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/about', component: () => import('./views/About.vue') }
]
```

按需加载页面组件，减少首屏加载体积。

## 2. 图片懒加载

```html
<img src="placeholder.jpg" data-src="real-image.jpg" loading="lazy" />
```

## 3. 代码分割

```javascript
const module = await import('./heavy-module')
```

## 4. 防抖与节流

```javascript
function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
```

## 5. 虚拟滚动

对于长列表，只渲染可视区域内的元素。

## 6. 缓存策略

合理使用 HTTP 缓存头和 Service Worker。

## 7. CSS 优化

- 避免过深的选择器嵌套
- 使用 will-change 而非 transform 3D hack
- 提取关键 CSS 内联到 HTML

## 8. Tree Shaking

确保使用 ES Module 语法，让打包工具可以消除未使用代码。

## 9. Gzip 压缩

```javascript
import compression from 'compression'
app.use(compression())
```

## 10. CDN 加速

将静态资源部署到 CDN，减少网络延迟。

## 总结

性能优化是一个持续的过程，从首屏加载到运行时性能，每个细节都可能影响用户体验。