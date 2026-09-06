import { Router } from 'express'
import multer from 'multer'
import { fileURLToPath, URL } from 'node:url'
import { dirname, join, extname } from 'node:path'
import os from 'node:os'
import { authMiddleware, requireAdmin } from '../middleware/auth.js'
import { ApiError } from '../middleware/errorHandler.js'
import { saveImage, convertWordToMarkdown, extractMetadataFromMarkdown } from '../services/fileService.js'
import fs from 'node:fs'

const router = Router()

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.md', '.txt', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const ext = extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new ApiError('fileTypeNotAllowed', `不支持的文件类型: ${ext}`))
  }
})

router.post('/image', authMiddleware, requireAdmin, upload.array('images', 20), (req, res) => {
  const urls = []
  for (const file of req.files) {
    const ext = extname(file.originalname)
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const url = saveImage(file.buffer, filename)
    urls.push({ url, originalName: file.originalname })
  }
  res.json({ urls })
})

router.post('/note', authMiddleware, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) throw new ApiError('fileRequired', '请上传文件')

  const ext = extname(req.file.originalname).toLowerCase()
  let content = ''
  let metadata = { title: '未命名', date: new Date().toISOString(), tags: [] }

  if (ext === '.md') {
    content = req.file.buffer.toString('utf-8')
    metadata = extractMetadataFromMarkdown(content)
  } else if (ext === '.txt') {
    content = req.file.buffer.toString('utf-8')
    const titleMatch = content.match(/^#\s+(.+)$/m)
    metadata = { title: titleMatch ? titleMatch[1] : req.file.originalname.replace(/\.txt$/, ''), date: new Date().toISOString(), tags: [] }
    content = `# ${metadata.title}\n\n${content}`
  } else if (ext === '.doc' || ext === '.docx') {
    const tempPath = join(os.tmpdir(), `shiguang-${Date.now()}${ext}`)
    fs.writeFileSync(tempPath, req.file.buffer)
    content = convertWordToMarkdown(tempPath)
    metadata = extractMetadataFromMarkdown(content)
    fs.unlinkSync(tempPath)
  } else {
    throw new ApiError('fileTypeNotAllowed', '不支持的文件类型')
  }

  res.json({ content, metadata })
})

router.post('/note/text', authMiddleware, requireAdmin, (req, res) => {
  const { text } = req.body
  if (!text) throw new ApiError('contentRequired', '内容不能为空')
  const titleMatch = text.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1] : '导入的笔记'
  const content = `# ${title}\n\n${text}`
  res.json({ content, metadata: { title, date: new Date().toISOString(), tags: [] } })
})

export default router
