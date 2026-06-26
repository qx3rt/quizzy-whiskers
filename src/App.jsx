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
  signOutAll,
  saveToken,
  loadToken,
  clearToken,
} from './utils/api'
import {
  normalizeAnswer,
  answersMatch,
  splitAlternates,
  isPartialMatch,
  placeDailyDoubles,
} from './utils/answerEval'
import { GAME_PHASES } from './utils/constants'
import { formatScore } from './utils/formatters'
import LobbyScreen from './components/LobbyScreen'
import GameBoard from './components/GameBoard'
import FinalJeopardyWagerScreen from './components/FinalJeopardyWagerScreen'
import GameOverScreen from './components/GameOverScreen'
import ProfileScreen from './components/ProfileScreen'
import DailyDoubleModal from './components/DailyDoubleModal'
import ClueModal from './components/ClueModal'
import AuthModal from './components/AuthModal'
import AchievementToasts from './components/AchievementToasts'

const CLUE_TIME_LIMIT = 20
const FINAL_JEOPARDY_TIME_LIMIT = 30
const MORE_SPECIFIC_TIME_LIMIT = 20

function checkAnswer(userText, clueResponse) {
  const norm = normalizeAnswer(userText)
  const normCorrect = normalizeAnswer(clueResponse)
  const alts = splitAlternates(clueResponse)
    .map(normalizeAnswer)
    .filter((a) => a !== normCorrect)
  return answersMatch(norm, normCorrect, alts)
}

