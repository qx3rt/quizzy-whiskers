const CLUE_VALUES = [200, 400, 600, 800, 1000]

function shuffleArray(items) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }

  return copy
}

function buildCategoryName(index, datasetName) {
  if (datasetName === 'Category') {
    return `Shakespeare ${index + 1}`
  }

  return `${datasetName} ${index + 1}`
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function isMostlyTitleCasePhrase(text) {
  const words = text
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter(Boolean)

  if (words.length === 0) {
    return false
  }

  const allowedLowercaseWords = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'for',
    'from',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'with',
    'part',
  ])

  const romanNumeralPattern = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i

  return words.every((word) => {
    if (allowedLowercaseWords.has(word.toLowerCase())) {
      return true
    }

    if (romanNumeralPattern.test(word)) {
      return true
    }

    return /^[A-Z][a-z0-9'’-]*$/.test(word)
  })
}

function looksLikeAnswerPhrase(text) {
  const wordCount = countWords(text)

  if (wordCount <= 1) {
    return true
  }

  if (wordCount <= 5 && isMostlyTitleCasePhrase(text)) {
    return true
  }

  if (wordCount <= 6 && !/[.?!:;]/.test(text) && isMostlyTitleCasePhrase(text)) {
    return true
  }

  return false
}

function isClueHighQuality(entry) {
  if (!entry || !entry.clue || !entry.response) {
    return false
  }

  const clueText = entry.clue.trim()
  const responseText = entry.response.trim()

  if (!clueText || !responseText) {
    return false
  }

  if (clueText.length < 24) {
    return false
  }

  if (countWords(clueText) < 5) {
    return false
  }

  const lowerText = clueText.toLowerCase()

  if (
    lowerText.includes('authorsdouble') ||
    lowerText.includes('dr. phil') ||
    lowerText.includes('/0') ||
    lowerText.includes('jeopardy round') ||
    lowerText.includes('double jeopardy') ||
    lowerText.includes('daily double') ||
    lowerText.includes('season ') ||
    lowerText.includes('superjeopardy') ||
    lowerText.includes('monday') ||
    lowerText.includes('tuesday') ||
    lowerText.includes('wednesday') ||
    lowerText.includes('thursday') ||
    lowerText.includes('friday') ||
    lowerText.includes('saturday') ||
    lowerText.includes('sunday')
  ) {
    return false
  }

  if (
    /^[A-Z]{4,}Double\b/.test(clueText) ||
    /^Double\s*,?\d+/i.test(clueText) ||
    /^[A-Z]{4,},?\d+/.test(clueText) ||
    /^[a-z]/.test(clueText) ||
    /^[^A-Za-z"]/.test(clueText)
  ) {
    return false
  }

  if (
    /\b\d{4}\b/.test(clueText) ||
    /\$\d+/.test(clueText) ||
    /,\d{3}/.test(clueText)
  ) {
    return false
  }

  if (looksLikeAnswerPhrase(clueText)) {
    return false
  }

  return true
}

export function generateBoardFromStudyClues(
  studyClues,
  datasetName = 'Category'
) {
  const highQualityClues = studyClues.filter(isClueHighQuality)
  const shuffledClues = shuffleArray(highQualityClues)
  const requiredClueCount = 6 * 5

  if (shuffledClues.length < requiredClueCount) {
    throw new Error(
      `Not enough high-quality study clues to build a board. Need ${requiredClueCount}, got ${shuffledClues.length}.`
    )
  }

  const selectedClues = shuffledClues.slice(0, requiredClueCount)
  const board = []

  for (let columnIndex = 0; columnIndex < 6; columnIndex += 1) {
    const start = columnIndex * 5
    const columnClues = selectedClues.slice(start, start + 5)

    board.push({
      category: buildCategoryName(columnIndex, datasetName),
      clues: columnClues.map((entry, clueIndex) => ({
        id: `${datasetName}-${columnIndex + 1}-${start + clueIndex}`,
        value: CLUE_VALUES[clueIndex],
        clue: entry.clue,
        response: entry.response,
        used: false,
      })),
    })
  }

  return board
}