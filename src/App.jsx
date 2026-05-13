import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { fetchBoard, fetchCategories } from './utils/api'

const CLUE_TIME_LIMIT = 10
const FUZZY_MATCH_THRESHOLD = 0.84

function normalizeAnswer(text) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatScore(score) {
  return `${score < 0 ? '-' : ''}$${Math.abs(score)}`
}

function getLevenshteinDistance(source, target) {
  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = source[row - 1] === target[col - 1] ? 0 : 1

      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      )
    }
  }

  return matrix[source.length][target.length]
}

function getSimilarityScore(source, target) {
  if (!source && !target) {
    return 1
  }

  const longestLength = Math.max(source.length, target.length)

  if (longestLength === 0) {
    return 1
  }

  const distance = getLevenshteinDistance(source, target)
  return 1 - distance / longestLength
}

function answersMatch(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) {
    return false
  }

  if (userAnswer === correctAnswer) {
    return true
  }

  if (
    correctAnswer.includes(userAnswer) ||
    userAnswer.includes(correctAnswer)
  ) {
    return true
  }

  const similarityScore = getSimilarityScore(userAnswer, correctAnswer)
  return similarityScore >= FUZZY_MATCH_THRESHOLD
}

function App() {
  const [boardData, setBoardData] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [boardLoading, setBoardLoading] = useState(true)
  const [boardError, setBoardError] = useState(null)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const [activeClue, setActiveClue] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(CLUE_TIME_LIMIT)
  const [didTimeExpire, setDidTimeExpire] = useState(false)
  const [score, setScore] = useState(0)
  const answerInputRef = useRef(null)

  const loadBoard = useCallback(async (categoryIds = []) => {
    setBoardLoading(true)
    setBoardError(null)
    setActiveClue(null)
    setAnswerText('')
    setIsSubmitted(false)
    setIsCorrect(null)
    setScore(0)
    try {
      const data = await fetchBoard(categoryIds)  // categoryIds is now topic slugs
      setBoardData(data)
    } catch (err) {
      setBoardError('Could not load board. Make sure the backend is running.')
      console.error(err)
    } finally {
      setBoardLoading(false)
    }
  }, [])

  // Load categories list + initial board on mount
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err))
    loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (activeClue && !isSubmitted && !didTimeExpire) {
      answerInputRef.current?.focus()
    }
  }, [activeClue, isSubmitted, didTimeExpire])

  useEffect(() => {
    if (!activeClue || isSubmitted || didTimeExpire) {
      return
    }

    if (timeRemaining <= 0) {
      setDidTimeExpire(true)
      setScore((currentScore) => currentScore - activeClue.value)
      return
    }

    const timerId = window.setTimeout(() => {
      setTimeRemaining((currentTime) => currentTime - 1)
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [activeClue, isSubmitted, didTimeExpire, timeRemaining])

  function toggleTopic(id) {
    setSelectedTopics((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 6) return prev
      return [...prev, id]
    })
  }

  function handleStartBoard() {
    setShowCategoryPicker(false)
    loadBoard(selectedTopics)
  }

  function handleClueSelect(selectedClue) {
    if (selectedClue.used) {
      return
    }

    setActiveClue(selectedClue)
    setAnswerText('')
    setIsSubmitted(false)
    setIsCorrect(null)
    setTimeRemaining(CLUE_TIME_LIMIT)
    setDidTimeExpire(false)

    setBoardData((currentBoard) =>
      currentBoard.map((column) => ({
        ...column,
        clues: column.clues.map((clue) =>
          clue.id === selectedClue.id ? { ...clue, used: true } : clue
        ),
      }))
    )
  }

  function handleSubmitAnswer(event) {
    event.preventDefault()

    if (!activeClue || !answerText.trim() || didTimeExpire) {
      return
    }

    const normalizedUserAnswer = normalizeAnswer(answerText)
    const normalizedCorrectAnswer = normalizeAnswer(activeClue.response)
    const answerMatches = answersMatch(
      normalizedUserAnswer,
      normalizedCorrectAnswer
    )

    setIsCorrect(answerMatches)
    setIsSubmitted(true)
    setScore((currentScore) =>
      answerMatches
        ? currentScore + activeClue.value
        : currentScore - activeClue.value
    )
  }

  const showReveal = isSubmitted || didTimeExpire
  const atCategoryLimit = selectedTopics.length >= 6

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <div>
            <p className="eyebrow">Quizzy Whiskers</p>
            <h1>Jeopardy practice, made cozy.</h1>
          </div>

          <div className="header-actions">
            <div className="score-chip">
              <span className="score-label">Score</span>
              <strong className="score-value">{formatScore(score)}</strong>
            </div>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="hero-kicker">Study clues. Beat the clock.</p>
            <h2>Train with real archived clues in a simple Jeopardy-style format.</h2>
            <p className="hero-description">
              Pick your categories, start a board, and beat the clock on every clue.
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={() => setShowCategoryPicker((v) => !v)}
            >
              {showCategoryPicker ? 'Hide category picker' : 'Choose categories'}
            </button>
          </div>

          <div className="hero-card">
            <span className="card-label">Archive-backed</span>
            <h3>{categories.length} topics · {categories.reduce((sum, c) => sum + (c.category_count || 0), 0).toLocaleString()} boards</h3>
            <p>
              Real Jeopardy archive data, quality-filtered and ready to play.
            </p>
          </div>
        </section>

        {showCategoryPicker && (
          <section className="panel panel-full category-picker">
            <div className="panel-header">
              <div>
                <p className="panel-eyebrow">Category picker</p>
                <h3>Choose up to 6 categories</h3>
              </div>
              <span className="panel-tag">
                {selectedTopics.length === 0
                  ? 'Random'
                  : `${selectedTopics.length} / 6 selected`}
              </span>
            </div>

            <div className="category-picker-grid">
              {categories.map((cat) => {
                const isSelected = selectedTopics.includes(cat.id)
                const isDisabled = !isSelected && atCategoryLimit
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-chip ${isSelected ? 'category-chip-selected' : ''} ${isDisabled ? 'category-chip-disabled' : ''}`}
                    onClick={() => toggleTopic(cat.id)}
                    disabled={isDisabled}
                  >
                    <strong>{cat.name}</strong>
                    <span>{cat.category_count} boards</span>
                  </button>
                )
              })}
            </div>

            <div className="category-picker-actions">
              <button
                className="primary-button"
                type="button"
                onClick={handleStartBoard}
              >
                {selectedTopics.length === 0 ? 'Start with random topics' : 'Start board'}
              </button>
              {selectedTopics.length > 0 && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setSelectedTopics([])}
                >
                  Clear selection
                </button>
              )}
            </div>
          </section>
        )}

        <section className="board-section panel panel-full">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Game board</p>
              <h3>Practice board</h3>
            </div>
            <button
              className="panel-tag panel-tag-button"
              type="button"
              onClick={() => loadBoard(selectedTopics)}
              disabled={boardLoading}
            >
              {boardLoading ? 'Loading…' : 'New board'}
            </button>
          </div>

          {boardError && (
            <div className="board-error">
              <p>{boardError}</p>
            </div>
          )}

          {boardLoading ? (
            <div className="board-loading">
              <p>Loading board…</p>
            </div>
          ) : (
            <div className="game-board">
              {boardData.map((column) => (
                <div key={column.category} className="board-column">
                  <div className="category-cell">{column.category}</div>

                  {column.clues.map((clue) => (
                    <button
                      key={clue.id}
                      className={`clue-cell ${clue.used ? 'clue-cell-used' : ''}`}
                      type="button"
                      onClick={() => handleClueSelect(clue)}
                      disabled={clue.used}
                    >
                      {clue.used ? '—' : `$${clue.value}`}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {activeClue && (
        <div className="clue-modal-overlay">
          <div className="clue-modal">
            <div className="clue-modal-meta">
              <span className="clue-modal-category">{activeClue.category}</span>
              <div
                className={`timer-badge ${timeRemaining <= 3 ? 'timer-warning' : ''}`}
              >
                {didTimeExpire ? "Time's up" : `${timeRemaining}s`}
              </div>
            </div>

            <div className="clue-modal-value">${activeClue.value}</div>

            <p className="clue-modal-text">{activeClue.clue}</p>

            {!showReveal ? (
              <form className="clue-modal-form" onSubmit={handleSubmitAnswer}>
                <div className="clue-modal-input-row">
                  <span className="answer-prefix">What is</span>
                  <input
                    ref={answerInputRef}
                    id="answer-input"
                    className="clue-modal-input"
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="type your answer…"
                    disabled={isSubmitted || didTimeExpire}
                    autoComplete="off"
                  />
                </div>
                <button
                  className="clue-modal-submit"
                  type="submit"
                  disabled={!answerText.trim() || isSubmitted || didTimeExpire}
                >
                  Submit response
                </button>
              </form>
            ) : (
              <div className="clue-modal-result">
                <div
                  className={`clue-modal-verdict ${
                    didTimeExpire
                      ? 'verdict-time'
                      : isCorrect
                        ? 'verdict-correct'
                        : 'verdict-incorrect'
                  }`}
                >
                  <span className="verdict-label">
                    {didTimeExpire ? "Time's up" : isCorrect ? 'Correct!' : 'Incorrect'}
                  </span>
                  <span className="verdict-delta">
                    {didTimeExpire
                      ? `−$${activeClue.value} for timeout`
                      : isCorrect
                        ? `+$${activeClue.value} earned`
                        : `−$${activeClue.value} deducted`}
                  </span>
                </div>

                <div className="clue-modal-answer">
                  <span className="clue-modal-answer-label">Correct response</span>
                  <strong>What is {activeClue.response}?</strong>
                </div>

                <button
                  className="clue-modal-continue"
                  type="button"
                  onClick={() => setActiveClue(null)}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default App