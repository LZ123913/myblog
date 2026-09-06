import { Router } from 'express'
import { db } from '../../../database/scripts/init.js'

const router = Router()

router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM projects ORDER BY sort_order').all()
  res.json({ items })
})

export default router
