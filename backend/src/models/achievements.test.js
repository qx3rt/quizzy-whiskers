import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp } from '../test/helpers.js'
import { getQuery, runQuery } from '../db/database.js'
import { checkAndAwardAchievements } from './achievements.js'

async function setupUser() {
  await createTestApp()
  const hash = '$2a$10$fixedhashfortest000000000000000000000000000000000000000'
  const result = await runQuery(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
    ['ach@test.com', hash]
  )
  return result.rows[0].id
}

describe('checkAndAwardAchievements', () => {
  let userId

  beforeEach(async () => {
    userId = await setupUser()
  })

  const baseGame = {
    final_score: 0,
    round1_correct: 0, round1_incorrect: 0, round1_timed_out: 0,
    round2_correct: 0, round2_incorrect: 0, round2_timed_out: 0,
    final_jeopardy_correct: 0,
  }

  it('awards first_game on any game', async () => {
    const earned = await checkAndAwardAchievements(userId, baseGame, 1)
    const slugs = earned.map(a => a.slug)
    expect(slugs).toContain('first_game')
  })

  it('awards perfect_round when round 1 is flawless (5+ correct)', async () => {
    const game = { ...baseGame, round1_correct: 5, round1_incorrect: 0, round1_timed_out: 0 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).toContain('perfect_round')
  })

  it('awards perfect_round when round 2 is flawless', async () => {
    const game = { ...baseGame, round2_correct: 5, round2_incorrect: 0, round2_timed_out: 0 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).toContain('perfect_round')
  })

  it('does not award perfect_round when there are incorrect answers', async () => {
    const game = { ...baseGame, round1_correct: 5, round1_incorrect: 1, round1_timed_out: 0 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).not.toContain('perfect_round')
  })

  it('does not award perfect_round when fewer than 5 correct', async () => {
    const game = { ...baseGame, round1_correct: 4, round1_incorrect: 0, round1_timed_out: 0 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).not.toContain('perfect_round')
  })

  it('awards final_jeopardy_winner when final_jeopardy_correct = 1', async () => {
    const game = { ...baseGame, final_jeopardy_correct: 1 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).toContain('final_jeopardy_winner')
  })

  it('does not award final_jeopardy_winner when final_jeopardy_correct = 0', async () => {
    const game = { ...baseGame, final_jeopardy_correct: 0 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).not.toContain('final_jeopardy_winner')
  })

  it('awards high_roller for score >= 10000', async () => {
    const game = { ...baseGame, final_score: 10000 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).toContain('high_roller')
  })

  it('does not award high_roller for score < 10000', async () => {
    const game = { ...baseGame, final_score: 9999 }
    const earned = await checkAndAwardAchievements(userId, game, 1)
    expect(earned.map(a => a.slug)).not.toContain('high_roller')
  })

  it('awards century_club at exactly 100 games', async () => {
    const earned = await checkAndAwardAchievements(userId, baseGame, 100)
    expect(earned.map(a => a.slug)).toContain('century_club')
  })

  it('does not award century_club below 100 games', async () => {
    const earned = await checkAndAwardAchievements(userId, baseGame, 99)
    expect(earned.map(a => a.slug)).not.toContain('century_club')
  })

  it('does not re-award an already-earned achievement', async () => {
    const achRow = await getQuery("SELECT id FROM achievements WHERE slug = 'first_game'")
    const achId = achRow.id
    await runQuery(
      'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
      [userId, achId]
    )

    const earned = await checkAndAwardAchievements(userId, baseGame, 1)
    expect(earned.map(a => a.slug)).not.toContain('first_game')
  })

  it('can award multiple achievements in one call', async () => {
    const game = { ...baseGame, final_score: 10000, final_jeopardy_correct: 1 }
    const earned = await checkAndAwardAchievements(userId, game, 100)
    const slugs = earned.map(a => a.slug)
    expect(slugs).toContain('first_game')
    expect(slugs).toContain('high_roller')
    expect(slugs).toContain('final_jeopardy_winner')
    expect(slugs).toContain('century_club')
  })
})