function App() {
  // ── Categories ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // ── Game phase ──────────────────────────────────────────────────────────────
  const [gamePhase, setGamePhase] = useState(GAME_PHASES.LOBBY)
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
  const [didPass, setDidPass] = useState(false)
  const [needsMoreSpecific, setNeedsMoreSpecific] = useState(false)
  const [moreSpecificText, setMoreSpecificText] = useState('')
  const [moreSpecificTimeRemaining, setMoreSpecificTimeRemaining] = useState(MORE_SPECIFIC_TIME_LIMIT)

  // ── Score & per-round stats ─────────────────────────────────────────────────
  const [score, setScore] = useState(0)
  const [roundStats, setRoundStats] = useState({ correct: 0, incorrect: 0, timedOut: 0, passed: 0 })
  const [round1Stats, setRound1Stats] = useState(null)
  const [round2Stats, setRound2Stats] = useState(null)
  const [finalJeopardyCorrect, setFinalJeopardyCorrect] = useState(null)

  // ── Final Jeopardy sub-phase: 'wager' | 'clue' ─────────────────────────────
  const [finalSubPhase, setFinalSubPhase] = useState('wager')
  const [finalWagerText, setFinalWagerText] = useState('')

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState(() => loadToken())
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authTab, setAuthTab] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authDisplayName, setAuthDisplayName] = useState('')
  const [authError, setAuthError] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

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
        clearToken()
        setAuthToken(null)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save game when entering GAME_OVER (logged-in users) ────────────────
  useEffect(() => {
    if (gamePhase !== GAME_PHASES.GAME_OVER || !user || !authToken || gameSavedRef.current) return
    gameSavedRef.current = true

    saveGame(authToken, {
      finalScore: score,
      topics: selectedTopics,
      round1Correct: round1Stats?.correct ?? 0,
      round1Incorrect: round1Stats?.incorrect ?? 0,
      round1TimedOut: round1Stats?.timedOut ?? 0,
      round1Passed: round1Stats?.passed ?? 0,
      round2Correct: round2Stats?.correct ?? 0,
      round2Incorrect: round2Stats?.incorrect ?? 0,
      round2TimedOut: round2Stats?.timedOut ?? 0,
      round2Passed: round2Stats?.passed ?? 0,
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
    if (gamePhase !== GAME_PHASES.PROFILE || !authToken) return
    Promise.all([
      fetchMe(authToken).then((data) => { if (data) setUser(data) }),
      fetchAllAchievements().then((data) => setAchievementDefs(data ?? [])),
      fetchMyAchievements(authToken).then((data) => setAllAchievements(data ?? [])),
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
    if (!activeClue || isSubmitted || didTimeExpire || didPass || needsMoreSpecific) return

    if (timeRemaining <= 0) {
      setDidTimeExpire(true)
      if (!isSubmitted) {
        setRoundStats((rs) => ({ ...rs, timedOut: rs.timedOut + 1 }))
      }
      return
    }

    const id = window.setTimeout(() => setTimeRemaining((t) => t - 1), 1000)
    return () => window.clearTimeout(id)
  }, [activeClue, isSubmitted, didTimeExpire, didPass, needsMoreSpecific, timeRemaining])

  // ── "Be more specific" timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!needsMoreSpecific) return

    if (moreSpecificTimeRemaining <= 0) {
      const delta = activeWager !== null ? activeWager : (activeClue?.value ?? 0)
      setIsCorrect(false)
      setIsSubmitted(true)
      setScore((s) => s - delta)
      setNeedsMoreSpecific(false)
      if (gamePhase === GAME_PHASES.FINAL_JEOPARDY) {
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
    if (pendingWagerClue || (gamePhase === GAME_PHASES.FINAL_JEOPARDY && finalSubPhase === 'wager')) {
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

      saveToken(result.token, authTab === 'login' ? rememberMe : false)
      setAuthToken(result.token)
      setUser(result.user)
      setShowAuthModal(false)
      setAuthEmail('')
      setAuthPassword('')
      setAuthDisplayName('')
      setRememberMe(false)
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
    clearToken()
    setAuthToken(null)
    setUser(null)
    setGameHistory(null)
    setGamePhase(GAME_PHASES.LOBBY)
  }

  async function handleSignOutAll() {
    if (authToken) {
      try { await signOutAll(authToken) } catch { /* best-effort */ }
    }
    handleSignOut()
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
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0, passed: 0 })
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
      setGamePhase(GAME_PHASES.ROUND_1)
    } catch (err) {
      setGameError('Could not load the game. Make sure the backend is running.')
      console.error(err)
    } finally {
      setGameLoading(false)
    }
  }

  function advanceToRound2() {
    setRound1Stats(roundStats)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0, passed: 0 })
    setDailyDoubleIds(placeDailyDoubles(round2Board, 2))
    setActiveBoard(round2Board)
    setGamePhase(GAME_PHASES.ROUND_2)
  }

  function advanceToFinalJeopardy() {
    setRound2Stats(roundStats)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0, passed: 0 })

    if (!finalJeopardyData) {
      setGamePhase(GAME_PHASES.GAME_OVER)
      return
    }

    setFinalSubPhase('wager')
    setFinalWagerText('')
    setActiveClue(null)
    setActiveWager(null)
    setGamePhase(GAME_PHASES.FINAL_JEOPARDY)
  }

  function quitGame() {
    setGamePhase(GAME_PHASES.LOBBY)
    setActiveBoard([])
    setRound2Board([])
    setFinalJeopardyData(null)
    setDailyDoubleIds(new Set())
    setActiveClue(null)
    setActiveWager(null)
    setPendingWagerClue(null)
    setScore(0)
    setRoundStats({ correct: 0, incorrect: 0, timedOut: 0, passed: 0 })
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
    } else {
      openClue(selectedClue, null)
    }
  }

  function openClue(clue, wager) {
    setActiveClue(clue)
    setActiveWager(wager)
    setAnswerText('')
    setIsSubmitted(false)
    setIsCorrect(null)
    const timeLimit = gamePhase === GAME_PHASES.FINAL_JEOPARDY ? FINAL_JEOPARDY_TIME_LIMIT : CLUE_TIME_LIMIT
    setTimeRemaining(timeLimit)
    setDidTimeExpire(false)
    setDidPass(false)
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

    const correct = checkAnswer(answerText, activeClue.response)

    if (!correct && isPartialMatch(normalizeAnswer(answerText), normalizeAnswer(activeClue.response))) {
      setNeedsMoreSpecific(true)
      setMoreSpecificTimeRemaining(MORE_SPECIFIC_TIME_LIMIT)
      return
    }

    const delta = activeWager !== null ? activeWager : activeClue.value

    setIsCorrect(correct)
    setIsSubmitted(true)
    setScore((s) => (correct ? s + delta : s - delta))

    if (gamePhase === GAME_PHASES.FINAL_JEOPARDY) {
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

    const correct = checkAnswer(moreSpecificText, activeClue.response)
    const delta = activeWager !== null ? activeWager : activeClue.value

    setIsCorrect(correct)
    setIsSubmitted(true)
    setScore((s) => (correct ? s + delta : s - delta))
    setNeedsMoreSpecific(false)

    if (gamePhase === GAME_PHASES.FINAL_JEOPARDY) {
      setFinalJeopardyCorrect(correct)
    } else {
      setRoundStats((rs) => ({
        ...rs,
        correct: correct ? rs.correct + 1 : rs.correct,
        incorrect: !correct ? rs.incorrect + 1 : rs.incorrect,
      }))
    }
  }

  function handlePassClue() {
    setDidPass(true)
    setRoundStats((rs) => ({ ...rs, passed: rs.passed + 1 }))
  }

  function handleContinue() {
    if (gamePhase === GAME_PHASES.FINAL_JEOPARDY) {
      setGamePhase(GAME_PHASES.GAME_OVER)
    }
    setActiveClue(null)
    setActiveWager(null)
    setDidPass(false)
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
  const showReveal = isSubmitted || didTimeExpire || didPass
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
            {gamePhase !== GAME_PHASES.LOBBY && gamePhase !== GAME_PHASES.PROFILE && (
              <span className="round-badge">
                {gamePhase === GAME_PHASES.ROUND_1 && 'Round 1 — Jeopardy!'}
                {gamePhase === GAME_PHASES.ROUND_2 && 'Round 2 — Double Jeopardy!'}
                {gamePhase === GAME_PHASES.FINAL_JEOPARDY && 'Final Jeopardy!'}
                {gamePhase === GAME_PHASES.GAME_OVER && 'Game Over'}
              </span>
            )}
            <div className="score-chip">
              <span className="score-label">Score</span>
              <strong className="score-value">{formatScore(score)}</strong>
            </div>
            {user ? (
              <div className="profile-chip">
                <span className="profile-name" onClick={() => setGamePhase(GAME_PHASES.PROFILE)}>{user.displayName || user.email.split('@')[0]}</span>
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
            {gamePhase !== GAME_PHASES.LOBBY && gamePhase !== GAME_PHASES.GAME_OVER && gamePhase !== GAME_PHASES.PROFILE && (
              <button className="secondary-button" type="button" onClick={quitGame}>
                Quit
              </button>
            )}
          </div>
        </header>

        {gamePhase === GAME_PHASES.LOBBY && (
          <LobbyScreen
            categories={categories}
            selectedTopics={selectedTopics}
            showCategoryPicker={showCategoryPicker}
            atCategoryLimit={atCategoryLimit}
            gameLoading={gameLoading}
            gameError={gameError}
            onStartGame={startGame}
            onToggleTopic={toggleTopic}
            onTogglePicker={() => setShowCategoryPicker((v) => !v)}
            onClearTopics={() => setSelectedTopics([])}
          />
        )}

        {(gamePhase === GAME_PHASES.ROUND_1 || gamePhase === GAME_PHASES.ROUND_2) && (
          <GameBoard
            gamePhase={gamePhase}
            activeBoard={activeBoard}
            isBoardComplete={isBoardComplete}
            roundStats={roundStats}
            score={score}
            onAdvanceToRound2={advanceToRound2}
            onAdvanceToFinal={advanceToFinalJeopardy}
            onClueSelect={handleClueSelect}
          />
        )}

        {gamePhase === GAME_PHASES.FINAL_JEOPARDY && finalSubPhase === 'wager' && finalJeopardyData && (
          <FinalJeopardyWagerScreen
            finalJeopardyData={finalJeopardyData}
            score={score}
            finalWagerText={finalWagerText}
            onWagerChange={setFinalWagerText}
            wagerInputRef={wagerInputRef}
            onSubmit={handleFinalWagerSubmit}
          />
        )}

        {gamePhase === GAME_PHASES.GAME_OVER && (
          <GameOverScreen
            score={score}
            round1Stats={round1Stats}
            round2Stats={round2Stats}
            finalJeopardyCorrect={finalJeopardyCorrect}
            gameHistory={gameHistory}
            user={user}
            onPlayAgain={quitGame}
            onSignUpClick={() => { setShowAuthModal(true); setAuthTab('register') }}
          />
        )}

        {gamePhase === GAME_PHASES.PROFILE && (
          <ProfileScreen
            user={user}
            gameHistory={gameHistory}
            allAchievements={allAchievements}
            achievementDefs={achievementDefs}
            onSignOut={handleSignOut}
            onSignOutAll={handleSignOutAll}
            onBackToLobby={() => setGamePhase(GAME_PHASES.LOBBY)}
          />
        )}
      </div>

      {pendingWagerClue && (
        <DailyDoubleModal
          clue={pendingWagerClue}
          score={score}
          wagerText={wagerText}
          onWagerChange={setWagerText}
          wagerInputRef={wagerInputRef}
          onSubmit={handleWagerSubmit}
        />
      )}

      {activeClue && (
        <ClueModal
          clue={activeClue}
          activeWager={activeWager}
          timeRemaining={timeRemaining}
          didTimeExpire={didTimeExpire}
          needsMoreSpecific={needsMoreSpecific}
          moreSpecificTimeRemaining={moreSpecificTimeRemaining}
          moreSpecificText={moreSpecificText}
          onMoreSpecificChange={setMoreSpecificText}
          answerText={answerText}
          onAnswerChange={setAnswerText}
          isSubmitted={isSubmitted}
          isCorrect={isCorrect}
          showReveal={showReveal}
          activeDelta={activeDelta}
          answerInputRef={answerInputRef}
          moreSpecificInputRef={moreSpecificInputRef}
          onSubmitAnswer={handleSubmitAnswer}
          onSubmitMoreSpecific={handleSubmitMoreSpecific}
          onPass={handlePassClue}
          didPass={didPass}
          onContinue={handleContinue}
        />
      )}

      {showAuthModal && (
        <AuthModal
          authTab={authTab}
          authError={authError}
          authLoading={authLoading}
          authEmail={authEmail}
          authPassword={authPassword}
          authDisplayName={authDisplayName}
          rememberMe={rememberMe}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAuthPassword}
          onDisplayNameChange={setAuthDisplayName}
          onRememberMeChange={setRememberMe}
          onSwitchTab={switchAuthTab}
          onSubmit={handleAuthSubmit}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      <AchievementToasts achievements={newAchievements} />
    </main>
  )
}

export default App
