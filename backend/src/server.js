import express from 'express'
import 'express-async-errors'
import cors from 'cors'
import { config } from './config/index.js'
import { initDatabase } from '../../database/scripts/init.js'
import { errorHandler } from './middleware/errorHandler.js'
import { seedDatabase } from '../../database/scripts/seed.js'

import authRoutes from './routes/auth.js'
import articleRoutes from './routes/articles.js'
import draftRoutes from './routes/drafts.js'
import commentRoutes from './routes/comments.js'
import tagRoutes from './routes/tags.js'
import categoryRoutes from './routes/categories.js'
import authorRoutes from './routes/authors.js'
import projectRoutes from './routes/projects.js'
import subscriptionRoutes from './routes/subscriptions.js'
import announcementRoutes from './routes/announcements.js'
import userRoutes from './routes/users.js'
import recycleRoutes from './routes/recycle.js'
import emailTemplateRoutes from './routes/emailTemplates.js'
import aiConfigRoutes from './routes/aiConfigs.js'
import siteSettingRoutes from './routes/siteSettings.js'
import uploadRoutes from './routes/uploads.js'
import searchRoutes from './routes/search.js'
import otpRoutes from './routes/otp.js'
import passwordRoutes from './routes/password.js'

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dirname, '..', '..', 'content')
for (const dir of ['articles', 'drafts', 'recycle', 'images']) {
  const p = join(contentDir, dir)
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

initDatabase()
seedDatabase()

const app = express()

app.use(cors({ origin: config.clientUrl, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/content', express.static(contentDir))

app.use('/api/auth', authRoutes)
app.use('/api/articles', articleRoutes)
app.use('/api/drafts', draftRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/authors', authorRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/users', userRoutes)
app.use('/api/recycle', recycleRoutes)
app.use('/api/email-templates', emailTemplateRoutes)
app.use('/api/ai-configs', aiConfigRoutes)
app.use('/api/site-settings', siteSettingRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/password', passwordRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

const PORT = config.port
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[Server] Content directory: ${contentDir}`)
})

export default app
