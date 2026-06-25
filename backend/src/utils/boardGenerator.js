import { getAllQuery, getQuery } from '../db/database.js'

// Translate app round names to Cluebase's naming convention
const ROUND_MAP = {
  'Jeopardy!': 'J!',
  'Double Jeopardy!': 'DJ!',
}

// Expected max dollar value per round — excludes old-era categories with
// mismatched values (e.g. DJ! categories that only go up to $1000).
const MAX_VALUE = {
  'Jeopardy!': 1000,
  'Double Jeopardy!': 2000,
}

export async function generateCuratedBoard(topicAreas = [], round = 'Jeopardy!') {
  const cluebaseRound = ROUND_MAP[round] || 'J!'
  const expectedMax = MAX_VALUE[round] || 1000

  let candidateRows

  if (topicAreas.length > 0) {
    candidateRows = await getAllQuery(
      `SELECT c.category
       FROM clues c
       JOIN category_group_mappings cgm ON cgm.cluebase_category = c.category
       JOIN category_groups cg ON cg.id = cgm.category_group_id
       WHERE c.round = $1
         AND c.value > 0
         AND cg.slug = ANY($2::text[])
       GROUP BY c.category
       HAVING COUNT(*) >= 5 AND MAX(c.value) = $3
       ORDER BY RANDOM()
       LIMIT 6`,
      [cluebaseRound, topicAreas, expectedMax]
    )
  } else {
    candidateRows = await getAllQuery(
      `SELECT category
       FROM clues
       WHERE round = $1 AND value > 0
       GROUP BY category
       HAVING COUNT(*) >= 5 AND MAX(value) = $2
       ORDER BY RANDOM()
       LIMIT 6`,
      [cluebaseRound, expectedMax]
    )
  }

  if (candidateRows.length === 0) return []

  const selectedCategories = candidateRows.map(r => r.category)

  // Fetch all clues for the selected categories in one query
  const clues = await getAllQuery(
    `SELECT id, category, value, clue AS clue_text, response AS response_text
     FROM clues
     WHERE round = $1 AND category = ANY($2::text[]) AND value > 0
     ORDER BY category, value ASC`,
    [cluebaseRound, selectedCategories]
  )

  const cluesByCategory = {}
  for (const clue of clues) {
    if (!cluesByCategory[clue.category]) cluesByCategory[clue.category] = []
    cluesByCategory[clue.category].push(clue)
  }

  // Look up topic_area for each category (best-effort; null if untagged)
  const topicRows = await getAllQuery(
    `SELECT cgm.cluebase_category, cg.slug AS topic_area
     FROM category_group_mappings cgm
     JOIN category_groups cg ON cg.id = cgm.category_group_id
     WHERE cgm.cluebase_category = ANY($1::text[])`,
    [selectedCategories]
  )
  const topicByCategory = {}
  for (const row of topicRows) topicByCategory[row.cluebase_category] = row.topic_area

  return selectedCategories.map(category => ({
    category,
    topic_area: topicByCategory[category] || null,
    clues: (cluesByCategory[category] || []).slice(0, 5).map(c => ({
      id: c.id,
      value: c.value,
      clue_text: c.clue_text,
      response_text: c.response_text,
    })),
  }))
}

export async function generateFinalJeopardy() {
  const row = await getQuery(
    'SELECT id, name, clue_text, response_text FROM final_jeopardy ORDER BY RANDOM() LIMIT 1'
  )

  if (!row) return null

  return {
    category: row.name,
    clue: { id: row.id, clue_text: row.clue_text, response_text: row.response_text },
  }
}
