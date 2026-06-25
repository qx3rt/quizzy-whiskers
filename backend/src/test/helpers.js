import express from 'express'
import { initializeDatabase, getAllQuery, runQuery } from '../db/database.js'
import categoriesRouter from '../routes/categories.js'
import boardRouter from '../routes/board.js'
import authRouter from '../routes/auth.js'
import gamesRouter from '../routes/games.js'
import achievementsRouter from '../routes/achievements.js'

const TEST_ACHIEVEMENTS = [
  { slug: 'first_game',            name: 'First Steps',  description: 'Complete your first game' },
  { slug: 'perfect_round',         name: 'Clean Sweep',  description: 'Answer all 5 clues in a round correctly' },
  { slug: 'final_jeopardy_winner', name: 'Final Say',    description: 'Win Final Jeopardy!' },
  { slug: 'high_roller',           name: 'High Roller',  description: 'Score $10,000 or more in a single game' },
  { slug: 'century_club',          name: 'Century Club', description: 'Play 100 games' },
]

export async function createTestApp() {
  await initializeDatabase()

  // Create Cluebase's clues table for test seeding (not created by initializeDatabase)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS clues (
      id SERIAL PRIMARY KEY,
      game_id INTEGER,
      value INTEGER,
      daily_double BOOLEAN DEFAULT FALSE,
      round TEXT,
      category TEXT,
      clue TEXT,
      response TEXT
    )
  `)

  // Truncate all tables for clean test isolation
  await runQuery(`
    TRUNCATE TABLE user_achievements, games_played, users, achievements,
      category_group_mappings, category_groups, final_jeopardy, clues
    RESTART IDENTITY CASCADE
  `)

  for (const ach of TEST_ACHIEVEMENTS) {
    await runQuery(
      'INSERT INTO achievements (slug, name, description) VALUES ($1, $2, $3)',
      [ach.slug, ach.name, ach.description]
    )
  }

  const app = express()
  app.use(express.json())
  app.use('/api/categories', categoriesRouter)
  app.use('/api/board', boardRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/games', gamesRouter)
  app.use('/api/achievements', achievementsRouter)
  return app
}

// Inserts 8 full Jeopardy! or Double Jeopardy! categories (5 clues each) so
// board tests have data to work with without loading the full Cluebase dataset.
export async function seedTestBoard(round = 'Jeopardy!') {
  const cluebaseRound = round === 'Double Jeopardy!' ? 'DJ!' : 'J!'
  const values = round === 'Double Jeopardy!'
    ? [400, 800, 1200, 1600, 2000]
    : [200, 400, 600, 800, 1000]

  const groupResult = await runQuery(
    `INSERT INTO category_groups (slug, display_name)
     VALUES ('test-topic', 'Test Topic')
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
     RETURNING id`
  )
  const groupId = groupResult.rows[0].id

  for (let c = 0; c < 8; c++) {
    const categoryName = `Test Category ${round.replace(/[^a-z]/gi, '')} ${c}`

    await runQuery(
      'INSERT INTO category_group_mappings (category_group_id, cluebase_category) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [groupId, categoryName]
    )

    for (const val of values) {
      await runQuery(
        'INSERT INTO clues (category, round, value, clue, response, game_id, daily_double) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [categoryName, cluebaseRound, val, `Clue for $${val}`, `Answer ${val}`, 1, false]
      )
    }
  }

  // One Final Jeopardy clue (idempotent)
  const existing = await getAllQuery("SELECT id FROM final_jeopardy WHERE name = 'Test Final'")
  if (existing.length === 0) {
    await runQuery(
      'INSERT INTO final_jeopardy (name, clue_text, response_text) VALUES ($1, $2, $3)',
      ['Test Final', 'Final clue', 'Final answer']
    )
  }
}
