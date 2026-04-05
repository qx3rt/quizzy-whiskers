import './App.css'

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
            <h3>App shell foundation</h3>
            <p>
              This step creates the structure for the future board, timer, score,
              and clue-answer flow.
            </p>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="panel panel-large">
            <div className="panel-header">
              <div>
                <p className="panel-eyebrow">Game board</p>
                <h3>Playable board area</h3>
              </div>
              <span className="panel-tag">Placeholder</span>
            </div>

            <div className="board-placeholder">
              <div className="board-row">
                <span>History</span>
                <span>Literature</span>
                <span>Science</span>
              </div>
              <div className="board-row values">
                <span>$200</span>
                <span>$400</span>
                <span>$600</span>
              </div>
              <div className="board-row values">
                <span>$800</span>
                <span>$1000</span>
                <span>$1200</span>
              </div>
            </div>
          </article>

          <aside className="sidebar-stack">
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
                  <strong>Board data structure</strong>
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
          </aside>
        </section>
      </div>
    </main>
  )
}

export default App