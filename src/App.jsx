import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { fetchBoard, fetchCategories, fetchFinalJeopardy } from './utils/api'

const CLUE_TIME_LIMIT = 15
const FINAL_JEOPARDY_TIME_LIMIT = 30
const FUZZY_MATCH_THRESHOLD = 0.84

function normalizeAnswer(text) {
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

function formatScore(score) {
  return `${score < 0 ? '-' : ''}$${Math.abs(score).toLocaleString()}`
}

function getLevenshteinDistance(source, target) {
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

function getSimilarityScore(source, target) {
  if (!source && !target) return 1
  const longest = Math.max(source.length, target.length)
  if (longest === 0) return 1
  return 1 - getLevenshteinDistance(source, target) / longest
}

function answersMatch(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) return false
  if (userAnswer === correctAnswer) return true
  if (correctAnswer.length >= 6 && userAnswer.includes(correctAnswer)) return true
  return getSimilarityScore(userAnswer, correctAnswer) >= FUZZY_MATCH_THRESHOLD
}

// Pick `count` random clue IDs from non-lowest-value positions (indices > 0)
function placeDailyDoubles(board, count) {
  const eligible = []
  board.forEach((col) => {
    col.clues.forEach((clue, idx) => {
      if (idx > 0) eligible.push(clue.id)
    })
  })
  const shuffled = eligible.sort(() => Math.random() - 0.5)
  return new Set(shuffled.slice(0, count))
}

function App() {
  // Categories
  const [categories, setCategories] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // Game phase: LOBBY | ROUND_1 | ROUND_2 | FINAL_JEOPARDY | GAME_OVER
  const [gamePhase, setGamePhase] = useState('LOBBY')
  const [gameLoading, setGameLoading] = useState(false)
  const [gameError, setGameError] = useState(null)

  // Boards
  const [activeBoard, setActiveBoard] = useState([])
  const [round2Board, setRound2Board] = useState([])
  const [finalJeopardyData, setFinalJeopardyData] = useState(null)
  const [dailyDoubleIds, setDailyDoubleIds] = useState(new Set())

  // Daily Double wager pending (holds the full clue object)
  const [pendingWagerClue, setPendingWagerClue] = useState(null)
  const [wagerText, setWagerText] = useState('')

  // Active clue interaction
  const [activeClue, setActiveClue] = useState(null)
  const [activeWager, setActiveWager] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(CLUE_TIME_LIMIT)
  const [didTimeExpire, setDidTimeExpire] = useState(false)

  // Score & per-round stats
  const [score, setScore] = useState(0)
  const [roundStats, setRoundStats] = useState({ correct: 0, incorrect: 0, timedOut: 0 })
  const [round1Stats, setRound1Stats] = useState(null)
  const [round2Stats, setRound2Stats] = useState(null)
  const [finalJeopardyCorrect, setFinalJeopardyCorrect] = useState(null)

  // Final Jeopardy sub-phase: 'wager' | 'clue'
  const [finalSubPhase, setFinalSubPhase] = useState('wager')
  const [finalWagerText, setFinalWagerText] = useState('')

  const answerInputRef = useRef(null)
  const wagerInputRef = useRef(null)

  // Load categories on mount
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err))
  }, [])

  // Board completion
  const isBoardComplete = useMemo(
    () => activeBoard.length > 0 && activeBoard.every((col) => col.clues.every((c) => c.used)),
    [activeBoard]
  )

  // Timer
  useEffect(() => {
    if (!activeClue || isSubmitted || didTimeExpire) return

    if (timeRemaining <= 0) {
      setDidTimeExpire(true)
      const penalty = activeWager !== null ? activeWager : activeClue.value
      setScore((s) => s - penalty)
      setRoundStats((rs) => ({ ...rs, timedOut: rs.timedOut + 1 }))
      return
    }

    const id = window.setTimeout(() => setTimeRemaining((t) => t - 1), 1000)
    return () => window.clearTimeout(id)
  }, [activeClue, isSubmitted, didTimeExpire, timeRemaining, activeWager])

  // Focus answer input when clue opens
  useEffect(() => {
    if (activeClue && !isSubmitted && !didTimeExpire) {
      answerInputRef.current?.focus()
    }
  }, [activeClue, isSubmitted, didTimeExpire])

  // Focus wager input when wager modal opens
  useEffect(() => {
    if (pendingWagerClue || (gamePhase === 'FINAL_JEOPARDY' && finalSubPhase === 'wager')) {
      wagerInputRef.current?.focus()
    }
  }, [pendingWagerClue, gamePhase, finalSubPhase])

  function toggleTopic(id) {
    setSelectedTopics((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 6) return prev
      return [...prev, id]
    })
  }

  async function startGame() {
    setGameLoading(true)
    setGameError(null)
    setScore(0)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0 })
    setRound1Stats(null)
    setRound2Stats(null)
    setFinalJeopardyCorrect(null)
    setActiveClue(null)
    setActiveWager(null)
    setPendingWagerClue(null)

    try {
      const [r1, r2] = await Promise.all([
        fetchBoard(selectedTopics, 'Jeopardy!'),
        fetchBoard(selectedTopics, 'Double Jeopardy!'),
      ])

      let fj = null
      try {
        fj = await fetchFinalJeopardy()
      } catch {
        // Final Jeopardy unavailable — game will end after Round 2
      }

      setRound2Board(r2)
      setFinalJeopardyData(fj)
      setDailyDoubleIds(placeDailyDoubles(r1, 1))
      setActiveBoard(r1)
      setShowCategoryPicker(false)
      setGamePhase('ROUND_1')
    } catch (err) {
      setGameError('Could not load the game. Make sure the backend is running.')
      console.error(err)
    } finally {
      setGameLoading(false)
    }
  }

  function advanceToRound2() {
    setRound1Stats(roundStats)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0 })
    setDailyDoubleIds(placeDailyDoubles(round2Board, 2))
    setActiveBoard(round2Board)
    setGamePhase('ROUND_2')
  }

  function advanceToFinalJeopardy() {
    setRound2Stats(roundStats)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0 })

    if (!finalJeopardyData) {
      setGamePhase('GAME_OVER')
      return
    }

    setFinalSubPhase('wager')
    setFinalWagerText('')
    setActiveClue(null)
    setActiveWager(null)
    setGamePhase('FINAL_JEOPARDY')
  }

  function quitGame() {
    setGamePhase('LOBBY')
    setActiveBoard([])
    setRound2Board([])
    setFinalJeopardyData(null)
    setDailyDoubleIds(new Set())
    setActiveClue(null)
    setActiveWager(null)
    setPendingWagerClue(null)
    setScore(0)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0 })
    setRound1Stats(null)
    setRound2Stats(null)
  }

  function handleClueSelect(selectedClue) {
    if (selectedClue.used) return

    setActiveBoard((board) =>
      board.map((col) => ({
        ...col,
        clues: col.clues.map((c) => (c.id === selectedClue.id ? { ...c, used: true } : c)),
      }))
    )

    if (dailyDoubleIds.has(selectedClue.id)) {
      setPendingWagerClue(selectedClue)
      setWagerText('')
    } else {
      openClue(selectedClue, null)
    }
  }

  function openClue(clue, wager) {
    const timeLimit = gamePhase === 'FINAL_JEOPARDY' ? FINAL_JEOPARDY_TIME_LIMIT : CLUE_TIME_LIMIT
    setActiveClue(clue)
    setActiveWager(wager)
    setAnswerText('')
    setIsSubmitted(false)
    setIsCorrect(null)
    setTimeRemaining(timeLimit)
    setDidTimeExpire(false)
  }

  function handleWagerSubmit(event) {
    event.preventDefault()
    const amount = parseInt(wagerText, 10)
    if (!amount || amount < 5) return
    const maxWager = Math.max(score, pendingWagerClue.value)
    const clue = pendingWagerClue
    setPendingWagerClue(null)
    setWagerText('')
    openClue(clue, Math.min(amount, maxWager))
  }

  function handleSubmitAnswer(event) {
    event.preventDefault()
    if (!activeClue || !answerText.trim() || didTimeExpire) return

    const normalizedUser = normalizeAnswer(answerText)
    const normalizedCorrect = normalizeAnswer(activeClue.response)
    const correct = answersMatch(normalizedUser, normalizedCorrect)
    const delta = activeWager !== null ? activeWager : activeClue.value

    setIsCorrect(correct)
    setIsSubmitted(true)
    setScore((s) => (correct ? s + delta : s - delta))

    if (gamePhase === 'FINAL_JEOPARDY') {
      setFinalJeopardyCorrect(correct)
    } else {
      setRoundStats((rs) => ({
        ...rs,
        correct: correct ? rs.correct + 1 : rs.correct,
        incorrect: !correct ? rs.incorrect + 1 : rs.incorrect,
      }))
    }
  }

  function handleContinue() {
    if (gamePhase === 'FINAL_JEOPARDY') {
      setGamePhase('GAME_OVER')
    }
    setActiveClue(null)
    setActiveWager(null)
  }

  function handleFinalWagerSubmit(event) {
    event.preventDefault()
    const amount = parseInt(finalWagerText, 10)
    if (isNaN(amount) || amount < 0) return
    const capped = Math.min(amount, Math.max(score, 0))
    setFinalSubPhase('clue')

    const fjClue = {
      id: finalJeopardyData.clue.id,
      clue: finalJeopardyData.clue.clue_text,
      response: finalJeopardyData.clue.response_text,
      value: capped,
      category: finalJeopardyData.category,
    }
    openClue(fjClue, capped)
  }

  const showReveal = isSubmitted || didTimeExpire
  const atCategoryLimit = selectedTopics.length >= 6
  const activeDelta = activeWager !== null ? activeWager : (activeClue?.value ?? 0)

  return (
    <main className="app-shell">
      <div className="app-frame">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="app-header">
          <div>
            <p className="eyebrow">Quizzy Whiskers</p>
            <h1>Jeopardy practice, made cozy.</h1>
          </div>
          <div className="header-actions">
            {gamePhase !== 'LOBBY' && (
              <span className="round-badge">
                {gamePhase === 'ROUND_1' && 'Round 1 — Jeopardy!'}
                {gamePhase === 'ROUND_2' && 'Round 2 — Double Jeopardy!'}
                {gamePhase === 'FINAL_JEOPARDY' && 'Final Jeopardy!'}
                {gamePhase === 'GAME_OVER' && 'Game Over'}
              </span>
            )}
            <div className="score-chip">
              <span className="score-label">Score</span>
              <strong className="score-value">{formatScore(score)}</strong>
            </div>
            {gamePhase !== 'LOBBY' && gamePhase !== 'GAME_OVER' && (
              <button className="secondary-button" type="button" onClick={quitGame}>
                Quit
              </button>
            )}
          </div>
        </header>

        {/* ── LOBBY ──────────────────────────────────────────────────── */}
        {gamePhase === 'LOBBY' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <p className="hero-kicker">Study clues. Beat the clock.</p>
                <h2>Train with real archived clues in a simple Jeopardy-style format.</h2>
                <p className="hero-description">
                  Choose your categories, then play through all three rounds: Jeopardy!, Double
                  Jeopardy!, and Final Jeopardy!
                </p>
                <div className="hero-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={startGame}
                    disabled={gameLoading}
                  >
                    {gameLoading ? 'Loading game…' : 'Start New Game'}
                  </button>
                  <button
                    className="secondary-button lobby-picker-toggle"
                    type="button"
                    onClick={() => setShowCategoryPicker((v) => !v)}
                  >
                    {showCategoryPicker ? 'Hide categories' : 'Choose categories'}
                  </button>
                </div>
                {gameError && <p className="game-error">{gameError}</p>}
              </div>

              <div className="hero-card">
                <span className="card-label">Archive-backed</span>
                <h3>
                  {categories.length} topics ·{' '}
                  {categories.reduce((s, c) => s + (c.category_count || 0), 0).toLocaleString()} boards
                </h3>
                <p>Real Jeopardy archive data, quality-filtered and ready to play.</p>
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
                    onClick={startGame}
                    disabled={gameLoading}
                  >
                    {selectedTopics.length === 0 ? 'Start with random topics' : 'Start game'}
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
          </>
        )}

        {/* ── ROUND BOARD ─────────────────────────────────────────────── */}
        {(gamePhase === 'ROUND_1' || gamePhase === 'ROUND_2') && (
          isBoardComplete ? (
            <section className="panel panel-full round-complete-panel">
              <p className="panel-eyebrow">
                {gamePhase === 'ROUND_1' ? 'Round 1 Complete' : 'Round 2 Complete'}
              </p>
              <h2 className="round-complete-score">{formatScore(score)}</h2>
              <p className="round-complete-stats">
                {roundStats.correct} correct · {roundStats.incorrect} incorrect ·{' '}
                {roundStats.timedOut} timed out
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={gamePhase === 'ROUND_1' ? advanceToRound2 : advanceToFinalJeopardy}
              >
                {gamePhase === 'ROUND_1'
                  ? 'Start Round 2 — Double Jeopardy!'
                  : 'Go to Final Jeopardy!'}
              </button>
            </section>
          ) : (
            <section className="board-section panel panel-full">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">
                    {gamePhase === 'ROUND_1' ? 'Round 1 — Jeopardy!' : 'Round 2 — Double Jeopardy!'}
                  </p>
                  <h3>
                    {activeBoard.reduce(
                      (total, col) => total + col.clues.filter((c) => !c.used).length,
                      0
                    )}{' '}
                    clues remaining
                  </h3>
                </div>
              </div>

              <div className="game-board">
                {activeBoard.map((column) => (
                  <div key={column.category} className="board-column">
                    <div className="category-cell">{column.category}</div>
                    {column.clues.map((clue) => (
                      <button
                        key={clue.id}
                        className={`clue-cell ${clue.used ? 'clue-cell-used' : ''}`}
                        type="button"
                        onClick={() => handleClueSelect({ ...clue, category: column.category })}
                        disabled={clue.used}
                      >
                        {clue.used ? '—' : `$${clue.value.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )
        )}

        {/* ── FINAL JEOPARDY — WAGER ──────────────────────────────────── */}
        {gamePhase === 'FINAL_JEOPARDY' && finalSubPhase === 'wager' && finalJeopardyData && (
          <section className="panel panel-full final-jeopardy-panel">
            <p className="panel-eyebrow">Final Jeopardy!</p>
            <div className="fj-category">{finalJeopardyData.category}</div>
            <p className="fj-description">
              The category has been revealed. Enter your wager before the clue appears.
            </p>
            <p className="fj-balance">Current score: {formatScore(score)}</p>
            <form className="fj-wager-form" onSubmit={handleFinalWagerSubmit}>
              <div className="clue-modal-input-row fj-wager-row">
                <span className="answer-prefix">Wager $</span>
                <input
                  ref={wagerInputRef}
                  className="clue-modal-input"
                  type="number"
                  min="0"
                  max={Math.max(score, 0)}
                  value={finalWagerText}
                  onChange={(e) => setFinalWagerText(e.target.value)}
                  placeholder="amount"
                  autoComplete="off"
                />
              </div>
              <button
                className="clue-modal-submit"
                type="submit"
                disabled={finalWagerText === '' || parseInt(finalWagerText, 10) < 0}
              >
                Lock in wager
              </button>
            </form>
          </section>
        )}

        {/* ── GAME OVER ───────────────────────────────────────────────── */}
        {gamePhase === 'GAME_OVER' && (
          <section className="panel panel-full game-over-panel">
            <p className="panel-eyebrow">Game Complete</p>
            <div className="game-over-score">{formatScore(score)}</div>
            <p className="game-over-label">Final Score</p>

            <div className="game-over-breakdown">
              {round1Stats && (
                <div className="round-stat-row">
                  <span className="round-stat-label">Round 1</span>
                  <span className="round-stat-detail">
                    {round1Stats.correct} correct · {round1Stats.incorrect} wrong ·{' '}
                    {round1Stats.timedOut} timed out
                  </span>
                </div>
              )}
              {round2Stats && (
                <div className="round-stat-row">
                  <span className="round-stat-label">Round 2</span>
                  <span className="round-stat-detail">
                    {round2Stats.correct} correct · {round2Stats.incorrect} wrong ·{' '}
                    {round2Stats.timedOut} timed out
                  </span>
                </div>
              )}
              {finalJeopardyCorrect !== null && (
                <div className="round-stat-row">
                  <span className="round-stat-label">Final Jeopardy</span>
                  <span className="round-stat-detail">
                    {finalJeopardyCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
              )}
            </div>

            <button className="primary-button" type="button" onClick={quitGame}>
              Play Again
            </button>
          </section>
        )}
      </div>

      {/* ── DAILY DOUBLE WAGER MODAL ─────────────────────────────────── */}
      {pendingWagerClue && (
        <div className="clue-modal-overlay">
          <div className="clue-modal">
            <div className="clue-modal-meta">
              <span className="clue-modal-category">{pendingWagerClue.category}</span>
              <span className="dd-badge">Daily Double!</span>
            </div>
            <div className="clue-modal-value">${pendingWagerClue.value.toLocaleString()}</div>
            <p className="clue-modal-text dd-wager-prompt">
              Enter your wager. Min $5 · Max $
              {Math.max(score, pendingWagerClue.value).toLocaleString()}
            </p>
            <form className="clue-modal-form" onSubmit={handleWagerSubmit}>
              <div className="clue-modal-input-row">
                <span className="answer-prefix">Wager $</span>
                <input
                  ref={wagerInputRef}
                  className="clue-modal-input"
                  type="number"
                  min="5"
                  max={Math.max(score, pendingWagerClue.value)}
                  value={wagerText}
                  onChange={(e) => setWagerText(e.target.value)}
                  placeholder="amount"
                  autoComplete="off"
                />
              </div>
              <button
                className="clue-modal-submit"
                type="submit"
                disabled={!wagerText || parseInt(wagerText, 10) < 5}
              >
                Lock in wager
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── CLUE MODAL ──────────────────────────────────────────────── */}
      {activeClue && (
        <div className="clue-modal-overlay">
          <div className="clue-modal">
            <div className="clue-modal-meta">
              <span className="clue-modal-category">{activeClue.category}</span>
              <div className={`timer-badge ${timeRemaining <= 3 ? 'timer-warning' : ''}`}>
                {didTimeExpire ? "Time's up" : `${timeRemaining}s`}
              </div>
            </div>

            {activeWager !== null ? (
              <div className="clue-modal-value wager-value">
                <span className="wager-label">Wagered</span>
                ${activeWager.toLocaleString()}
              </div>
            ) : (
              <div className="clue-modal-value">${activeClue.value.toLocaleString()}</div>
            )}

            <p className="clue-modal-text">{activeClue.clue}</p>

            {!showReveal ? (
              <form className="clue-modal-form" onSubmit={handleSubmitAnswer}>
                <div className="clue-modal-input-row">
                  <span className="answer-prefix">What is</span>
                  <input
                    ref={answerInputRef}
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
                      ? `−$${activeDelta.toLocaleString()} for timeout`
                      : isCorrect
                        ? `+$${activeDelta.toLocaleString()} earned`
                        : `−$${activeDelta.toLocaleString()} deducted`}
                  </span>
                </div>

                <div className="clue-modal-answer">
                  <span className="clue-modal-answer-label">Correct response</span>
                  <strong>What is {activeClue.response}?</strong>
                </div>

                <button className="clue-modal-continue" type="button" onClick={handleContinue}>
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
