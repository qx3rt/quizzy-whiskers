import { useEffect, useMemo, useState } from 'react'
import './App.css'
import shakespeareStudyClues from './data/processed/shakespeare-study-clues.json'
import charlesDickensStudyClues from './data/processed/charles-dickens-study-clues.json'
import operaStudyClues from './data/processed/opera-study-clues.json'
import classicalMusicStudyClues from './data/processed/classical-music-study-clues.json'
import finalJeopardyStudyClues from './data/processed/final-jeopardy-study-clues.json'
import {
  generateMultiCategoryBoard,
} from './utils/boardGenerator'

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
  const initialBoardData = useMemo(
    () =>
      generateMultiCategoryBoard([
        {
          categoryName: 'Shakespeare',
          clues: shakespeareStudyClues,
        },
        {
          categoryName: 'Charles Dickens',
          clues: charlesDickensStudyClues,
        },
        {
          categoryName: 'Opera',
          clues: operaStudyClues,
        },
        {
          categoryName: 'Classical Music',
          clues: classicalMusicStudyClues,
        },
        {
          categoryName: 'Final Jeopardy',
          clues: finalJeopardyStudyClues,
        },
        {
          categoryName: 'Shakespeare Encore',
          clues: shakespeareStudyClues,
        },
      ]),
    []
  )

  const [boardData, setBoardData] = useState(initialBoardData)
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

            <div className="header-chip">Real data enabled</div>
          </div>
        </header>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="hero-kicker">Study clues. Beat the clock.</p>
            <h2>Train with real archived clues in a simple Jeopardy-style format.</h2>
            <p className="hero-description">
              Quizzy Whiskers is now running on multiple real archive datasets,
              giving Liz a more authentic Jeopardy-style study experience.
            </p>

            <button className="primary-button" type="button">
              Start session coming soon
            </button>
          </div>

          <div className="hero-card">
            <span className="card-label">Current build focus</span>
            <h3>Multi-category realism</h3>
            <p>
              The board now pulls from multiple real categories while keeping
              answer validation flexible and clue quality filtered.
            </p>
          </div>
        </section>

        <section className="board-section panel panel-full">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Game board</p>
              <h3>Practice board preview</h3>
            </div>
            <span className="panel-tag">Archive-backed</span>
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
                <span>Datasets</span>
                <strong>Shakespeare, Dickens, Opera, Classical Music, Final Jeopardy</strong>
              </li>
              <li>
                <span>Timer</span>
                <strong>{CLUE_TIME_LIMIT} second countdown per clue</strong>
              </li>
              <li>
                <span>Scoring</span>
                <strong>Correct adds, incorrect subtracts</strong>
              </li>
              <li>
                <span>Validation</span>
                <strong>Flexible match with typo tolerance</strong>
              </li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App