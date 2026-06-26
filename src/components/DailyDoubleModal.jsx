export default function DailyDoubleModal({ clue, score, wagerText, onWagerChange, wagerInputRef, onSubmit }) {
  return (
    <div className="clue-modal-overlay">
      <div className="clue-modal daily-double-modal">
        <div className="clue-modal-meta">
          <span className="clue-modal-category">{clue.category}</span>
          <span className="dd-badge">Daily Double!</span>
        </div>
        <div className="clue-modal-value">${clue.value.toLocaleString()}</div>
        <p className="clue-modal-text dd-wager-prompt">
          Enter your wager. Min $5 · Max ${Math.max(score, clue.value).toLocaleString()}
        </p>
        <form className="clue-modal-form" onSubmit={onSubmit}>
          <div className="clue-modal-input-row">
            <span className="answer-prefix">Wager $</span>
            <input
              ref={wagerInputRef}
              className="clue-modal-input"
              type="number"
              min="5"
              max={Math.max(score, clue.value)}
              value={wagerText}
              onChange={(e) => onWagerChange(e.target.value)}
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
  )
}
