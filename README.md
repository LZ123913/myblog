# 拾光集个人博客系统

基于 Vue 3 + Express + SQLite 的全栈个人博客系统，集成 AI 内容创作能力。

## 技术栈

- **前端**: Vue 3 + Vite + Pinia + Vue Router
- **后端**: Node.js + Express + SQLite (`node:sqlite`)
- **认证**: JWT + bcryptjs
- **AI**: 通义千问 (DashScope API)
- **邮件**: Nodemailer (SMTP)
- **文件处理**: pandoc (Word 转 Markdown), multer (图片上传)
- **分享卡片**: html2canvas-pro

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入实际值：

```bash
copy .env.example .env
```

关键配置项：
- `JWT_SECRET`: JWT 密钥（生产环境务必更改）
- `SMTP_HOST/PORT/USER/PASS`: SMTP 邮件服务配置
- `AI_API_KEY`: 通义千问 DashScope API Key
- `AI_MODEL`: AI 模型名称（默认 qwen-plus）

### 3. 初始化数据库

```bash
npm run init-db
npm run seed
```

种子数据包含：
- 管理员账号: `admin@shiguang.blog` / `admin123`
- 5 个分类、10 个标签、2 个项目、1 篇示例文章、1 条公告
- 默认邮件模板、4 个 AI 配置场景

### 4. 启动开发服务器

```bash
npm run dev
```

前端: http://localhost:5173
后端: http://localhost:3000

### 5. 运行测试

```bash
npm test
```

### 6. 构建

```bash
npm run build
```

## 项目结构

```
MyBlog/
├── frontend/               # 前端 (Vue 3 + Vite)
│   ├── index.html         # HTML 入口
│   ├── vite.config.js     # Vite 配置
│   ├── public/            # 静态资源
│   └── src/               # 前端源码
│       ├── main.js        # 应用入口
│       ├── App.vue        # 根组件
│       ├── router/        # 路由配置
│       ├── stores/        # Pinia 状态管理
│       ├── views/         # 页面（含 admin 管理后台）
│       ├── components/    # 组件
│       ├── utils/         # 工具函数
│       └── assets/        # 样式资源
├── backend/                # 后端 (Node.js + Express)
│   └── src/
│       ├── server.js      # 服务器入口
│       ├── config/        # 配置
│       ├── middleware/    # 中间件
│       ├── routes/        # API 路由
│       └── services/      # AI、邮件、文件与搜索服务
├── database/               # 数据库 (SQLite)
│   ├── data/              # 本地数据库文件（忽略提交）
│   └── scripts/           # 初始化与种子脚本
├── content/               # 内容文件
│   ├── articles/          # 已发布 Markdown
│   ├── drafts/            # 草稿
│   ├── recycle/           # 回收站
│   └── images/            # 上传图片
├── tests/
│   └── backend/           # 后端接口测试
├── package.json           # 统一命令入口
└── .env                   # 环境变量
```

## 功能清单

### 访客功能
1. 公告展示 (24 小时 localStorage 隐藏)
2. 文章搜索 (至少 2 字符, 热度/最新排序, 推荐前三)
3. 归档浏览 (标签云/分类树/时间轴)
4. 个人主页 (项目卡片 hover 效果, GitHub 新标签页)
5. 邮箱订阅 (验证流程, 退订)
6. 用户注册 (邮箱校验, 密码 6-20 位, bcrypt, JWT 自动登录)
7. 用户登录 (bcrypt.compare, 7 天 JWT, Pinia 登录态)

### 阅读功能
8. 分类浏览 (时间倒序)
9. 多模式阅读 (日间/夜间/护眼, 字号调节, shiguang-reading-prefs)
10. AI 摘要 (3 秒超时降级前 100 字, 缓存)
11. 智能目录 (h2/h3, IntersectionObserver, 平滑跳转, 375px 抽屉)
12. 导航隐藏 (滚动方向检测, 10px/80px 阈值, translateY)
13. 内容点赞 (登录 toggle, 未登录 localStorage)
14. 内容收藏 (公开/私密, privacy 字段)
15. 评论互动 (5 字符限制, 真人验证, AI 广告检测)
16. 分享卡片 (html2canvas scale=2, PNG 下载, 拾光集-{标题前10字}.png)

### 创作功能
17. 笔记导入 (Markdown/TXT/Word/pandoc, 图片拖拽)
18. AI 润色 (10 秒超时, 对比视图, 10 条规则 System Prompt)
19. 标签推荐 (AI + 本地关键词频次降级, 手动添加)
20. 文章编辑 (回填, Markdown 覆盖, 标签计数, 摘要缓存清除)
21. 文章删除 (软删除, 回收站, 标签计数减, 搜索索引移除)
22. 收藏管理 (取消收藏, 不删除文章)

