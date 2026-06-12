export const FUZZY_MATCH_THRESHOLD = 0.80

export function normalizeAnswer(text) {
  return text
    .toLowerCase()
    .replace(/^(what|who|where|when)\s+(is|are|was|were)\s+/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getLevenshteinDistance(source, target) {
  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = source[row - 1] === target[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      )
    }
  }

  return matrix[source.length][target.length]
}

export function getSimilarityScore(source, target) {
  if (!source && !target) return 1
  const longest = Math.max(source.length, target.length)
  if (longest === 0) return 1
  return 1 - getLevenshteinDistance(source, target) / longest
}

export function simpleStem(str) {
  if (str.endsWith('ies') && str.length > 4) return str.slice(0, -3) + 'y'
  if (str.endsWith('ves') && str.length > 4) return str.slice(0, -3) + 'f'
  if (str.endsWith('es') && str.length > 4) return str.slice(0, -2)
  if (str.endsWith('s') && str.length > 3) return str.slice(0, -1)
  return str
}

export function answersMatch(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) return false
  if (userAnswer === correctAnswer) return true
  if (correctAnswer.length >= 6 && userAnswer.includes(correctAnswer)) return true
  if (getSimilarityScore(userAnswer, correctAnswer) >= FUZZY_MATCH_THRESHOLD) return true
  const stemmedUser = simpleStem(userAnswer)
  const stemmedCorrect = simpleStem(correctAnswer)
  if (stemmedUser === stemmedCorrect) return true
  if (getSimilarityScore(stemmedUser, stemmedCorrect) >= FUZZY_MATCH_THRESHOLD) return true
  return false
}

export function isPartialMatch(userAnswer, correctAnswer) {
  const normalUser = normalizeAnswer(userAnswer)
  const normalCorrect = normalizeAnswer(correctAnswer)
  if (!normalUser || normalUser === normalCorrect) return false
  const userWords = normalUser.split(/\s+/).filter(Boolean)
  const correctWords = normalCorrect.split(/\s+/).filter(Boolean)
  return (
    userWords.length < correctWords.length &&
    userWords.every((w) => correctWords.includes(w))
  )
}

export function placeDailyDoubles(board, count) {
  const eligible = []
  board.forEach((col) => {
    col.clues.forEach((clue, idx) => {
      if (idx > 0) eligible.push(clue.id)
    })
  })
  const shuffled = eligible.sort(() => Math.random() - 0.5)
  return new Set(shuffled.slice(0, count))
}
