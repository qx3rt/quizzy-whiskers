import { useEffect, useState } from 'react'
import './App.css'
import { mockBoardData } from './data/mockBoardData'

const CLUE_TIME_LIMIT = 10

function normalizeAnswer(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatScore(score) {
  return `${score < 0 ? '-' : ''}$${Math.abs(score)}`
}

function App() {
  const [boardData, setBoardData] = useState(mockBoardData)
  const [activeClue, setActiveClue] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(CLUE_TIME_LIMIT)
  const [didTimeExpire, setDidTimeExpire] = useState(false)
  const [score, setScore] = useState(0)

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
    const answerMatches = normalizedUserAnswer === normalizedCorrectAnswer

    setIsCorrect(answerMatches)
    setIsSubmitted(true)
    setScore((currentScore) =>
      answerMatches
        ? currentScore + activeClue.value
        : currentScore - activeClue.value
    )
  }

  const showReveal = isSubmitted || didTimeExpire

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

            <div className="header-chip">MVP in progress</div>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="hero-kicker">Study clues. Beat the clock.</p>
            <h2>Train with real archived clues in a simple Jeopardy-style format.</h2>
            <p className="hero-description">
              Quizzy Whiskers is being built to help Liz study under
              Jeopardy-inspired conditions with category-based boards, timed clue
              responses, and answer framing built into the experience.
            </p>

            <button className="primary-button" type="button">
              Start session coming soon
            </button>
          </div>

          <div className="hero-card">
            <span className="card-label">Current build focus</span>
            <h3>Scored clue flow</h3>
            <p>
              Correct answers now add money, while incorrect or timed-out clues
              subtract money from the running score.
            </p>
          </div>
        </section>

        <section className="board-section panel panel-full">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Game board</p>
              <h3>Practice board preview</h3>
            </div>
            <span className="panel-tag">Interactive</span>
          </div>

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
        </section>

        <section className="info-grid">
          <article className="panel clue-panel">
            <div className="clue-panel-header">
              <p className="panel-eyebrow">Selected clue</p>

              {activeClue ? (
                <div
                  className={`timer-badge ${
                    timeRemaining <= 3 ? 'timer-warning' : ''
                  }`}
                >
                  {didTimeExpire ? "Time's up" : `${timeRemaining}s`}
                </div>
              ) : null}
            </div>

            {activeClue ? (
              <div className="clue-panel-content">
                <div className="clue-meta">
                  <span className="clue-value">${activeClue.value}</span>
                </div>

                <p className="clue-text">{activeClue.clue}</p>

                <form className="answer-form" onSubmit={handleSubmitAnswer}>
                  <label className="answer-label" htmlFor="answer-input">
                    Your response
                  </label>

                  <div className="answer-input-row">
                    <span className="answer-prefix">What is</span>
                    <input
                      id="answer-input"
                      className="answer-input"
                      type="text"
                      value={answerText}
                      onChange={(event) => setAnswerText(event.target.value)}
                      placeholder="type your answer"
                      disabled={isSubmitted || didTimeExpire}
                    />
                  </div>

                  <button
                    className="submit-button"
                    type="submit"
                    disabled={!answerText.trim() || isSubmitted || didTimeExpire}
                  >
                    {isSubmitted ? 'Submitted' : 'Submit response'}
                  </button>
                </form>

                {showReveal ? (
                  <>
                    <div
                      className={`result-banner ${
                        didTimeExpire
                          ? 'result-time'
                          : isCorrect
                            ? 'result-correct'
                            : 'result-incorrect'
                      }`}
                    >
                      <span className="result-label">
                        {didTimeExpire
                          ? 'Time expired'
                          : isCorrect
                            ? 'Nice work'
                            : 'Not a match'}
                      </span>
                      <strong>
                        {didTimeExpire
                          ? `-${formatScore(activeClue.value).replace('-', '')} applied for timeout.`
                          : isCorrect
                            ? `+${formatScore(activeClue.value)} earned for a correct response.`
                            : `-${formatScore(activeClue.value).replace('-', '')} applied for an incorrect response.`}
                      </strong>
                    </div>

                    <div className="response-preview">
                      <span className="response-label">Correct response</span>
                      <strong>What is {activeClue.response}?</strong>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">
                <p>Select a clue from the board to preview it here.</p>
              </div>
            )}
          </article>

          <article className="panel">
            <p className="panel-eyebrow">Session details</p>
            <ul className="detail-list">
              <li>
                <span>Mode</span>
                <strong>Single-player practice</strong>
              </li>
              <li>
                <span>Answer framing</span>
                <strong>Hardcoded before input</strong>
              </li>
              <li>
                <span>Timer</span>
                <strong>{CLUE_TIME_LIMIT} second countdown per clue</strong>
              </li>
              <li>
                <span>Scoring</span>
                <strong>Correct adds, incorrect subtracts</strong>
              </li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App