import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDatabase, getAllQuery, saveDatabase } from './database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JARCHIVE_DIR = path.resolve(__dirname, '../../data/jarchive')
const FJ_FILE = path.join(JARCHIVE_DIR, 'final_jeopardy.json')

// Syncs all category-sets from backend/data/jarchive/*.json into the database.
// Regular topic files contain {name, topic_area, season, air_date, round, clues[]} objects.
// final_jeopardy.json contains {name, round, air_date, clue_text, response_text} objects.
// Idempotent per type: topic categories and Final Jeopardy are seeded independently.
export async function syncJarchiveCategories() {
  if (!fs.existsSync(JARCHIVE_DIR)) {
    console.warn(`  jarchive data directory not found: ${JARCHIVE_DIR}`)
    console.warn('  Run: node scripts/importJeopardy.mjs')
    return 0
  }

  const files = fs.readdirSync(JARCHIVE_DIR).filter(f => f.endsWith('.json') && f !== 'final_jeopardy.json')
  const db = getDatabase()
  let added = 0

  // ── Seed topic category-sets ───────────────────────────────────────────────
  const existingTopics = getAllQuery('SELECT COUNT(*) as count FROM categories WHERE topic_area IS NOT NULL')
  if (existingTopics[0]?.count > 0) {
    const [{ count: catCount }] = getAllQuery('SELECT COUNT(*) as count FROM categories WHERE topic_area IS NOT NULL')
    console.log(`✓ Topics already seeded: ${catCount} category-sets`)
  } else if (files.length === 0) {
    console.warn('  No jarchive JSON files found. Run: node scripts/importJeopardy.mjs')
  } else {
    let slugCounter = 1

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
  }

  // ── Seed Final Jeopardy! clues ────────────────────────────────────────────
  const existingFJ = getAllQuery("SELECT COUNT(*) as count FROM categories WHERE round = 'Final Jeopardy!'")
  if (existingFJ[0]?.count > 0) {
    console.log(`✓ Final Jeopardy already seeded: ${existingFJ[0].count} clues`)
  } else if (!fs.existsSync(FJ_FILE)) {
    console.warn('  final_jeopardy.json not found — Final Jeopardy round will be unavailable')
    console.warn('  Run: node scripts/importJeopardy.mjs')
  } else {
    let fjEntries
    try {
      fjEntries = JSON.parse(fs.readFileSync(FJ_FILE, 'utf8'))
    } catch {
      console.warn('  Could not read final_jeopardy.json — skipping')
      fjEntries = []
    }

    let fjSlugCounter = 1
    for (const entry of fjEntries) {
      if (!entry.clue_text || !entry.response_text) continue

      const slug = `fj-${fjSlugCounter++}`
      db.run(
        `INSERT OR IGNORE INTO categories (name, slug, topic_area, season, air_date, round)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entry.name, slug, null, null, entry.air_date ?? null, 'Final Jeopardy!']
      )

      const idResult = db.exec('SELECT last_insert_rowid()')
      const categoryId = idResult[0]?.values?.[0]?.[0]
      if (!categoryId) continue

      db.run(
        `INSERT INTO clues (clue_text, response_text, category_id, dollar_value, source)
         VALUES (?, ?, ?, ?, ?)`,
        [entry.clue_text, entry.response_text, categoryId, null, 'jarchive']
      )

      added++
    }

    console.log(`✓ Seeded ${fjSlugCounter - 1} Final Jeopardy! clues`)
  }

  saveDatabase()

  const [{ count: catCount }] = getAllQuery('SELECT COUNT(*) as count FROM categories')
  const [{ count: clueCount }] = getAllQuery('SELECT COUNT(*) as count FROM clues')
  console.log(`✓ Sync complete: ${catCount} total category-sets, ${clueCount} clues`)
  return added
}

// Backwards compat aliases
export const seedIfEmpty = syncJarchiveCategories
export const syncCategories = syncJarchiveCategories
