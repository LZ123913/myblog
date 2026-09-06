import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { db } from './init.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const articlesDir = join(__dirname, '..', '..', 'content', 'articles')
if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true })

function writeArticle(slug, content) {
  fs.writeFileSync(join(articlesDir, `${slug}.md`), content, 'utf-8')
}

export function seedDatabase() {
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@shiguang.blog')
  if (adminExists) {
    console.log('[Seed] Database already seeded')
    return
  }

  const hashedPassword = bcrypt.hashSync('admin123', 10)

  const adminResult = db.prepare(`
    INSERT INTO users (email, nickname, password, role, status)
    VALUES (?, ?, ?, 'admin', 'active')
  `).run('admin@shiguang.blog', '拾光集主理人', hashedPassword)

  const adminId = adminResult.lastInsertRowid

  db.prepare(`
    INSERT INTO authors (user_id, name, avatar, motto, bio)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    adminId,
    '拾光集主理人',
    '',
    '记录每一束思想的光。',
    '全栈开发者，热爱技术写作与开源社区。专注于前端工程化、Node.js 后端架构和 AI 应用实践。'
  )

  const authorId = db.prepare('SELECT id FROM authors WHERE user_id = ?').get(adminId).id

  const categories = [
    { name: '前端技术', sort: 1 },
    { name: '后端架构', sort: 2 },
    { name: 'AI应用', sort: 3 },
    { name: '工程实践', sort: 4 },
    { name: '随笔杂谈', sort: 5 }
  ]
  for (const c of categories) {
    db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(c.name, c.sort)
  }

  const tags = ['Vue', 'Node.js', 'JavaScript', 'TypeScript', 'CSS', 'React', 'Python', 'Express', 'SQLite', 'Vite', 'AI', '通义千问', '性能优化', '工程化', '随笔']
  for (const t of tags) {
    db.prepare('INSERT OR IGNORE INTO tags (name, usage_count) VALUES (?, 0)').run(t)
  }

  db.prepare(`
    INSERT INTO projects (author_id, name, description, github_url, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(authorId, '拾光集博客', '基于 Vue 3 + Express 的个人博客系统', 'https://github.com/example/shiguang-blog', 1)

  db.prepare(`
    INSERT INTO projects (author_id, name, description, github_url, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(authorId, '组件库', '轻量级 Vue 3 UI 组件库', 'https://github.com/example/ui-lib', 2)

  db.prepare(`
    INSERT INTO announcements (title, content, is_active)
    VALUES (?, ?, 1)
  `).run(
    '欢迎来到拾光集',
    '这是一个记录技术思考与生活感悟的个人博客。你可以在这里浏览文章、订阅更新、参与讨论。'
  )

  db.prepare(`
    INSERT INTO email_templates (name, subject, html_body, text_body, status, created_by)
    VALUES (?, ?, ?, ?, 'enabled', ?)
  `).run(
    '默认发布通知模板',
    '【拾光集】新文章发布：{{articleTitle}}',
    `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1F4E79;">{{articleTitle}}</h2>
      <p>{{articleSummary}}</p>
      <a href="{{articleUrl}}" style="display: inline-block; padding: 10px 24px; background: #1F4E79; color: #fff; text-decoration: none; border-radius: 4px;">阅读全文</a>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">由 {{authorName}} 发布于拾光集博客</p>
      <p style="font-size: 12px;"><a href="{{unsubscribeUrl}}" style="color: #999;">退订</a></p>
    </div>`,
    '{{articleTitle}}\n\n{{articleSummary}}\n\n阅读全文: {{articleUrl}}\n\n由 {{authorName}} 发布于拾光集博客\n退订: {{unsubscribeUrl}}',
    adminId
  )

  const scenarios = [
    { scenario: 'summary', model: 'qwen-plus', timeout: 3000, prompt: '请为以下技术博客文章生成一段简洁的摘要，不超过200字。' },
    { scenario: 'polish', model: 'qwen-plus', timeout: 10000, prompt: '' },
    { scenario: 'tag', model: 'qwen-plus', timeout: 3000, prompt: '请从以下文章内容中推荐3-5个最合适的标签。从已有标签库中选择或创建新标签。' },
    { scenario: 'comment', model: 'qwen-turbo', timeout: 3000, prompt: '请判断以下评论是否为广告或灌水内容。只返回 true 或 false。' }
  ]
  for (const s of scenarios) {
    db.prepare(`
      INSERT INTO ai_configs (scenario, provider, model, api_url, timeout_ms, system_prompt, enabled, version)
      VALUES (?, 'qwen', ?, '', ?, ?, 1, 1)
    `).run(s.scenario, s.model, s.timeout, s.prompt)
  }

  const catFrontend = db.prepare('SELECT id FROM categories WHERE name = ?').get('前端技术').id
  const catBackend = db.prepare('SELECT id FROM categories WHERE name = ?').get('后端架构').id
  const catAI = db.prepare('SELECT id FROM categories WHERE name = ?').get('AI应用').id
  const catEng = db.prepare('SELECT id FROM categories WHERE name = ?').get('工程实践').id
  const catEssay = db.prepare('SELECT id FROM categories WHERE name = ?').get('随笔杂谈').id

  const articles = [
    {
      slug: 'welcome-to-shiguang',
      title: '欢迎来到拾光集',
      content: `# 欢迎来到拾光集

## 关于本站

拾光集是一个专注于技术分享的个人博客系统。

### 技术栈

- 前端：Vue 3 + Vite + Pinia
- 后端：Node.js + Express + SQLite
- AI：通义千问大模型

## 功能特性

本系统包含完整的博客功能链路，从内容创作到读者互动。

## 总结

拾光集博客系统是一个现代化的全栈项目，欢迎探索。`,
      summary: '拾光集是一个专注于技术分享的个人博客系统，基于 Vue 3 + Express + SQLite 构建。',
      categoryId: catFrontend,
      tags: ['Vue', 'Node.js'],
      likes: 5, bookmarks: 2, views: 10
    },
    {
      slug: 'vue3-composition-api-guide',
      title: 'Vue 3 Composition API 完全指南',
      content: `# Vue 3 Composition API 完全指南

## 为什么需要 Composition API

Vue 2 的 Options API 在大型组件中面临逻辑复用困难和代码组织混乱的问题。Composition API 通过函数式的方式解决了这些痛点。

## 核心概念

### ref 与 reactive

\`\`\`javascript
import { ref, reactive } from 'vue'

const count = ref(0)
const state = reactive({ name: '拾光集', version: '1.0' })

function increment() {
  count.value++
}
\`\`\`

### computed

\`\`\`javascript
import { ref, computed } from 'vue'

const count = ref(10)
const double = computed(() => count.value * 2)
\`\`\`

### watch 与 watchEffect

\`\`\`javascript
import { ref, watch, watchEffect } from 'vue'

const keyword = ref('')

watch(keyword, (newVal, oldVal) => {
  console.log('关键词变化:', newVal)
})

watchEffect(() => {
  console.log('当前值:', keyword.value)
})
\`\`\`

## 生命周期钩子

\`\`\`javascript
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  console.log('组件已挂载')
})

onUnmounted(() => {
  console.log('组件已卸载')
})
\`\`\`

## 最佳实践

1. 逻辑关注点分离：将相关逻辑组织到同一个 composable 函数中
2. 合理使用 ref 和 reactive：基本类型用 ref，对象用 reactive
3. 避免过度解构：reactive 解构后会失去响应性

## 总结

Composition API 是 Vue 3 最重要的特性之一，掌握它能让你写出更清晰、更可维护的代码。`,
      summary: 'Vue 3 Composition API 通过 ref、reactive、computed 和 watch 等函数式 API，解决了 Options API 在大型组件中的逻辑复用和组织问题。',
      categoryId: catFrontend,
      tags: ['Vue', 'JavaScript', '工程化'],
      likes: 28, bookmarks: 15, views: 120
    },
    {
      slug: 'express-sqlite-restful-api',
      title: '使用 Express + SQLite 构建 RESTful API',
      content: `# 使用 Express + SQLite 构建 RESTful API

## 为什么选择 SQLite

对于个人博客和小型项目，SQLite 是最理想的选择：零配置、无服务端、性能足够。

## 项目搭建

### 安装依赖

\`\`\`bash
npm install express better-sqlite3 cors
\`\`\`

### 数据库初始化

\`\`\`javascript
import Database from 'better-sqlite3'

const db = new Database('blog.db')

db.exec(\`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    status TEXT DEFAULT 'draft',
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
\`\`\`)

### 路由设计

\`\`\`javascript
import { Router } from 'express'

const router = Router()

router.get('/articles', (req, res) => {
  const items = db.prepare('SELECT * FROM articles WHERE status = ? ORDER BY published_at DESC').all('published')
  res.json({ items })
})

router.get('/articles/:slug', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE slug = ?').get(req.params.slug)
  if (!article) return res.status(404).json({ error: 'notFound' })
  res.json(article)
})

export default router
\`\`\`

## 中间件设计

### JWT 认证

\`\`\`javascript
import jwt from 'jsonwebtoken'

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'loginRequired' })
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'tokenExpired' })
  }
}
\`\`\`

### 错误处理

\`\`\`javascript
export class ApiError extends Error {
  constructor(code, message, statusCode = 400, retryable = false) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.retryable = retryable
  }
}

app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.code, message: err.message })
  } else {
    res.status(500).json({ error: 'internalError', message: '服务器内部错误' })
  }
})
\`\`\`

## 总结

Express + SQLite 组合非常适合中小型项目的快速开发，配合 JWT 认证和统一的错误处理，可以构建出结构清晰、易于维护的后端服务。`,
      summary: 'Express + SQLite 是个人博客后端的理想方案，本文介绍了数据库初始化、路由设计、JWT 认证和错误处理的完整流程。',
      categoryId: catBackend,
      tags: ['Node.js', 'Express', 'SQLite'],
      likes: 22, bookmarks: 12, views: 85
    },
    {
      slug: 'tongyi-qianwen-api-integration',
      title: '通义千问 API 集成实战：AI 摘要与内容润色',
      content: `# 通义千问 API 集成实战：AI 摘要与内容润色

## 背景

在博客系统中集成 AI 能力，可以大幅提升内容创作效率和阅读体验。本文介绍如何接入通义千问 API 实现 AI 摘要和内容润色。

## API 接入

### 配置信息

\`\`\`javascript
const config = {
  ai: {
    provider: 'qwen',
    apiKey: process.env.AI_API_KEY,
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  }
}
\`\`\`

### 调用封装

\`\`\`javascript
async function callAi(prompt, systemPrompt, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(\`\${apiUrl}/chat/completions\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      }),
      signal: controller.signal
    })

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timer)
  }
}
\`\`\`

## 应用场景

### AI 摘要生成

为每篇文章自动生成不超过 200 字的摘要，方便读者快速了解内容。

### 内容润色

使用 AI 对原始笔记进行结构化润色，统一标题层级、优化语句表达。

### 标签推荐

根据文章内容智能推荐 3-5 个标签，优先从已有标签库中选择。

## 降级策略

当 AI 服务不可用时，系统需要有合理的降级方案：

- 摘要：截取文章前 100 字作为摘要
- 标签：基于关键词频率推荐本地标签
- 审核：默认放行评论

## 总结

通义千问 API 的接入非常简单，通过合理的封装和降级策略，可以在保证可用性的同时大幅提升博客系统的智能化水平。`,
      summary: '本文介绍了通义千问 API 的接入方法，包括 AI 摘要生成、内容润色和标签推荐三个应用场景，以及服务不可用时的降级策略。',
      categoryId: catAI,
      tags: ['AI', '通义千问', 'Node.js'],
      likes: 35, bookmarks: 20, views: 200
    },
    {
      slug: 'frontend-performance-optimization',
      title: '前端性能优化的 10 个实践',
      content: `# 前端性能优化的 10 个实践

## 1. 路由懒加载

\`\`\`javascript
const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/about', component: () => import('./views/About.vue') }
]
\`\`\`

按需加载页面组件，减少首屏加载体积。

## 2. 图片懒加载

\`\`\`html
<img src="placeholder.jpg" data-src="real-image.jpg" loading="lazy" />
\`\`\`

## 3. 代码分割

\`\`\`javascript
const module = await import('./heavy-module')
\`\`\`

## 4. 防抖与节流

\`\`\`javascript
function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
\`\`\`

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

\`\`\`javascript
import compression from 'compression'
app.use(compression())
\`\`\`

## 10. CDN 加速

将静态资源部署到 CDN，减少网络延迟。

## 总结

性能优化是一个持续的过程，从首屏加载到运行时性能，每个细节都可能影响用户体验。`,
      summary: '本文总结了 10 个前端性能优化实践，包括路由懒加载、图片懒加载、代码分割、防抖节流、虚拟滚动等关键优化手段。',
      categoryId: catFrontend,
      tags: ['性能优化', 'Vue', '工程化'],
      likes: 42, bookmarks: 25, views: 180
    },
    {
      slug: 'vite-build-optimization',
      title: 'Vite 构建优化：从配置到部署',
      content: `# Vite 构建优化：从配置到部署

## Vite 为什么快

Vite 利用浏览器原生 ES Module 支持，开发时无需打包，按需编译。

## 开发优化

### 依赖预构建

\`\`\`javascript
export default defineConfig({
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia']
  }
})
\`\`\`

### 热更新优化

确保组件按功能模块拆分，避免大文件触发全量 HMR。

## 生产构建

### 代码分割

\`\`\`javascript
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
\`\`\`

### 资源压缩

\`\`\`javascript
export default defineConfig({
  build: {
    minify: 'esbuild',
    cssCodeSplit: true,
    assetsInlineLimit: 4096
  }
})
\`\`\`

### Gzip 压缩

\`\`\`bash
npm install vite-plugin-compression
\`\`\`

\`\`\`javascript
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [viteCompression()]
})
\`\`\`

## 部署优化

### 静态资源 CDN

\`\`\`javascript
export default defineConfig({
  base: 'https://cdn.example.com/assets/'
})
\`\`\`

### 缓存策略

- HTML: no-cache
- JS/CSS: max-age=31536000 (一年)
- 图片/字体: max-age=31536000

## 总结

Vite 的构建优化需要从开发配置、生产构建和部署三个层面综合考虑。`,
      summary: 'Vite 构建优化涉及开发配置、生产构建和部署三个层面，合理使用依赖预构建、代码分割和资源压缩可以显著提升应用性能。',
      categoryId: catFrontend,
      tags: ['Vite', '性能优化', '工程化'],
      likes: 18, bookmarks: 10, views: 75
    },
    {
      slug: 'typescript-advanced-types',
      title: 'TypeScript 高级类型实战',
      content: `# TypeScript 高级类型实战

## 条件类型

\`\`\`typescript
type IsString<T> = T extends string ? true : false

type A = IsString<'hello'> // true
type B = IsString<42>      // false
\`\`\`

## 映射类型

\`\`\`typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

type Partial<T> = {
  [P in keyof T]?: T[P]
}
\`\`\`

## 模板字面量类型

\`\`\`typescript
type EventName = \`on\${Capitalize<string>}\`

type T1 = EventName // "onClick" | "onScroll" | ...
\`\`\`

## infer 关键字

\`\`\`typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

type PromiseType<T> = T extends Promise<infer U> ? U : T
\`\`\`

## 实战：API 类型推导

\`\`\`typescript
interface Article {
  id: number
  title: string
  content: string
}

type ArticleKeys = keyof Article // 'id' | 'title' | 'content'
type ArticleValues = Article[keyof Article] // number | string

function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => { result[key] = obj[key] })
  return result
}
\`\`\`

## 总结

TypeScript 的高级类型系统非常强大，掌握条件类型、映射类型和 infer 可以构建出类型安全的工具函数。`,
      summary: 'TypeScript 高级类型包括条件类型、映射类型、模板字面量类型和 infer 关键字，可以构建出强大的类型安全工具函数。',
      categoryId: catFrontend,
      tags: ['TypeScript', 'JavaScript', '工程化'],
      likes: 15, bookmarks: 8, views: 60
    },
    {
      slug: 'writing-with-light-collection',
      title: '写作于拾光：关于记录的意义',
      content: `# 写作于拾光：关于记录的意义

## 为什么要写作

写作不只是为了输出，更是为了思考。

当你试图把模糊的想法变成清晰的文字时，你被迫去理清逻辑、验证假设、组织结构。这个过程本身就是认知的升级。

## 拾光集的名字

"拾光"二字，取自"拾取光阴"。

每一篇文章都是一束被拾起的光。它们或许是某个深夜的技术灵感，或许是某个午后的生活感悟。重要的是，它们被记录下来了。

## 记录的价值

### 对自己

- 整理思路：写出来才知道自己真正在想什么
- 沉淀知识：今天学到的东西，明天可能就忘了
- 回溯成长：一年后回看，你会惊讶于自己的变化

### 对他人

- 帮助后来者少走弯路
- 提供不同视角的思考
- 建立连接与共鸣

## 写作的心法

1. **先完成再完美**：第一稿不需要好，只需要存在
2. **为读者写**：始终问自己"这能帮到别人吗？"
3. **保持真实**：不虚构经历，不夸大效果
4. **持续输出**：频率比质量更重要，量变引起质变

## 总结

拾光集不只是一个技术博客，它是一个记录思考、分享光亮的空间。希望这里的每篇文章，都能为你点亮一束光。`,
      summary: '写作是思考的工具，记录是成长的见证。拾光集——拾取光阴中的每一束思想之光，为自己沉淀，为他人照亮。',
      categoryId: catEssay,
      tags: ['随笔'],
      likes: 12, bookmarks: 6, views: 45
    }
  ]

  for (const a of articles) {
    db.prepare(`
      INSERT INTO articles (slug, title, content, summary, author_id, category_id, status, likes, bookmarks, views, tags, published_at)
      VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, datetime('now', ?))
    `).run(
      a.slug, a.title, a.content, a.summary, authorId, a.categoryId,
      a.likes, a.bookmarks, a.views, JSON.stringify(a.tags),
      `-${articles.indexOf(a)} hours`
    )

    writeArticle(a.slug, a.content)

    for (const tag of a.tags) {
      db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?').run(tag)
    }
  }

  console.log('[Seed] Seed data inserted successfully')
  console.log(`[Seed] ${articles.length} articles created`)
  console.log('[Seed] Admin account: admin@shiguang.blog / admin123')
}
