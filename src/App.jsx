import './App.css'

function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Study clues. Beat the clock.</p>
        <h1>Quizzy Whiskers 🐱</h1>
        <p className="description">
          A cozy Jeopardy-style study simulator built to help Liz practice with
          real archived clues under timed conditions.
        </p>

        <div className="status-panel">
          <div className="status-item">
            <span className="status-label">Project status</span>
            <span className="status-value">Baseline setup in progress</span>
          </div>
          <div className="status-item">
            <span className="status-label">Next milestone</span>
            <span className="status-value">Build the first playable board</span>
          </div>
        </div>

        <button className="primary-button" type="button">
          Start Coming Soon
        </button>
      </section>
    </main>
  )
}

export default App