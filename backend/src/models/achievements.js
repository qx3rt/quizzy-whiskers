import { getAllQuery, getDatabase } from '../db/database.js'

export function checkAndAwardAchievements(userId, gameData, allGamesCount) {
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
