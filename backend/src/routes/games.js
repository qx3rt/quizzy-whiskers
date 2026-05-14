import express from 'express'
import { getAllQuery, getDatabase, saveDatabase } from '../db/database.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

function checkAndAwardAchievements(userId, gameData, allGamesCount) {
  const allAchievements = getAllQuery('SELECT * FROM achievements')
  const earned = new Set(
    getAllQuery('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]).map(
      (r) => r.achievement_id
    )
  )
  const db = getDatabase()
  const newlyEarned = []

  for (const ach of allAchievements) {
    if (earned.has(ach.id)) continue
    let grant = false

    switch (ach.slug) {
      case 'first_game':
        grant = true
        break
      case 'perfect_round':
        grant =
          (gameData.round1_incorrect === 0 &&
            gameData.round1_timed_out === 0 &&
            gameData.round1_correct >= 5) ||
          (gameData.round2_incorrect === 0 &&
            gameData.round2_timed_out === 0 &&
            gameData.round2_correct >= 5)
        break
      case 'final_jeopardy_winner':
        grant = gameData.final_jeopardy_correct === 1
        break
      case 'high_roller':
        grant = gameData.final_score >= 10000
        break
      case 'century_club':
        grant = allGamesCount >= 100
        break
    }

    if (grant) {
      db.run('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)', [
        userId,
        ach.id,
      ])
      newlyEarned.push({ slug: ach.slug, name: ach.name, description: ach.description })
    }
  }

  return newlyEarned
}

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
    const [{ count: totalGames }] = getAllQuery(
      'SELECT COUNT(*) as count FROM games WHERE user_id = ?',
      [req.user.userId]
    )
    const bestScore = games.length ? Math.max(...games.map((g) => g.final_score)) : 0
    const avgScore = games.length
      ? Math.round(games.reduce((s, g) => s + g.final_score, 0) / games.length)
      : 0

    res.json({ success: true, data: { games, totalGames, bestScore, avgScore } })
  } catch (err) {
    console.error('Games history error:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch game history' })
  }
})

export default router
