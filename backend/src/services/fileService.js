import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dirname, '..', '..', '..', 'content')
const articlesDir = join(contentDir, 'articles')
const draftsDir = join(contentDir, 'drafts')
const recycleDir = join(contentDir, 'recycle')
const imagesDir = join(contentDir, 'images')

for (const dir of [articlesDir, draftsDir, recycleDir, imagesDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function getArticlePath(slug) {
  return join(articlesDir, `${slug}.md`)
}

export function getDraftPath(id) {
  return join(draftsDir, `${id}.md`)
}

export function getRecyclePath(slug) {
  return join(recycleDir, `${slug}.md`)
}

export function writeArticleFile(slug, content) {
  const path = getArticlePath(slug)
  fs.writeFileSync(path, content, 'utf-8')
  return path
}

export function readArticleFile(slug) {
  const path = getArticlePath(slug)
  if (!fs.existsSync(path)) return null
  return fs.readFileSync(path, 'utf-8')
}

export function moveToRecycle(slug) {
  const src = getArticlePath(slug)
  const dest = getRecyclePath(slug)
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest)
  }
  return dest
}

export function restoreFromRecycle(slug) {
  const src = getRecyclePath(slug)
  const dest = getArticlePath(slug)
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest)
  }
  return dest
}

export function deleteFromRecycle(slug) {
  const path = getRecyclePath(slug)
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

export function deleteArticleFile(slug) {
  const path = getArticlePath(slug)
  if (fs.existsSync(path)) {
    fs.unlinkSync(path)
  }
}

export function saveImage(buffer, filename) {
  const path = join(imagesDir, filename)
  fs.writeFileSync(path, buffer)
  return `/content/images/${filename}`
}

export function parseMarkdownMetadata(content) {
  const meta = {}
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const lines = fmMatch[1].split('\n')
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        meta[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  return meta
}

export function extractMetadataFromMarkdown(content) {
  const meta = parseMarkdownMetadata(content)
  const titleMatch = content.match(/^#\s+(.+)$/m)
  return {
    title: meta.title || (titleMatch ? titleMatch[1] : '未命名'),
    date: meta.date || new Date().toISOString(),
    tags: meta.tags ? meta.tags.split(',').map(t => t.trim()) : []
  }
}

export function convertWordToMarkdown(filePath) {
  try {
    const outputPath = filePath.replace(/\.\w+$/, '.md')
    execSync(`pandoc "${filePath}" -t markdown -o "${outputPath}"`, { timeout: 30000 })
    const content = fs.readFileSync(outputPath, 'utf-8')
    fs.unlinkSync(outputPath)
    return content
  } catch (err) {
    throw new Error(`Word 转换失败: ${err.message}`)
  }
}

export function generateSlug(title) {
  const slugBase = title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  const timestamp = Date.now().toString(36)
  return `${slugBase || 'article'}-${timestamp}`.slice(0, 80)
}

export {
  contentDir,
  articlesDir,
  draftsDir,
  recycleDir,
  imagesDir
}
