const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`)
  }
  return response.json()
}

// Returns topic areas: [{ id, name, category_count }]
export async function fetchCategories() {
  const json = await request('/api/categories')
  return json.data
}

// topicSlugs: optional array of topic area ids (e.g. ['shakespeare', 'mythology'])
// round: 'Jeopardy!' | 'Double Jeopardy!' — filters to one round for consistent dollar values
export async function fetchBoard(topicSlugs = [], round = '') {
  const params = new URLSearchParams()
  if (topicSlugs.length) params.set('topics', topicSlugs.join(','))
  if (round) params.set('round', round)
  const qs = params.toString() ? `?${params}` : ''
  const json = await request(`/api/board${qs}`)

  return json.data.map((column) => ({
    category: column.category,
    clues: column.clues.map((clue) => ({
      id: clue.id,
      value: clue.value,
      clue: clue.clue_text,
      response: clue.response_text,
      used: false,
    })),
  }))
}

// Returns { category: string, clue: { id, clue_text, response_text } }
export async function fetchFinalJeopardy() {
  const json = await request('/api/board/final')
  return json.data
}
