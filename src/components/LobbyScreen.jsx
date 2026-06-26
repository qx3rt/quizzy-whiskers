export default function LobbyScreen({
  categories,
  selectedTopics,
  showCategoryPicker,
  atCategoryLimit,
  gameLoading,
  gameError,
  onStartGame,
  onToggleTopic,
  onTogglePicker,
  onClearTopics,
}) {
  return (
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
              onClick={onStartGame}
              disabled={gameLoading}
            >
              {gameLoading ? 'Loading game…' : 'Start New Game'}
            </button>
            <button
              className="secondary-button lobby-picker-toggle"
              type="button"
              onClick={onTogglePicker}
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
            {selectedTopics.length > 0 && (
              <span className="panel-tag">{selectedTopics.length} / 6 selected</span>
            )}
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
                  onClick={() => onToggleTopic(cat.id)}
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
              onClick={onStartGame}
              disabled={gameLoading}
            >
              {selectedTopics.length === 0 ? 'Start with random topics' : 'Start game'}
            </button>
            {selectedTopics.length > 0 && (
              <button
                className="secondary-button"
                type="button"
                onClick={onClearTopics}
              >
                Clear selection
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
