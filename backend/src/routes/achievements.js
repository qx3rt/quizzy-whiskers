import express from 'express'
import { getAllQuery } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// GET /api/achievements — all defined achievements (public)
router.get('/', async (req, res) => {
  try {
    const achievements = await getAllQuery('SELECT * FROM achievements ORDER BY id')
    res.json({ success: true, data: achievements })
  } catch (err) {
    console.error('Achievements error:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch achievements' })
  }
})

// GET /api/achievements/mine — achievements earned by the authenticated user
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const earned = await getAllQuery(
      `SELECT a.*, ua.earned_at
       FROM achievements a
       JOIN user_achievements ua ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       ORDER BY ua.earned_at DESC`,
      [req.user.userId]
    )
    res.json({ success: true, data: earned })
  } catch (err) {
    console.error('My achievements error:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch achievements' })
  }
})

export default router
