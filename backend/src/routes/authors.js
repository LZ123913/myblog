import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'

const router = Router()

router.get('/', (req, res) => {
  const author = db.prepare('SELECT * FROM authors ORDER BY id LIMIT 1').get()
  if (!author) return res.json(null)
  res.json(author)
})

router.get('/:id', (req, res) => {
  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(req.params.id)
  if (!author) return res.status(404).json({ error: 'notFound' })
  res.json(author)
})

export default router