### 系统功能
23. 文章详情 (Markdown 渲染, 安全, 作者/时间/标签/分类)
24. 文章发布 (Draft→Article, Markdown 生成, 索引, 标签计数, 订阅通知)
25. 草稿管理 (状态流转 imported→polished→tagged→published)
26. 回收站恢复 (30 天限制, 文件移回, 索引/标签恢复)
27. 权限拦截 (JWT 过期, 401/403, reader/admin 分级, 前后端双校验)

### 扩展功能
28. 忘记密码/修改密码 (resetToken, 1 天有效, 旧会话失效)
29. 邮箱验证码登录 (OTP, 1 分钟冷却, 每日 5 次, 10 分钟有效)
30. 管理员用户管理 (角色/状态/删除, 最后管理员保护, 操作日志)
31. 回收站彻底删除 (物理删除, 索引/关联数据清理, 30 天自动清理)
32. 评论管理 (删除/回复/分页, 软删除, parentId 树状)
33. 文章分页 (page/pageSize, 无限滚动, IntersectionObserver, 去重)
34. 社交分享 (微信/微博/QQ, Web Share API, 复制链接降级)
35. 邮件模板管理 (HTML/纯文本, 变量替换, 预览, 启停)
36. 草稿列表管理 (筛选/排序/搜索/复制/批量操作)
37. AI 配置后台 (4 场景, 模型/超时/Prompt, 版本管理, 测试调用)

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 密码登录 |
| GET | /api/auth/me | 获取当前用户 |
| POST | /api/password/forgot | 忘记密码 |
| POST | /api/password/reset | 重置密码 |
| POST | /api/password/change | 修改密码 |
| POST | /api/otp/send | 发送验证码 |
| POST | /api/otp/verify | 验证码登录 |
| GET | /api/articles | 文章列表 |
| GET | /api/articles/:slug | 文章详情 |
| POST | /api/articles | 创建文章 (admin) |
| PUT | /api/articles/:id | 编辑文章 (admin) |
| DELETE | /api/articles/:id | 删除文章 (admin) |
| POST | /api/articles/:id/like | 点赞 |
| POST | /api/articles/:id/bookmark | 收藏 |
| GET | /api/articles/admin/list | 管理列表 (admin) |
| GET | /api/articles/archive/timeline | 时间轴 |
| GET | /api/drafts | 草稿列表 (admin) |
| POST | /api/drafts | 创建草稿 (admin) |
| PUT | /api/drafts/:id | 更新草稿 (admin) |
| POST | /api/drafts/:id/polish | AI 润色 (admin) |
| POST | /api/drafts/:id/recommend-tags | 标签推荐 (admin) |
| POST | /api/drafts/:id/publish | 发布 (admin) |
| DELETE | /api/drafts/:id | 删除草稿 (admin) |
| POST | /api/drafts/:id/copy | 复制草稿 (admin) |
| GET | /api/comments/captcha | 获取验证码 |
| GET | /api/comments/article/:id | 评论列表 |
| POST | /api/comments | 提交评论 |
| DELETE | /api/comments/:id | 删除评论 |
| GET | /api/tags | 标签列表 |
| GET | /api/tags/cloud | 标签云 |
| GET | /api/categories | 分类列表 |
| GET | /api/authors | 作者信息 |
| GET | /api/projects | 项目列表 |
| POST | /api/subscriptions | 订阅 |
| GET | /api/subscriptions/verify | 验证邮箱 |
| POST | /api/subscriptions/unsubscribe | 退订 |
| GET | /api/announcements/latest | 最新公告 |
| GET | /api/search | 搜索 |
| GET | /api/users | 用户管理 (admin) |
| GET | /api/recycle | 回收站 (admin) |
| GET | /api/email-templates | 邮件模板 (admin) |
| GET | /api/ai-configs | AI 配置 (admin) |
| POST | /api/uploads/image | 图片上传 (admin) |
| POST | /api/uploads/note | 笔记导入 (admin) |

## 数据模型

- **User**: id, email, nickname, password(bcrypt), role(admin/reader), status, likedPosts, bookmarks
- **Article**: id, slug, title, content, summary, authorId, categoryId, status, likes, bookmarks, tags
- **Draft**: id, title, rawContent, polishedContent, tags, status(imported/polished/tagged/published)
- **Comment**: id, articleId, userId, content, parentId, isValid, isDeleted
- **Tag**: id, name, usageCount
- **Category**: id, name, parentId
- **Author**: id, name, avatar, motto, bio
- **Project**: id, name, description, githubUrl
- **Subscription**: id, email, isVerified, verifyToken

## AI 降级策略

- **摘要**: 超过 3 秒 → 截取前 100 字
- **润色**: 超过 10 秒 → 提示服务繁忙, 允许重试
- **标签**: AI 失败 → 本地关键词频次匹配, 取前 5
- **评论**: AI 失败 → 默认通过

## 已知限制

- SMTP 未配置时邮件内容输出到控制台日志
- AI API Key 未配置时使用降级逻辑
- pandoc 需要单独安装用于 Word 转换
- 定时清理回收站需手动触发或配置外部定时任务
