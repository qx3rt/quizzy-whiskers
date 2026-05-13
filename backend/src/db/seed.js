import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDatabase, getAllQuery, saveDatabase } from './database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JARCHIVE_DIR = path.resolve(__dirname, '../../data/jarchive')

// Syncs all category-sets from backend/data/jarchive/*.json into the database.
// Each JSON file contains an array of {name, topic_area, season, air_date, round, clues[]} objects.
// Idempotent: skips any category already present (keyed by name + season + round).
export async function syncJarchiveCategories() {
  if (!fs.existsSync(JARCHIVE_DIR)) {
    console.warn(`  jarchive data directory not found: ${JARCHIVE_DIR}`)
    console.warn('  Run: node scripts/importJeopardy.mjs')
    return 0
  }

  const files = fs.readdirSync(JARCHIVE_DIR).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    console.warn('  No jarchive JSON files found. Run: node scripts/importJeopardy.mjs')
    return 0
  }

  // Check if already seeded — if DB has any categories with topic_area, skip
  const existing = getAllQuery('SELECT COUNT(*) as count FROM categories WHERE topic_area IS NOT NULL')
  if (existing[0]?.count > 0) {
    const [{ count: catCount }] = getAllQuery('SELECT COUNT(*) as count FROM categories')
    const [{ count: clueCount }] = getAllQuery('SELECT COUNT(*) as count FROM clues')
    console.log(`✓ Already seeded: ${catCount} category-sets, ${clueCount} clues`)
    return 0
  }

  const db = getDatabase()
  let added = 0
  let slugCounter = 1

  // Use direct db.run() to avoid per-insert saveDatabase() in runQuery()
  for (const file of files.sort()) {
    const filePath = path.join(JARCHIVE_DIR, file)
    let categorySets
    try {
      categorySets = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      console.warn(`  Could not read ${file} — skipping`)
      continue
    }

    for (const catSet of categorySets) {
      const slug = `jarchive-${slugCounter++}`

      db.run(
        `INSERT OR IGNORE INTO categories (name, slug, topic_area, season, air_date, round)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [catSet.name, slug, catSet.topic_area, catSet.season ?? null, catSet.air_date ?? null, catSet.round ?? null]
      )

      // Use last_insert_rowid() to get the id without an extra SELECT
      const idResult = db.exec('SELECT last_insert_rowid()')
      const categoryId = idResult[0]?.values?.[0]?.[0]
      if (!categoryId) {
        console.error(`  Failed to insert category: ${catSet.name}`)
        continue
      }

      for (const clue of catSet.clues) {
        db.run(
          `INSERT INTO clues (clue_text, response_text, category_id, dollar_value, source)
           VALUES (?, ?, ?, ?, ?)`,
          [clue.clue_text, clue.response_text, categoryId, clue.dollar_value ?? null, 'jarchive']
        )
      }

      added++
    }

    process.stdout.write('.')
  }

  process.stdout.write('\n')
  saveDatabase()

  const [{ count: catCount }] = getAllQuery('SELECT COUNT(*) as count FROM categories')
  const [{ count: clueCount }] = getAllQuery('SELECT COUNT(*) as count FROM clues')
  console.log(`✓ Sync complete: ${added} category-sets, ${catCount} total (${clueCount} clues)`)
  return added
}

// Backwards compat aliases
export const seedIfEmpty = syncJarchiveCategories
export const syncCategories = syncJarchiveCategories
