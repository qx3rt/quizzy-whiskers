import { formatScore } from '../utils/formatters'

export default function FinalJeopardyWagerScreen({
  finalJeopardyData,
  score,
  finalWagerText,
  onWagerChange,
  wagerInputRef,
  onSubmit,
}) {
  return (
    <section className="panel panel-full final-jeopardy-panel">
      <p className="panel-eyebrow">Final Jeopardy!</p>
      <div className="fj-category">{finalJeopardyData.category}</div>
      <p className="fj-description">
        The category has been revealed. Enter your wager before the clue appears.
      </p>
      <p className="fj-balance">Current score: {formatScore(score)}</p>
      <form className="fj-wager-form" onSubmit={onSubmit}>
        <div className="clue-modal-input-row fj-wager-row">
          <span className="answer-prefix">Wager $</span>
          <input
            ref={wagerInputRef}
            className="clue-modal-input"
            type="number"
            min="0"
            max={Math.max(score, 0)}
            value={finalWagerText}
            onChange={(e) => onWagerChange(e.target.value)}
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
  )
}
