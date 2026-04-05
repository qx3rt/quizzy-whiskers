const CLUE_VALUES = [200, 400, 600, 800, 1000]

function shuffleArray(items) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }

  return copy
}

function buildCategoryName(index) {
  return `Shakespeare ${index + 1}`
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function hasMetadataArtifacts(text) {
  return (
    /double jeopardy/i.test(text) ||
    /jeopardy round/i.test(text) ||
    /daily double/i.test(text) ||
    /\bseason\s+\d+/i.test(text) ||
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      text
    ) ||
    /\b\d{4}\b/.test(text) ||
    /\$\d+/.test(text) ||
    /,\d{3}/.test(text) ||
    /double/i.test(text)
  )
}

function hasMergedArtifactPrefix(text) {
  return (
    /^[A-Z]{4,}Double\b/.test(text) ||
    /^[A-Z]{4,}[A-Z][a-z]/.test(text) ||
    /^Double\s*,?\d+/i.test(text) ||
    /^[A-Z]{4,},?\d+/.test(text)
  )
}

function startsSuspiciously(text) {
  return (
    /^[a-z]/.test(text) ||
    /^[^A-Za-z"]/.test(text) ||
    /^[A-Z]{4,}[a-z]/.test(text)
  )
}

function looksTooFragmentary(text) {
  const wordCount = countWords(text)

  if (text.length < 28) {
    return true
  }

  if (wordCount < 5) {
    return true
  }

  if (text.length < 45 && wordCount <= 6) {
    return true
  }

  return false
}

function looksLikePlayableClue(entry) {
  if (!entry || !entry.clue || !entry.response) {
    return false
  }

  const clueText = entry.clue.trim()
  const responseText = entry.response.trim()

  if (!clueText || !responseText) {
    return false
  }

  if (looksTooFragmentary(clueText)) {
    return false
  }

  if (startsSuspiciously(clueText)) {
    return false
  }

  if (hasMetadataArtifacts(clueText)) {
    return false
  }

  if (hasMergedArtifactPrefix(clueText)) {
    return false
  }

  return true
}

export function generateBoardFromStudyClues(studyClues) {
  const playableClues = studyClues.filter(looksLikePlayableClue)
  const shuffledClues = shuffleArray(playableClues)
  const requiredClueCount = 6 * 5

  if (shuffledClues.length < requiredClueCount) {
    throw new Error(
      `Not enough playable study clues to build a board. Need ${requiredClueCount}, received ${shuffledClues.length}.`
    )
  }

  const selectedClues = shuffledClues.slice(0, requiredClueCount)
  const board = []

  for (let columnIndex = 0; columnIndex < 6; columnIndex += 1) {
    const start = columnIndex * 5
    const columnClues = selectedClues.slice(start, start + 5)

    board.push({
      category: buildCategoryName(columnIndex),
      clues: columnClues.map((clue, clueIndex) => ({
        id: `shakespeare-${columnIndex + 1}-${clueIndex + 1}-${start + clueIndex}`,
        value: CLUE_VALUES[clueIndex],
        clue: clue.clue,
        response: clue.response,
        used: false,
      })),
    })
  }

  return board
}