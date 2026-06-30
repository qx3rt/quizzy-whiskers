import { getAllQuery, runQuery } from '../db/database.js'

export async function checkAndAwardAchievements(userId, gameData, allGamesCount) {
  const [allAchievements, earnedRows, fjRows, correctRows] = await Promise.all([
    getAllQuery('SELECT * FROM achievements'),
    getAllQuery('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]),
    getAllQuery(
      'SELECT COALESCE(SUM(final_jeopardy_correct), 0)::int AS total FROM games_played WHERE user_id = $1',
      [userId]
    ),
    getAllQuery(
      'SELECT COALESCE(SUM(round1_correct + round2_correct), 0)::int AS total FROM games_played WHERE user_id = $1',
      [userId]
    ),
  ])
  const earned = new Set(earnedRows.map(r => r.achievement_id))
  const fjWins = fjRows[0].total
  const totalCorrect = correctRows[0].total
  const newlyEarned = []

  for (const ach of allAchievements) {
    if (earned.has(ach.id)) continue
    let grant = false

    switch (ach.slug) {
      case 'first_game':
        grant = true
        break
      case 'ten_games':
        grant = allGamesCount >= 10
        break
      case 'fifty_games':
        grant = allGamesCount >= 50
        break
      case 'century_club':
        grant = allGamesCount >= 100
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
      case 'perfect_game':
        grant =
          gameData.round1_incorrect === 0 &&
          gameData.round1_timed_out === 0 &&
          gameData.round2_incorrect === 0 &&
          gameData.round2_timed_out === 0
        break
      case 'no_timeouts':
        grant = gameData.round1_timed_out === 0 && gameData.round2_timed_out === 0
        break
      case 'double_dominator':
        grant =
          gameData.round2_incorrect === 0 &&
          gameData.round2_timed_out === 0 &&
          gameData.round2_correct >= 5
        break
      case 'final_jeopardy_winner':
        grant = gameData.final_jeopardy_correct === 1
        break
      case 'fj_regular':
        grant = fjWins >= 5
        break
      case 'high_roller':
        grant = gameData.final_score >= 10000
        break
      case 'grand_champion':
        grant = gameData.final_score >= 20000
        break
      case 'answer_machine':
        grant = totalCorrect >= 200
        break
    }

    if (grant) {
      newlyEarned.push({ id: ach.id, slug: ach.slug, name: ach.name, description: ach.description })
    }
  }

  if (newlyEarned.length > 0) {
    const placeholders = newlyEarned.map((_, i) => `($1, $${i + 2})`).join(', ')
    const ids = newlyEarned.map((a) => a.id)
    await runQuery(
      `INSERT INTO user_achievements (user_id, achievement_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      [userId, ...ids]
    )
  }

  return newlyEarned.map(({ slug, name, description }) => ({ slug, name, description }))
}
