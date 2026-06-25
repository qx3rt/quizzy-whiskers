import { GAME_PHASES } from '../utils/constants'
import { formatScore } from '../utils/formatters'

export default function GameBoard({
  gamePhase,
  activeBoard,
  isBoardComplete,
  roundStats,
  score,
  onAdvanceToRound2,
  onAdvanceToFinal,
  onClueSelect,
}) {
  if (isBoardComplete) {
    return (
      <section className="panel panel-full round-complete-panel">
        <p className="panel-eyebrow">
          {gamePhase === GAME_PHASES.ROUND_1 ? 'Round 1 Complete' : 'Round 2 Complete'}
        </p>
        <h2 className="round-complete-score">{formatScore(score)}</h2>
        <p className="round-complete-stats">
          {roundStats.correct} correct · {roundStats.incorrect} incorrect ·{' '}
          {roundStats.timedOut} timed out
        </p>
        <button
          className="primary-button"
          type="button"
          onClick={gamePhase === GAME_PHASES.ROUND_1 ? onAdvanceToRound2 : onAdvanceToFinal}
        >
          {gamePhase === GAME_PHASES.ROUND_1
            ? 'Start Round 2 — Double Jeopardy!'
            : 'Go to Final Jeopardy!'}
        </button>
      </section>
    )
  }

  return (
    <section className="board-section panel panel-full">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            {gamePhase === GAME_PHASES.ROUND_1 ? 'Round 1 — Jeopardy!' : 'Round 2 — Double Jeopardy!'}
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
                onClick={() => onClueSelect({ ...clue, category: column.category })}
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
}
