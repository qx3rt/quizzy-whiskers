import express from 'express'
import { initializeDatabase, getDatabase } from '../db/database.js'
import categoriesRouter from '../routes/categories.js'
import boardRouter from '../routes/board.js'
import authRouter from '../routes/auth.js'
import gamesRouter from '../routes/games.js'
import achievementsRouter from '../routes/achievements.js'

const ACHIEVEMENTS = [
  { slug: 'first_game',            name: 'First Steps',  description: 'Complete your first game' },
  { slug: 'perfect_round',         name: 'Clean Sweep',  description: 'Answer all 5 clues in a round correctly' },
  { slug: 'final_jeopardy_winner', name: 'Final Say',    description: 'Win Final Jeopardy!' },
  { slug: 'high_roller',           name: 'High Roller',  description: 'Score $10,000 or more in a single game' },
  { slug: 'century_club',          name: 'Century Club', description: 'Play 100 games' },
]

export async function createTestApp() {
  await initializeDatabase()
  const db = getDatabase()
  for (const ach of ACHIEVEMENTS) {
    db.run(
      'INSERT OR IGNORE INTO achievements (slug, name, description) VALUES (?, ?, ?)',
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

// Inserts 8 full Jeopardy! categories (5 clues each at $200-$1000) so board
// tests have data to work with without loading the full jarchive JSON.
export function seedTestBoard(round = 'Jeopardy!') {
  const db = getDatabase()
  const maxValue = round === 'Double Jeopardy!' ? 2000 : 1000
  const values = round === 'Double Jeopardy!'
    ? [400, 800, 1200, 1600, 2000]
    : [200, 400, 600, 800, 1000]
  const topicArea = 'test-topic'

  for (let c = 0; c < 8; c++) {
    db.run(
      'INSERT INTO categories (name, slug, topic_area, round) VALUES (?, ?, ?, ?)',
      [`Test Category ${c}`, `test-cat-${round.replace(/[^a-z]/gi, '')}-${c}`, topicArea, round]
    )
    const result = db.exec('SELECT last_insert_rowid()')
    const catId = result[0].values[0][0]
    for (const val of values) {
      db.run(
        'INSERT INTO clues (clue_text, response_text, category_id, dollar_value) VALUES (?, ?, ?, ?)',
        [`Clue for $${val}`, `Answer ${val}`, catId, val]
      )
    }
  }

  // One Final Jeopardy! category (only on first call — idempotent guard via INSERT OR IGNORE)
  db.run(
    "INSERT OR IGNORE INTO categories (name, slug, topic_area, round) VALUES (?, ?, ?, 'Final Jeopardy!')",
    ['Test Final', 'test-final', 'test-topic']
  )
  const fRows = db.exec("SELECT id FROM categories WHERE slug = 'test-final'")
  if (fRows.length && fRows[0].values.length) {
    const fCatId = fRows[0].values[0][0]
    const hasClue = db.exec(`SELECT id FROM clues WHERE category_id = ${fCatId}`)
    if (!hasClue.length || !hasClue[0].values.length) {
      db.run(
        'INSERT INTO clues (clue_text, response_text, category_id, dollar_value) VALUES (?, ?, ?, ?)',
        ['Final clue', 'Final answer', fCatId, null]
      )
    }
  }
}
