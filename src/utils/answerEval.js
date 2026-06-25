export const FUZZY_MATCH_THRESHOLD = 0.80

// Split a raw (un-normalized) correct answer into alternate acceptable forms.
// Handles patterns like "France or Germany", "Twain/Clemens", "A and/or B".
export function splitAlternates(rawAnswer) {
  return rawAnswer
    .split(/\s+and\/or\s+|\s+or\s+|\s*\/\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

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

function matchesSingle(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) return false
  if (userAnswer === correctAnswer) return true
  if (correctAnswer.length >= 6 && userAnswer.includes(correctAnswer)) return true
  if (getSimilarityScore(userAnswer, correctAnswer) >= FUZZY_MATCH_THRESHOLD) return true
  const stemmedUser = simpleStem(userAnswer)
  const stemmedCorrect = simpleStem(correctAnswer)
  if (stemmedUser === stemmedCorrect) return true
  if (getSimilarityScore(stemmedUser, stemmedCorrect) >= FUZZY_MATCH_THRESHOLD) return true
  // Order-insensitive: sort words of both answers and compare
  const userSorted = userAnswer.split(/\s+/).sort().join(' ')
  const correctSorted = correctAnswer.split(/\s+/).sort().join(' ')
  if (userSorted === correctSorted) return true
  if (getSimilarityScore(userSorted, correctSorted) >= FUZZY_MATCH_THRESHOLD) return true
  // Abbreviation: user typed the start of a longer correct answer (e.g. "vet" → "veterinarian")
  if (userAnswer.length >= 3 && correctAnswer.startsWith(userAnswer)) return true
  return false
}

// alternates: optional array of pre-normalized alternate correct answers
export function answersMatch(userAnswer, correctAnswer, alternates = []) {
  if (matchesSingle(userAnswer, correctAnswer)) return true
  return alternates.some((alt) => matchesSingle(userAnswer, alt))
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
