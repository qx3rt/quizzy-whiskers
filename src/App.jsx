import { useState } from 'react'
import './App.css'

const initialBoardData = [
  {
    category: 'History',
    clues: [
      {
        id: 'history-200',
        value: 200,
        clue: 'This president issued the Emancipation Proclamation.',
        response: 'Abraham Lincoln',
        used: false,
      },
      {
        id: 'history-400',
        value: 400,
        clue: 'This wall fell in 1989, marking a major Cold War turning point.',
        response: 'The Berlin Wall',
        used: false,
      },
      {
        id: 'history-600',
        value: 600,
        clue: 'This ancient civilization built Machu Picchu.',
        response: 'The Inca',
        used: false,
      },
      {
        id: 'history-800',
        value: 800,
        clue: 'This French heroine was tried for heresy and later canonized.',
        response: 'Joan of Arc',
        used: false,
      },
      {
        id: 'history-1000',
        value: 1000,
        clue: 'The Magna Carta was signed in this year.',
        response: '1215',
        used: false,
      },
    ],
  },
  {
    category: 'Literature',
    clues: [
      {
        id: 'literature-200',
        value: 200,
        clue: 'This Shakespeare prince asks, “To be, or not to be?”',
        response: 'Hamlet',
        used: false,
      },
      {
        id: 'literature-400',
        value: 400,
        clue: 'She wrote Pride and Prejudice.',
        response: 'Jane Austen',
        used: false,
      },
      {
        id: 'literature-600',
        value: 600,
        clue: 'This captain pursues the white whale in Moby-Dick.',
        response: 'Ahab',
        used: false,
      },
      {
        id: 'literature-800',
        value: 800,
        clue: 'This dystopian novel introduces Big Brother.',
        response: '1984',
        used: false,
      },
      {
        id: 'literature-1000',
        value: 1000,
        clue: 'The Divine Comedy was written by this Italian poet.',
        response: 'Dante',
        used: false,
      },
    ],
  },
  {
    category: 'Science',
    clues: [
      {
        id: 'science-200',
        value: 200,
        clue: 'This planet is known as the Red Planet.',
        response: 'Mars',
        used: false,
      },
      {
        id: 'science-400',
        value: 400,
        clue: 'H2O is the chemical formula for this substance.',
        response: 'Water',
        used: false,
      },
      {
        id: 'science-600',
        value: 600,
        clue: 'This force keeps planets in orbit around the sun.',
        response: 'Gravity',
        used: false,
      },
      {
        id: 'science-800',
        value: 800,
        clue: 'This particle has a negative electric charge.',
        response: 'Electron',
        used: false,
      },
      {
        id: 'science-1000',
        value: 1000,
        clue: 'This biologist proposed natural selection as a mechanism of evolution.',
        response: 'Charles Darwin',
        used: false,
      },
    ],
  },
  {
    category: 'Film',
    clues: [
      {
        id: 'film-200',
        value: 200,
        clue: 'This 1997 film features Jack and Rose aboard a doomed ship.',
        response: 'Titanic',
        used: false,
      },
      {
        id: 'film-400',
        value: 400,
        clue: 'He directed Jaws, E.T., and Jurassic Park.',
        response: 'Steven Spielberg',
        used: false,
      },
      {
        id: 'film-600',
        value: 600,
        clue: 'This saga includes the characters Luke Skywalker and Darth Vader.',
        response: 'Star Wars',
        used: false,
      },
      {
        id: 'film-800',
        value: 800,
        clue: 'The Godfather was based on a novel by this author.',
        response: 'Mario Puzo',
        used: false,
      },
      {
        id: 'film-1000',
        value: 1000,
        clue: 'This South Korean film won the 2020 Oscar for Best Picture.',
        response: 'Parasite',
        used: false,
      },
    ],
  },
  {
    category: 'Geography',
    clues: [
      {
        id: 'geography-200',
        value: 200,
        clue: 'This river runs through Egypt.',
        response: 'The Nile',
        used: false,
      },
      {
        id: 'geography-400',
        value: 400,
        clue: 'This country contains the city of Kyoto.',
        response: 'Japan',
        used: false,
      },
      {
        id: 'geography-600',
        value: 600,
        clue: 'Mount Kilimanjaro is located in this country.',
        response: 'Tanzania',
        used: false,
      },
      {
        id: 'geography-800',
        value: 800,
        clue: 'This desert spans much of northern Africa.',
        response: 'The Sahara',
        used: false,
      },
      {
        id: 'geography-1000',
        value: 1000,
        clue: 'This capital city sits on the Tiber River.',
        response: 'Rome',
        used: false,
      },
    ],
  },
  {
    category: 'Word Origins',
    clues: [
      {
        id: 'word-origins-200',
        value: 200,
        clue: 'This word for a handwritten book comes from the Latin for “written by hand.”',
        response: 'Manuscript',
        used: false,
      },
      {
        id: 'word-origins-400',
        value: 400,
        clue: 'This word for love of books comes from Greek roots meaning “book” and “loving.”',
        response: 'Bibliophile',
        used: false,
      },
      {
        id: 'word-origins-600',
        value: 600,
        clue: 'This beverage name comes from the Chinese word “te.”',
        response: 'Tea',
        used: false,
      },
      {
        id: 'word-origins-800',
        value: 800,
        clue: 'This adjective for feline-like behavior comes from the Latin cattus.',
        response: 'Catty',
        used: false,
      },
      {
        id: 'word-origins-1000',
        value: 1000,
        clue: 'This word for a place of study comes from Greek roots meaning “leisure” and “learning.”',
        response: 'School',
        used: false,
      },
    ],
  },
]

function App() {
  const [boardData, setBoardData] = useState(initialBoardData)
  const [activeClue, setActiveClue] = useState(null)

  function handleClueSelect(selectedClue) {
    if (selectedClue.used) {
      return
    }

    setActiveClue(selectedClue)

    setBoardData((currentBoard) =>
      currentBoard.map((column) => ({
        ...column,
        clues: column.clues.map((clue) =>
          clue.id === selectedClue.id ? { ...clue, used: true } : clue
        ),
      }))
    )
  }

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
            <h3>Clue selection interaction</h3>
            <p>
              Click a clue to reveal it in the study panel and mark it as used on
              the board.
            </p>
          </div>
        </section>

        <section className="board-section panel panel-full">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Game board</p>
              <h3>Practice board preview</h3>
            </div>
            <span className="panel-tag">Interactive</span>
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
            <p className="panel-eyebrow">Selected clue</p>

            {activeClue ? (
              <div className="clue-panel-content">
                <div className="clue-meta">
                  <span className="clue-value">${activeClue.value}</span>
                </div>

                <p className="clue-text">{activeClue.clue}</p>

                <div className="response-preview">
                  <span className="response-label">Correct response</span>
                  <strong>What is {activeClue.response}?</strong>
                </div>
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
                <span>Answer framing</span>
                <strong>Hardcoded before input</strong>
              </li>
              <li>
                <span>Primary prompt</span>
                <strong>What is</strong>
              </li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App