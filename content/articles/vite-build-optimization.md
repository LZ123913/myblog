# Vite 构建优化：从配置到部署

## Vite 为什么快

Vite 利用浏览器原生 ES Module 支持，开发时无需打包，按需编译。

## 开发优化

### 依赖预构建

```javascript
export default defineConfig({
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia']
  }
})
```

### 热更新优化

确保组件按功能模块拆分，避免大文件触发全量 HMR。

## 生产构建

### 代码分割

```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          ui: ['some-ui-lib']
        }
      }
    }
  }
})
```

### 资源压缩

```javascript
export default defineConfig({
  build: {
    minify: 'esbuild',
    cssCodeSplit: true,
    assetsInlineLimit: 4096
  }
})
```

### Gzip 压缩

```bash
npm install vite-plugin-compression
```

```javascript
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [viteCompression()]
})
```

## 部署优化

### 静态资源 CDN

```javascript
export default defineConfig({
  base: 'https://cdn.example.com/assets/'
})
```

### 缓存策略

- HTML: no-cache
- JS/CSS: max-age=31536000 (一年)
- 图片/字体: max-age=31536000

## 总结

Vite 的构建优化需要从开发配置、生产构建和部署三个层面综合考虑。