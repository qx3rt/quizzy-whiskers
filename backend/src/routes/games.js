import express from 'express'
import { getAllQuery, getDatabase, saveDatabase } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'
import { checkAndAwardAchievements } from '../models/achievements.js'

const router = express.Router()

// POST /api/games — save a completed game
router.post('/', requireAuth, (req, res) => {
  const {
    finalScore,
    topics = [],
    round1Correct = 0,
    round1Incorrect = 0,
    round1TimedOut = 0,
    round2Correct = 0,
    round2Incorrect = 0,
    round2TimedOut = 0,
    finalJeopardyCorrect = null,
  } = req.body

  if (typeof finalScore !== 'number') {
    return res.status(400).json({ success: false, error: 'finalScore is required' })
  }

  const roundCounts = [round1Correct, round1Incorrect, round1TimedOut, round2Correct, round2Incorrect, round2TimedOut]
  if (roundCounts.some((n) => !Number.isInteger(n) || n < 0 || n > 30)) {
    return res.status(400).json({ success: false, error: 'Invalid round stats' })
  }
  if (finalJeopardyCorrect !== null && finalJeopardyCorrect !== true && finalJeopardyCorrect !== false) {
    return res.status(400).json({ success: false, error: 'Invalid finalJeopardyCorrect value' })
  }

  try {
    const db = getDatabase()
    db.run(
      `INSERT INTO games
       (user_id, final_score, round1_correct, round1_incorrect, round1_timed_out,
        round2_correct, round2_incorrect, round2_timed_out, final_jeopardy_correct, topics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        finalScore,
        round1Correct,
        round1Incorrect,
        round1TimedOut,
        round2Correct,
        round2Incorrect,
        round2TimedOut,
        finalJeopardyCorrect !== null ? (finalJeopardyCorrect ? 1 : 0) : null,
        Array.isArray(topics) ? topics.join(',') : '',
      ]
    )

    const [{ count: totalGames }] = getAllQuery(
      'SELECT COUNT(*) as count FROM games WHERE user_id = ?',
      [req.user.userId]
    )

    const gameData = {
      final_score: finalScore,
      round1_correct: round1Correct,
      round1_incorrect: round1Incorrect,
      round1_timed_out: round1TimedOut,
      round2_correct: round2Correct,
      round2_incorrect: round2Incorrect,
      round2_timed_out: round2TimedOut,
      final_jeopardy_correct: finalJeopardyCorrect ? 1 : 0,
    }

    const newAchievements = checkAndAwardAchievements(req.user.userId, gameData, totalGames)
    saveDatabase()

    res.json({ success: true, data: { newAchievements } })
  } catch (err) {
    console.error('Save game error:', err)
    res.status(500).json({ success: false, error: 'Failed to save game' })
  }
})

// GET /api/games — game history for the authenticated user
router.get('/', requireAuth, (req, res) => {
  try {
    const games = getAllQuery(
      'SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT 20',
      [req.user.userId]
    )
    const [stats] = getAllQuery(
      `SELECT
         COUNT(*) as totalGames,
         COALESCE(MAX(final_score), 0) as bestScore,
         COALESCE(ROUND(AVG(final_score)), 0) as avgScore,
         COALESCE(SUM(round1_correct + round2_correct), 0) as totalCorrect,
         COALESCE(SUM(round1_correct + round1_incorrect + round1_timed_out + round2_correct + round2_incorrect + round2_timed_out), 0) as totalAnswered,
         COALESCE(SUM(CASE WHEN final_jeopardy_correct = 1 THEN 1 ELSE 0 END), 0) as finalJeopardyWins
       FROM games WHERE user_id = ?`,
      [req.user.userId]
    )

    res.json({
      success: true,
      data: {
        games,
        totalGames: stats.totalGames,
        bestScore: stats.bestScore,
        avgScore: stats.avgScore,
        lifetimeStats: {
          totalGames: stats.totalGames,
          bestScore: stats.bestScore,
          avgScore: stats.avgScore,
          totalCorrect: stats.totalCorrect,
          totalAnswered: stats.totalAnswered,
          finalJeopardyWins: stats.finalJeopardyWins,
        },
      },
    })
  } catch (err) {
    console.error('Games history error:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch game history' })
  }
})

export default router
