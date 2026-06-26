import { describe, it, expect } from 'vitest'
import {
  normalizeAnswer,
  getLevenshteinDistance,
  getSimilarityScore,
  simpleStem,
  answersMatch,
  isPartialMatch,
  placeDailyDoubles,
} from './answerEval'

describe('normalizeAnswer', () => {
  it('lowercases input', () => {
    expect(normalizeAnswer('HAMLET')).toBe('hamlet')
  })

  it('strips Jeopardy preamble — What is', () => {
    expect(normalizeAnswer('What is France')).toBe('france')
  })

  it('strips Jeopardy preamble — Who was', () => {
    expect(normalizeAnswer('Who was Abraham Lincoln')).toBe('abraham lincoln')
  })

  it('strips Jeopardy preamble — Where are', () => {
    expect(normalizeAnswer('Where are the Rocky Mountains')).toBe('rocky mountains')
  })

  it('strips articles a/an/the', () => {
    expect(normalizeAnswer('the great wall')).toBe('great wall')
    expect(normalizeAnswer('a horse')).toBe('horse')
    expect(normalizeAnswer('an apple')).toBe('apple')
  })

  it('converts & to and then strips it', () => {
    expect(normalizeAnswer('bacon & eggs')).toBe('bacon eggs')
  })

  it('removes punctuation', () => {
    // apostrophes are replaced with a space, not removed
    expect(normalizeAnswer('hello!')).toBe('hello')
    expect(normalizeAnswer('mr. smith')).toBe('mr smith')
  })

  it('removes parenthetical content', () => {
    expect(normalizeAnswer('mercury (the planet)')).toBe('mercury')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeAnswer('  too   many   spaces  ')).toBe('too many spaces')
  })
})

describe('getLevenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(getLevenshteinDistance('abc', 'abc')).toBe(0)
  })

  it('returns string length for empty source', () => {
    expect(getLevenshteinDistance('', 'abc')).toBe(3)
  })

  it('returns string length for empty target', () => {
    expect(getLevenshteinDistance('abc', '')).toBe(3)
  })

  it('counts single substitution', () => {
    expect(getLevenshteinDistance('cat', 'bat')).toBe(1)
  })

  it('counts insertions and deletions', () => {
    expect(getLevenshteinDistance('kitten', 'sitting')).toBe(3)
  })
})

describe('getSimilarityScore', () => {
  it('returns 1 for identical strings', () => {
    expect(getSimilarityScore('abc', 'abc')).toBe(1)
  })

  it('returns 1 for two empty strings', () => {
    expect(getSimilarityScore('', '')).toBe(1)
  })

  it('returns 0 for completely different same-length strings', () => {
    expect(getSimilarityScore('abc', 'xyz')).toBe(0)
  })

  it('returns value between 0 and 1 for partial matches', () => {
    const score = getSimilarityScore('shakespeare', 'shakespear')
    expect(score).toBeGreaterThan(0.8)
    expect(score).toBeLessThan(1)
  })
})

describe('simpleStem', () => {
  it('stems -ies to -y', () => {
    expect(simpleStem('cities')).toBe('city')
  })

  it('stems -ves to -f', () => {
    expect(simpleStem('leaves')).toBe('leaf')
  })

  it('strips -es suffix', () => {
    expect(simpleStem('churches')).toBe('church')
  })

  it('strips trailing -s', () => {
    expect(simpleStem('cats')).toBe('cat')
  })

  it('does not stem short words', () => {
    expect(simpleStem('is')).toBe('is')
  })

  it('returns unchanged string if no suffix matches', () => {
    expect(simpleStem('python')).toBe('python')
  })
})

describe('answersMatch', () => {
  it('returns false for empty inputs', () => {
    expect(answersMatch('', 'france')).toBe(false)
    expect(answersMatch('france', '')).toBe(false)
  })

  it('matches identical normalized strings', () => {
    expect(answersMatch('france', 'france')).toBe(true)
  })

  it('matches when user answer contains correct answer (substring)', () => {
    expect(answersMatch('what is france', 'france')).toBe(true)
  })

  it('matches typos within fuzzy threshold', () => {
    expect(answersMatch('shakespear', 'shakespeare')).toBe(true)
  })

  it('rejects answers far below fuzzy threshold', () => {
    expect(answersMatch('python', 'shakespeare')).toBe(false)
  })

  it('matches plural vs singular via stemming', () => {
    expect(answersMatch('cats', 'cat')).toBe(true)
    expect(answersMatch('cat', 'cats')).toBe(true)
  })

  it('matches cities/city via -ies stem', () => {
    expect(answersMatch('cities', 'city')).toBe(true)
  })

  // Word-subset: correct answer words ⊆ user answer words
  // answersMatch receives pre-normalized inputs (normalization happens in checkAnswer).
  // "(Gerald Rudolph) Ford" normalizes to "ford"; user types "gerald ford" → "gerald ford".
  it('accepts "gerald ford" when correct normalizes to "ford" (parens stripped)', () => {
    expect(answersMatch('gerald ford', 'ford')).toBe(true)
  })

  // "George (Herbert Walker) Bush" normalizes to "george bush"; user types "george hw bush".
  it('accepts "george hw bush" when correct normalizes to "george bush"', () => {
    expect(answersMatch('george hw bush', 'george bush')).toBe(true)
  })

  // Positional initials: "c-section" normalizes to "c section"; correct "Caesarean Section" → "caesarean section".
  it('accepts "c section" for "caesarean section" via initial-letter matching', () => {
    expect(answersMatch('c section', 'caesarean section')).toBe(true)
  })
})

describe('isPartialMatch', () => {
  it('returns true when user answer is a subset of correct answer', () => {
    expect(isPartialMatch('new york', 'new york city')).toBe(true)
  })

  it('returns false when user answer equals correct answer', () => {
    expect(isPartialMatch('new york city', 'new york city')).toBe(false)
  })

  it('returns false when user answer is longer than correct', () => {
    expect(isPartialMatch('new york city state', 'new york city')).toBe(false)
  })

  it('returns false when user words are not all in correct answer', () => {
    expect(isPartialMatch('los angeles', 'new york city')).toBe(false)
  })
})

describe('placeDailyDoubles', () => {
  function makeBoard(cols = 6, cluesPerCol = 5) {
    return Array.from({ length: cols }, (_, ci) => ({
      category: `Cat ${ci}`,
      clues: Array.from({ length: cluesPerCol }, (_, ri) => ({
        id: ci * 100 + ri,
        value: (ri + 1) * 200,
        clue_text: 'clue',
        response_text: 'answer',
      })),
    }))
  }

  it('places 1 daily double for round 1', () => {
    const board = makeBoard()
    const dds = placeDailyDoubles(board, 1)
    expect(dds.size).toBe(1)
  })

  it('places 2 daily doubles for round 2', () => {
    const board = makeBoard()
    const dds = placeDailyDoubles(board, 2)
    expect(dds.size).toBe(2)
  })

  it('never places a daily double on the first clue of any category (idx 0)', () => {
    const board = makeBoard()
    const firstClueIds = new Set(board.map((col) => col.clues[0].id))
    for (let i = 0; i < 50; i++) {
      const dds = placeDailyDoubles(board, 2)
      for (const id of dds) {
        expect(firstClueIds.has(id)).toBe(false)
      }
    }
  })

  it('returns a Set of clue ids drawn from the board', () => {
    const board = makeBoard()
    const allIds = new Set(board.flatMap((col) => col.clues.map((c) => c.id)))
    const dds = placeDailyDoubles(board, 2)
    for (const id of dds) {
      expect(allIds.has(id)).toBe(true)
    }
  })
})
