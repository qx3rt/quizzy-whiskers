import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getAllQuery, getClient, runQuery } from '../db/database.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JARCHIVE_DIR = join(__dirname, '../../data/jarchive')

// Jarchive scraper double-escaped closing quotes inside clue text (e.g. "homes\" → "homes")
const clean = (s) => s.replace(/\\"/g, '"')

const ROUND_MAP = {
  'Jeopardy!': 'J!',
  'Double Jeopardy!': 'DJ!',
}

async function batchInsert(client, table, columns, rows) {
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values = []
    const placeholders = chunk.map((row, ri) => {
      row.forEach((v) => values.push(v))
      const base = ri * columns.length
      return `(${columns.map((_, ci) => `$${base + ci + 1}`).join(', ')})`
    })
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values
    )
  }
}

export async function seedClues() {
  const [{ count }] = await getAllQuery('SELECT COUNT(*)::int AS count FROM clues')
  if (count > 0) {
    console.log(`[clues] already seeded (${count} rows)`)
    return
  }

  console.log('[clues] Seeding from jarchive data...')
  const files = readdirSync(JARCHIVE_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'final_jeopardy.json'
  )

  const rows = []
  for (const file of files) {
    const categories = JSON.parse(readFileSync(join(JARCHIVE_DIR, file), 'utf8'))
    for (const cat of categories) {
      const round = ROUND_MAP[cat.round]
      if (!round) continue
      for (const clue of cat.clues) {
        if (!clue.clue_text || !clue.response_text || !clue.dollar_value) continue
        rows.push([cat.name, round, clue.dollar_value, clean(clue.clue_text), clean(clue.response_text)])
      }
    }
  }

  const client = await getClient()
  try {
    await client.query('BEGIN')
    await batchInsert(client, 'clues', ['category', 'round', 'value', 'clue', 'response'], rows)
    await client.query('COMMIT')
    console.log(`[clues] Seeded ${rows.length} clues from ${files.length} topic files`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[clues] Seed failed:', err.message)
  } finally {
    client.release()
  }
}

export async function seedFinalJeopardy() {
  const [{ count }] = await getAllQuery('SELECT COUNT(*)::int AS count FROM final_jeopardy')
  if (count > 0) {
    console.log(`[final_jeopardy] already seeded (${count} rows)`)
    return
  }

  console.log('[final_jeopardy] Seeding from jarchive data...')
  const data = JSON.parse(readFileSync(join(JARCHIVE_DIR, 'final_jeopardy.json'), 'utf8'))
  const rows = data
    .filter((c) => c.clue_text && c.response_text && c.name)
    .map((c) => [c.name, c.air_date || null, clean(c.clue_text), clean(c.response_text)])

  const client = await getClient()
  try {
    await client.query('BEGIN')
    await batchInsert(client, 'final_jeopardy', ['name', 'air_date', 'clue_text', 'response_text'], rows)
    await client.query('COMMIT')
    console.log(`[final_jeopardy] Seeded ${rows.length} clues`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[final_jeopardy] Seed failed:', err.message)
  } finally {
    client.release()
  }
}

// One-time fix for rows already seeded with jarchive escape artifacts.
// Idempotent — rows without the artifact are unaffected; subsequent runs find nothing to update.
export async function fixClueEscapes() {
  const result = await runQuery(
    `UPDATE clues SET clue = REPLACE(clue, $1, $2), response = REPLACE(response, $1, $2)
     WHERE POSITION($1 IN clue) > 0 OR POSITION($1 IN response) > 0`,
    ['\\"', '"']
  )
  if (result.rowCount > 0) {
    console.log(`[clues] Fixed escape artifacts in ${result.rowCount} rows`)
  }
}
