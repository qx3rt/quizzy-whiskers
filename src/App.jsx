import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  fetchBoard,
  fetchCategories,
  fetchFinalJeopardy,
  login,
  register,
  fetchMe,
  saveGame,
  fetchGameHistory,
  fetchAllAchievements,
  fetchMyAchievements,
} from './utils/api'
import {
  normalizeAnswer,
  answersMatch,
  isPartialMatch,
  placeDailyDoubles,
} from './utils/answerEval'

const CLUE_TIME_LIMIT = 20
const FINAL_JEOPARDY_TIME_LIMIT = 30
const MORE_SPECIFIC_TIME_LIMIT = 20

function formatScore(score) {
  return `${score < 0 ? '-' : ''}$${Math.abs(score).toLocaleString()}`
}

function formatMemberSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''} ago`
}

const ACHIEVEMENT_ICONS = {
  first_game: '🎯',
  ten_games: '🔟',
  fifty_games: '🏆',
  century_club: '💯',
  perfect_round: '✨',
  perfect_game: '🏅',
  no_timeouts: '⚡',
  double_dominator: '💰',
  final_jeopardy_winner: '🎤',
  fj_regular: '🌟',
  high_roller: '💵',
  grand_champion: '👑',
  answer_machine: '🧠',
}

function App() {
  // ── Categories ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // ── Game phase: LOBBY | ROUND_1 | ROUND_2 | FINAL_JEOPARDY | GAME_OVER ─────
  const [gamePhase, setGamePhase] = useState('LOBBY')
  const [gameLoading, setGameLoading] = useState(false)
  const [gameError, setGameError] = useState(null)

  // ── Boards ──────────────────────────────────────────────────────────────────
  const [activeBoard, setActiveBoard] = useState([])
  const [round2Board, setRound2Board] = useState([])
  const [finalJeopardyData, setFinalJeopardyData] = useState(null)
  const [dailyDoubleIds, setDailyDoubleIds] = useState(new Set())

  // ── Daily Double wager pending ──────────────────────────────────────────────
  const [pendingWagerClue, setPendingWagerClue] = useState(null)
  const [wagerText, setWagerText] = useState('')

  // ── Active clue interaction ─────────────────────────────────────────────────
  const [activeClue, setActiveClue] = useState(null)
  const [activeWager, setActiveWager] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(CLUE_TIME_LIMIT)
  const [didTimeExpire, setDidTimeExpire] = useState(false)
  const [needsMoreSpecific, setNeedsMoreSpecific] = useState(false)
  const [moreSpecificText, setMoreSpecificText] = useState('')
  const [moreSpecificTimeRemaining, setMoreSpecificTimeRemaining] = useState(MORE_SPECIFIC_TIME_LIMIT)

  // ── Score & per-round stats ─────────────────────────────────────────────────
  const [score, setScore] = useState(0)
  const [roundStats, setRoundStats] = useState({ correct: 0, incorrect: 0, timedOut: 0 })
  const [round1Stats, setRound1Stats] = useState(null)
  const [round2Stats, setRound2Stats] = useState(null)
  const [finalJeopardyCorrect, setFinalJeopardyCorrect] = useState(null)

  // ── Final Jeopardy sub-phase: 'wager' | 'clue' ─────────────────────────────
  const [finalSubPhase, setFinalSubPhase] = useState('wager')
  const [finalWagerText, setFinalWagerText] = useState('')

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('qw_token'))
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authTab, setAuthTab] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authDisplayName, setAuthDisplayName] = useState('')
  const [authError, setAuthError] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)

  // ── Game history & achievements ─────────────────────────────────────────────
  const [gameHistory, setGameHistory] = useState(null)
  const [newAchievements, setNewAchievements] = useState([])
  const [allAchievements, setAllAchievements] = useState([])
  const [achievementDefs, setAchievementDefs] = useState([])

  const answerInputRef = useRef(null)
  const moreSpecificInputRef = useRef(null)
  const wagerInputRef = useRef(null)
  const gameSavedRef = useRef(false)

  // ── Load categories on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err))
  }, [])

  // ── Validate stored token on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!authToken) return
    fetchMe(authToken)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('qw_token')
        setAuthToken(null)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save game when entering GAME_OVER (logged-in users) ────────────────
  useEffect(() => {
    if (gamePhase !== 'GAME_OVER' || !user || !authToken || gameSavedRef.current) return
    gameSavedRef.current = true

    saveGame(authToken, {
      finalScore: score,
      topics: selectedTopics,
      round1Correct: round1Stats?.correct ?? 0,
      round1Incorrect: round1Stats?.incorrect ?? 0,
      round1TimedOut: round1Stats?.timedOut ?? 0,
      round2Correct: round2Stats?.correct ?? 0,
      round2Incorrect: round2Stats?.incorrect ?? 0,
      round2TimedOut: round2Stats?.timedOut ?? 0,
      finalJeopardyCorrect: finalJeopardyCorrect,
    })
      .then(({ newAchievements: earned }) => {
        if (earned?.length > 0) setNewAchievements(earned)
        return fetchGameHistory(authToken)
      })
      .then(setGameHistory)
      .catch(console.error)
  }, [gamePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-dismiss achievement toasts ─────────────────────────────────────────
  useEffect(() => {
    if (newAchievements.length === 0) return
    const id = window.setTimeout(() => setNewAchievements([]), 6000)
    return () => window.clearTimeout(id)
  }, [newAchievements])

  // ── Fetch profile data when viewing profile ──────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'PROFILE' || !authToken) return
    Promise.all([
      fetchMe(authToken).then(setUser),
      fetchAllAchievements().then(setAchievementDefs),
      fetchMyAchievements(authToken).then(setAllAchievements),
      fetchGameHistory(authToken).then(setGameHistory),
    ]).catch(console.error)
  }, [gamePhase, authToken])

  // ── Board completion ────────────────────────────────────────────────────────
  const isBoardComplete = useMemo(
    () => activeBoard.length > 0 && activeBoard.every((col) => col.clues.every((c) => c.used)),
    [activeBoard]
  )

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeClue || isSubmitted || didTimeExpire || needsMoreSpecific) return

    if (timeRemaining <= 0) {
      setDidTimeExpire(true)
      if (!isSubmitted) {
        // Timed out without submission: track but don't deduct
        setRoundStats((rs) => ({ ...rs, timedOut: rs.timedOut + 1 }))
      } else {
        // Already submitted wrong answer before timeout — penalty already applied
        // (No additional action needed; wrong answer penalty happened on submit)
      }
      return
    }

    const id = window.setTimeout(() => setTimeRemaining((t) => t - 1), 1000)
    return () => window.clearTimeout(id)
  }, [activeClue, isSubmitted, didTimeExpire, needsMoreSpecific, timeRemaining])

  // ── "Be more specific" timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!needsMoreSpecific) return

    if (moreSpecificTimeRemaining <= 0) {
      const delta = activeWager !== null ? activeWager : (activeClue?.value ?? 0)
      setIsCorrect(false)
      setIsSubmitted(true)
      setScore((s) => s - delta)
      setNeedsMoreSpecific(false)
      if (gamePhase === 'FINAL_JEOPARDY') {
        setFinalJeopardyCorrect(false)
      } else {
        setRoundStats((rs) => ({ ...rs, incorrect: rs.incorrect + 1 }))
      }
      return
    }

    const id = window.setTimeout(() => setMoreSpecificTimeRemaining((t) => t - 1), 1000)
    return () => window.clearTimeout(id)
  }, [needsMoreSpecific, moreSpecificTimeRemaining]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus helpers ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeClue && !isSubmitted && !didTimeExpire && !needsMoreSpecific) {
      answerInputRef.current?.focus()
    }
  }, [activeClue, isSubmitted, didTimeExpire, needsMoreSpecific])

  useEffect(() => {
    if (needsMoreSpecific) {
      moreSpecificInputRef.current?.focus()
    }
  }, [needsMoreSpecific])

  useEffect(() => {
    if (pendingWagerClue || (gamePhase === 'FINAL_JEOPARDY' && finalSubPhase === 'wager')) {
      wagerInputRef.current?.focus()
    }
  }, [pendingWagerClue, gamePhase, finalSubPhase])

  // ── Auth handlers ───────────────────────────────────────────────────────────
  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    try {
      const result =
        authTab === 'login'
          ? await login(authEmail, authPassword)
          : await register(authEmail, authPassword, authDisplayName)

      localStorage.setItem('qw_token', result.token)
      setAuthToken(result.token)
      setUser(result.user)
      setShowAuthModal(false)
      setAuthEmail('')
      setAuthPassword('')
      setAuthDisplayName('')
    } catch (err) {
      const msg = err.message
      if (msg.includes('409')) setAuthError('Email already registered.')
      else if (msg.includes('401')) setAuthError('Invalid email or password.')
      else if (msg.includes('400')) setAuthError('Please check your inputs.')
      else setAuthError('Something went wrong. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleSignOut() {
    localStorage.removeItem('qw_token')
    setAuthToken(null)
    setUser(null)
    setGameHistory(null)
  }

  function switchAuthTab(tab) {
    setAuthTab(tab)
    setAuthError(null)
  }

  // ── Topic selection ─────────────────────────────────────────────────────────
  function toggleTopic(id) {
    setSelectedTopics((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= 6) return prev
      return [...prev, id]
    })
  }

  // ── Game lifecycle ──────────────────────────────────────────────────────────
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
    setNewAchievements([])
    setGameHistory(null)
    gameSavedRef.current = false

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
    gameSavedRef.current = false
  }

  // ── Clue selection & wager ──────────────────────────────────────────────────
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
    setNeedsMoreSpecific(false)
    setMoreSpecificText('')
    setMoreSpecificTimeRemaining(MORE_SPECIFIC_TIME_LIMIT)
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

  // ── Answer submission ───────────────────────────────────────────────────────
  function handleSubmitAnswer(event) {
    event.preventDefault()
    if (!activeClue || !answerText.trim() || didTimeExpire) return

    const normalizedUser = normalizeAnswer(answerText)
    const normalizedCorrect = normalizeAnswer(activeClue.response)
    const correct = answersMatch(normalizedUser, normalizedCorrect)

    if (!correct && isPartialMatch(normalizedUser, normalizedCorrect)) {
      setNeedsMoreSpecific(true)
      setMoreSpecificTimeRemaining(MORE_SPECIFIC_TIME_LIMIT)
      return
    }

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

  function handleSubmitMoreSpecific(event) {
    event.preventDefault()
    if (!moreSpecificText.trim()) return

    const normalizedUser = normalizeAnswer(moreSpecificText)
    const normalizedCorrect = normalizeAnswer(activeClue.response)
    const correct = answersMatch(normalizedUser, normalizedCorrect)
    const delta = activeWager !== null ? activeWager : activeClue.value

    setIsCorrect(correct)
    setIsSubmitted(true)
    setScore((s) => (correct ? s + delta : s - delta))
    setNeedsMoreSpecific(false)

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

  // ── Final Jeopardy wager ────────────────────────────────────────────────────
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

  // ── Derived values ──────────────────────────────────────────────────────────
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
            {gamePhase !== 'LOBBY' && gamePhase !== 'PROFILE' && (
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
            {user ? (
              <div className="profile-chip">
                <span className="profile-name" onClick={() => setGamePhase('PROFILE')}>{user.displayName || user.email.split('@')[0]}</span>
                <button className="profile-signout" type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            ) : (
              <button
                className="secondary-button"
                type="button"
                onClick={() => { setShowAuthModal(true); setAuthTab('login') }}
              >
                Sign in
              </button>
            )}
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

            {gameHistory && (
              <div className="game-history">
                <p className="history-heading">Your record</p>
                <div className="history-stats">
                  <div className="history-stat">
                    <span className="history-stat-value">{gameHistory.totalGames}</span>
                    <span className="history-stat-label">Games played</span>
                  </div>
                  <div className="history-stat">
                    <span className="history-stat-value">{formatScore(gameHistory.bestScore)}</span>
                    <span className="history-stat-label">Best score</span>
                  </div>
                  <div className="history-stat">
                    <span className="history-stat-value">{formatScore(gameHistory.avgScore)}</span>
                    <span className="history-stat-label">Avg score</span>
                  </div>
                </div>
              </div>
            )}

            {!user && (
              <p className="game-over-sign-in-prompt">
                <button
                  className="inline-text-button"
                  type="button"
                  onClick={() => { setShowAuthModal(true); setAuthTab('register') }}
                >
                  Create a free account
                </button>{' '}
                to track your scores and earn achievements.
              </p>
            )}

            <button className="primary-button" type="button" onClick={quitGame}>
              Play Again
            </button>
          </section>
        )}

        {/* ── PROFILE ────────────────────────────────────────────────────── */}
        {gamePhase === 'PROFILE' && user && (
          <section className="panel panel-full profile-panel">

            {/* Identity */}
            <div className="profile-identity">
              <div className="profile-avatar">
                {(user.displayName || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="profile-meta">
                <h2>{user.displayName || user.email.split('@')[0]}</h2>
                <p className="profile-email">{user.email}</p>
                {user.memberSince && (
                  <p className="profile-member-since">Member since {formatMemberSince(user.memberSince)}</p>
                )}
              </div>
              <button className="secondary-button profile-signout-btn" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>

            {/* Lifetime stats */}
            {(() => {
              const ls = gameHistory?.lifetimeStats
              const accuracy = ls?.totalAnswered > 0
                ? Math.round((ls.totalCorrect / ls.totalAnswered) * 100)
                : null
              const fjRate = ls?.totalGames > 0
                ? Math.round((ls.finalJeopardyWins / ls.totalGames) * 100)
                : null
              return (
                <div className="profile-stats-bar">
                  <div className="stat-card">
                    <div className="stat-value">{ls?.totalGames ?? 0}</div>
                    <div className="stat-label">Games Played</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{ls?.bestScore ? `$${ls.bestScore.toLocaleString()}` : '—'}</div>
                    <div className="stat-label">Best Score</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{accuracy !== null ? `${accuracy}%` : '—'}</div>
                    <div className="stat-label">Accuracy</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{fjRate !== null ? `${fjRate}%` : '—'}</div>
                    <div className="stat-label">FJ Win Rate</div>
                  </div>
                </div>
              )
            })()}

            {/* Achievements */}
            {(() => {
              const earned = new Map(allAchievements.map((a) => [a.slug, a.earned_at]))
              const merged = achievementDefs.map((def) => ({
                ...def,
                earned_at: earned.get(def.slug) || null,
              }))
              const earnedCount = merged.filter((a) => a.earned_at).length
              return (
                <div className="profile-section">
                  <h3>Achievements <span className="achievement-count">{earnedCount}/{merged.length}</span></h3>
                  <div className="profile-achievements">
                    {merged.map((ach) => (
                      <div key={ach.slug} className={`achievement-card${ach.earned_at ? ' earned' : ''}`}>
                        <div className="achievement-icon">{ACHIEVEMENT_ICONS[ach.slug] || '🎖️'}</div>
                        <div className="achievement-content">
                          <div className="achievement-name">{ach.name}</div>
                          <div className="achievement-desc">{ach.description}</div>
                          {ach.earned_at ? (
                            <div className="achievement-earned">Earned {timeAgo(ach.earned_at)}</div>
                          ) : (
                            <div className="achievement-locked-label">Locked</div>
                          )}
                        </div>
                        {!ach.earned_at && <div className="achievement-lock-icon">🔒</div>}
                      </div>
                    ))}
                    {merged.length === 0 && (
                      <p className="no-achievements">Complete games to earn achievements!</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Recent game history */}
            {gameHistory?.games?.length > 0 && (
              <div className="profile-section">
                <h3>Recent Games</h3>
                <div className="game-history-list">
                  {gameHistory.games.slice(0, 10).map((game) => {
                    const date = new Date(game.played_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                    const topics = game.topics ? game.topics.split(',').filter(Boolean) : []
                    const fjResult = game.final_jeopardy_correct === 1 ? '✓' : game.final_jeopardy_correct === 0 ? '✗' : '—'
                    return (
                      <div key={game.id} className="game-history-row">
                        <div className="game-history-main">
                          <span className="game-history-date">{date}</span>
                          {topics.length > 0 && (
                            <div className="game-history-topics">
                              {topics.map((t) => (
                                <span key={t} className="game-history-topic-pill">{t}</span>
                              ))}
                            </div>
                          )}
                          <div className="game-history-breakdown">
                            R1 {game.round1_correct}✓ {game.round1_incorrect}✗
                            &nbsp;·&nbsp;
                            R2 {game.round2_correct}✓ {game.round2_incorrect}✗
                            &nbsp;·&nbsp;
                            FJ {fjResult}
                          </div>
                        </div>
                        <div className="game-history-score">{formatScore(game.final_score)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button className="secondary-button" type="button" onClick={() => setGamePhase('LOBBY')}>
              ← Back to Lobby
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
              Enter your wager. Min $5 · Max ${Math.max(score, pendingWagerClue.value).toLocaleString()}
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
              <div className={`timer-badge ${
                needsMoreSpecific
                  ? moreSpecificTimeRemaining <= 3 ? 'timer-warning' : ''
                  : timeRemaining <= 3 ? 'timer-warning' : ''
              }`}>
                {needsMoreSpecific
                  ? `${moreSpecificTimeRemaining}s`
                  : didTimeExpire ? "Time's up" : `${timeRemaining}s`}
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

            {needsMoreSpecific ? (
              <div className="clue-modal-specific">
                <p className="specific-prompt">Can you be more specific?</p>
                <form className="clue-modal-form" onSubmit={handleSubmitMoreSpecific}>
                  <div className="clue-modal-input-row">
                    <span className="answer-prefix">What is</span>
                    <input
                      ref={moreSpecificInputRef}
                      className="clue-modal-input"
                      type="text"
                      value={moreSpecificText}
                      onChange={(e) => setMoreSpecificText(e.target.value)}
                      placeholder="be more specific…"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    className="clue-modal-submit"
                    type="submit"
                    disabled={!moreSpecificText.trim()}
                  >
                    Submit response
                  </button>
                </form>
              </div>
            ) : !showReveal ? (
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
                <p className="clue-modal-hint">Letting the timer run out won&rsquo;t affect your score.</p>
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
                    {didTimeExpire && !isSubmitted
                      ? ''
                      : didTimeExpire
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

      {/* ── AUTH MODAL ──────────────────────────────────────────────── */}
      {showAuthModal && (
        <div
          className="clue-modal-overlay"
          onClick={() => setShowAuthModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="auth-modal-close"
              type="button"
              onClick={() => setShowAuthModal(false)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="auth-tabs">
              <button
                className={`auth-tab ${authTab === 'login' ? 'auth-tab-active' : ''}`}
                type="button"
                onClick={() => switchAuthTab('login')}
              >
                Sign in
              </button>
              <button
                className={`auth-tab ${authTab === 'register' ? 'auth-tab-active' : ''}`}
                type="button"
                onClick={() => switchAuthTab('register')}
              >
                Create account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authTab === 'register' && (
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Display name (optional)"
                  value={authDisplayName}
                  onChange={(e) => setAuthDisplayName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <input
                className="auth-input"
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Password (min 6 characters)"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
              />
              {authError && <p className="auth-error">{authError}</p>}
              <button className="clue-modal-submit" type="submit" disabled={authLoading}>
                {authLoading
                  ? 'Loading…'
                  : authTab === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── ACHIEVEMENT TOASTS ──────────────────────────────────────── */}
      {newAchievements.length > 0 && (
        <div className="achievement-toasts">
          {newAchievements.map((ach) => (
            <div key={ach.slug} className="achievement-toast">
              <span className="achievement-toast-icon">★</span>
              <div>
                <p className="achievement-toast-name">{ach.name}</p>
                <p className="achievement-toast-desc">{ach.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default App
