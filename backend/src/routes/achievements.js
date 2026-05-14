import express from 'express'
import { getAllQuery } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/achievements — all defined achievements (public)
router.get('/', (req, res) => {
  const achievements = getAllQuery('SELECT * FROM achievements ORDER BY id')
  res.json({ success: true, data: achievements })
})

// GET /api/achievements/mine — achievements earned by the authenticated user
router.get('/mine', requireAuth, (req, res) => {
  const earned = getAllQuery(
    `SELECT a.*, ua.earned_at
     FROM achievements a
     JOIN user_achievements ua ON ua.achievement_id = a.id
     WHERE ua.user_id = ?
     ORDER BY ua.earned_at DESC`,
    [req.user.userId]
  )
  res.json({ success: true, data: earned })
})

export default router
