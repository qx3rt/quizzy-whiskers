export default function ClueModal({
  clue,
  activeWager,
  timeRemaining,
  didTimeExpire,
  didPass,
  needsMoreSpecific,
  moreSpecificTimeRemaining,
  moreSpecificText,
  onMoreSpecificChange,
  answerText,
  onAnswerChange,
  isSubmitted,
  isCorrect,
  showReveal,
  activeDelta,
  answerInputRef,
  moreSpecificInputRef,
  onSubmitAnswer,
  onSubmitMoreSpecific,
  onPass,
  onContinue,
}) {
  return (
    <div className="clue-modal-overlay">
      <div className="clue-modal">
        <div className="clue-modal-meta">
          <span className="clue-modal-category">{clue.category}</span>
          <div className={`timer-badge ${
            needsMoreSpecific
              ? moreSpecificTimeRemaining <= 3 ? 'timer-warning' : ''
              : timeRemaining <= 3 ? 'timer-warning' : ''
          }`}>
            {needsMoreSpecific
              ? `${moreSpecificTimeRemaining}s`
              : didTimeExpire ? "Time's up" : didPass ? 'Passed' : `${timeRemaining}s`}
          </div>
        </div>

        {activeWager !== null ? (
          <div className="clue-modal-value wager-value">
            <span className="wager-label">Wagered</span>
            ${activeWager.toLocaleString()}
          </div>
        ) : (
          <div className="clue-modal-value">${clue.value.toLocaleString()}</div>
        )}

        <p className="clue-modal-text">{clue.clue}</p>

        {needsMoreSpecific ? (
          <div className="clue-modal-specific">
            <p className="specific-prompt">Can you be more specific?</p>
            <form className="clue-modal-form" onSubmit={onSubmitMoreSpecific}>
              <div className="clue-modal-input-row">
                <span className="answer-prefix">What is</span>
                <input
                  ref={moreSpecificInputRef}
                  className="clue-modal-input"
                  type="text"
                  value={moreSpecificText}
                  onChange={(e) => onMoreSpecificChange(e.target.value)}
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
          <form className="clue-modal-form" onSubmit={onSubmitAnswer}>
            <div className="clue-modal-input-row">
              <span className="answer-prefix">What is</span>
              <input
                ref={answerInputRef}
                className="clue-modal-input"
                type="text"
                value={answerText}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="type your answer…"
                disabled={isSubmitted || didTimeExpire}
                autoComplete="off"
              />
            </div>
            <div className="clue-modal-actions">
              <button
                className="clue-modal-submit"
                type="submit"
                disabled={!answerText.trim() || isSubmitted || didTimeExpire}
              >
                Submit response
              </button>
              <button
                className="clue-modal-pass"
                type="button"
                onClick={onPass}
                disabled={isSubmitted || didTimeExpire}
              >
                I Don&apos;t Know
              </button>
            </div>
            <p className="clue-modal-hint">Letting the timer run out won&rsquo;t affect your score.</p>
          </form>
        ) : (
          <div className="clue-modal-result">
            <div
              className={`clue-modal-verdict ${
                didPass
                  ? 'verdict-pass'
                  : didTimeExpire
                    ? 'verdict-time'
                    : isCorrect
                      ? 'verdict-correct'
                      : 'verdict-incorrect'
              }`}
            >
              <span className="verdict-label">
                {didPass ? 'Passed' : didTimeExpire ? "Time's up" : isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
              <span className="verdict-delta">
                {didPass
                  ? ''
                  : didTimeExpire && !isSubmitted
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
              <strong>What is {clue.response}?</strong>
            </div>

            <button className="clue-modal-continue" type="button" onClick={onContinue}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
