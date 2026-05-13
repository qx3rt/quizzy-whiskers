const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${path}`)
  }
  return response.json()
}

export async function fetchCategories() {
  const json = await request('/api/categories')
  return json.data
}

// Accepts optional array of category IDs to request a specific board.
// Maps API shape → app shape so game logic doesn't need to change.
export async function fetchBoard(categoryIds = []) {
  const qs = categoryIds.length ? `?categories=${categoryIds.join(',')}` : ''
  const json = await request(`/api/board${qs}`)

  return json.data.map((column) => ({
    category: column.category_name,
    clues: column.clues.map((clue) => ({
      id: clue.id,
      value: clue.value,
      clue: clue.clue_text,
      response: clue.response_text,
      used: false,
    })),
  }))
}
