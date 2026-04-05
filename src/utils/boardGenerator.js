const CLUE_VALUES = [200, 400, 600, 800, 1000]

function shuffleArray(items) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }

  return copy
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

function normalizeText(text) {
  return text.toLowerCase()
}

function isPlayTitle(text) {
  const normalized = normalizeText(text)

  return [
    'hamlet',
    'macbeth',
    'othello',
    'king lear',
    'romeo and juliet',
    'julius caesar',
    'much ado about nothing',
    "a midsummer night's dream",
    'the tempest',
    'twelfth night',
    'measure for measure',
    'as you like it',
    'henry v',
    'henry vi',
    'henry vi, part i',
    'henry vi, part 1',
    'richard iii',
    'merchant of venice',
    'the merchant of venice',
    'titus andronicus',
    "the winter's tale",
    'antony and cleopatra',
    'coriolanus',
    'pericles',
    'the taming of the shrew',
    'comedy of errors',
    'the comedy of errors',
  ].includes(normalized)
}

function isDickensNovel(text) {
  const normalized = normalizeText(text)

  return [
    'bleak house',
    'great expectations',
    'david copperfield',
    'oliver twist',
    'little dorrit',
    'hard times',
    'nicholas nickleby',
    'martin chuzzlewit',
    'our mutual friend',
    'a tale of two cities',
    'pickwick papers',
    'the pickwick papers',
    'barnaby rudge',
    'dombey and son',
    'christmas carol',
    'a christmas carol',
  ].includes(normalized)
}

function buildBoardColumn(entries, categoryName, fallbackPool = []) {
  const filtered = shuffleArray(entries.filter(isClueHighQuality))
  const backup = shuffleArray(fallbackPool.filter(isClueHighQuality))

  const selected = []
  const usedIds = new Set()

  for (const entry of filtered) {
    const key = `${entry.clue}|||${entry.response}`
    if (!usedIds.has(key)) {
      selected.push(entry)
      usedIds.add(key)
    }
    if (selected.length === 5) break
  }

  if (selected.length < 5) {
    for (const entry of backup) {
      const key = `${entry.clue}|||${entry.response}`
      if (!usedIds.has(key)) {
        selected.push(entry)
        usedIds.add(key)
      }
      if (selected.length === 5) break
    }
  }

  if (selected.length < 5) {
    return {
      category: categoryName,
      clues: CLUE_VALUES.map((value, index) => ({
        id: `${categoryName}-placeholder-${index + 1}`,
        value,
        clue: 'This category is still being curated.',
        response: 'Placeholder',
        used: false,
      })),
    }
  }

  return {
    category: categoryName,
    clues: selected.map((entry, clueIndex) => ({
      id: `${categoryName}-${clueIndex + 1}-${entry.response}`,
      value: CLUE_VALUES[clueIndex],
      clue: entry.clue,
      response: entry.response,
      used: false,
    })),
  }
}

export function generateCuratedBoard(datasets) {
  const shakespeare = datasets.shakespeare ?? []
  const dickens = datasets.dickens ?? []
  const opera = datasets.opera ?? []
  const classicalMusic = datasets.classicalMusic ?? []

  const shakespearePlays = shakespeare.filter((entry) => isPlayTitle(entry.response))
  const shakespeareCharacters = shakespeare.filter((entry) => !isPlayTitle(entry.response))
  const dickensNovels = dickens.filter((entry) => isDickensNovel(entry.response))
  const dickensCharacters = dickens.filter((entry) => !isDickensNovel(entry.response))

  return [
    buildBoardColumn(shakespearePlays, 'Shakespeare Plays', shakespeare),
    buildBoardColumn(shakespeareCharacters, 'Shakespeare Characters', shakespeare),
    buildBoardColumn(dickensNovels, 'Dickens Novels', dickens),
    buildBoardColumn(dickensCharacters, 'Dickens Characters', dickens),
    buildBoardColumn(opera, 'Opera', opera),
    buildBoardColumn(classicalMusic, 'Classical Music', classicalMusic),
  ]
}

export function generateBoardFromStudyClues(studyClues, datasetName = 'Shakespeare') {
  const filtered = shuffleArray(studyClues.filter(isClueHighQuality))
  const board = []

  for (let columnIndex = 0; columnIndex < 6; columnIndex += 1) {
    const start = columnIndex * 5
    const columnClues = filtered.slice(start, start + 5)

    board.push({
      category: `${datasetName} ${columnIndex + 1}`,
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