import './App.css'

const boardData = [
  {
    category: 'History',
    clues: [200, 400, 600, 800, 1000],
  },
  {
    category: 'Literature',
    clues: [200, 400, 600, 800, 1000],
  },
  {
    category: 'Science',
    clues: [200, 400, 600, 800, 1000],
  },
  {
    category: 'Film',
    clues: [200, 400, 600, 800, 1000],
  },
  {
    category: 'Geography',
    clues: [200, 400, 600, 800, 1000],
  },
  {
    category: 'Word Origins',
    clues: [200, 400, 600, 800, 1000],
  },
]

function App() {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <div>
            <p className="eyebrow">Quizzy Whiskers</p>
            <h1>Jeopardy practice, made cozy.</h1>
          </div>

          <div className="header-chip">MVP in progress</div>
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
            <h3>Board rendering foundation</h3>
            <p>
              This step turns the placeholder board into a real data-driven grid
              so gameplay logic can be added next.
            </p>
          </div>
        </section>

        <section className="board-section panel panel-full">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Game board</p>
              <h3>Practice board preview</h3>
            </div>
            <span className="panel-tag">Data-backed</span>
          </div>

          <div className="game-board">
            {boardData.map((column) => (
              <div key={column.category} className="board-column">
                <div className="category-cell">{column.category}</div>

                {column.clues.map((value) => (
                  <button
                    key={`${column.category}-${value}`}
                    className="clue-cell"
                    type="button"
                  >
                    ${value}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="info-grid">
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
                <span>Primary prompt</span>
                <strong>What is</strong>
              </li>
            </ul>
          </article>

          <article className="panel">
            <p className="panel-eyebrow">Build roadmap</p>
            <ul className="detail-list">
              <li>
                <span>Next</span>
                <strong>Clue selection state</strong>
              </li>
              <li>
                <span>After that</span>
                <strong>Clue view + timer</strong>
              </li>
              <li>
                <span>Then</span>
                <strong>Answer input + score</strong>
              </li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App