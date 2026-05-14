import { getAllQuery } from '../db/database.js'

// Generates a 6-column board. Each column is a real Jeopardy! category-set
// (original episode category name + 5 clues in dollar-value order).
//
// topicAreas: array of topic slugs (e.g. ['shakespeare', 'mythology'])
// round: 'Jeopardy!' | 'Double Jeopardy!' | 'Final Jeopardy!' — filters to one round
//        so all 6 columns share consistent dollar values. Defaults to 'Jeopardy!'.
export function generateCuratedBoard(topicAreas = [], round = 'Jeopardy!') {
  let candidates

  if (topicAreas.length > 0) {
    // sql.js doesn't support IN (?) with an array — build placeholders manually
    const placeholders = topicAreas.map(() => '?').join(', ')
    candidates = getAllQuery(
      `SELECT id, name, topic_area, season, air_date, round
       FROM categories
       WHERE round = ? AND topic_area IN (${placeholders})`,
      [round, ...topicAreas]
    )
  } else {
    candidates = getAllQuery(
      'SELECT id, name, topic_area, season, air_date, round FROM categories WHERE round = ?',
      [round]
    )
  }

  if (candidates.length === 0) {
    return []
  }

  // JS shuffle (sql.js has no ORDER BY RANDOM())
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, 6)

  return shuffled.map(cat => {
    const clues = getAllQuery(
      'SELECT id, clue_text, response_text, dollar_value FROM clues WHERE category_id = ? ORDER BY dollar_value ASC',
      [cat.id]
    )

    return {
      category: cat.name,         // Original Jeopardy! category name — shown as board column header
      topic_area: cat.topic_area,
      clues: clues.map(c => ({
        id: c.id,
        value: c.dollar_value,
        clue_text: c.clue_text,
        response_text: c.response_text,
      })),
    }
  })
}

// Returns a single random Final Jeopardy! category-set (1 clue).
export function generateFinalJeopardy() {
  const candidates = getAllQuery(
    "SELECT id, name, topic_area FROM categories WHERE round = 'Final Jeopardy!'"
  )

  if (candidates.length === 0) {
    return null
  }

  const cat = candidates[Math.floor(Math.random() * candidates.length)]
  const clues = getAllQuery(
    'SELECT id, clue_text, response_text, dollar_value FROM clues WHERE category_id = ?',
    [cat.id]
  )

  if (clues.length === 0) {
    return null
  }

  const clue = clues[0]
  return {
    category: cat.name,
    clue: { id: clue.id, clue_text: clue.clue_text, response_text: clue.response_text },
  }
}
