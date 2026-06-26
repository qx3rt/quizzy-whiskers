import { formatScore } from '../utils/formatters'

export default function GameOverScreen({
  score,
  round1Stats,
  round2Stats,
  finalJeopardyCorrect,
  gameHistory,
  user,
  onPlayAgain,
  onSignUpClick,
}) {
  return (
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
              {round1Stats.passed > 0 && ` · ${round1Stats.passed} passed`}
            </span>
          </div>
        )}
        {round2Stats && (
          <div className="round-stat-row">
            <span className="round-stat-label">Round 2</span>
            <span className="round-stat-detail">
              {round2Stats.correct} correct · {round2Stats.incorrect} wrong ·{' '}
              {round2Stats.timedOut} timed out
              {round2Stats.passed > 0 && ` · ${round2Stats.passed} passed`}
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
            onClick={onSignUpClick}
          >
            Create a free account
          </button>{' '}
          to track your scores and earn achievements.
        </p>
      )}

      <button className="primary-button" type="button" onClick={onPlayAgain}>
        Play Again
      </button>
    </section>
  )
}
