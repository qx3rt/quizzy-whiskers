import { useEffect, useState } from 'react';
import './App.css';

// Import multiple datasets
import shakespeareStudyClues from './data/processed/shakespeare-study-clues.json';
import charlesDickensClues from './data/processed/charles-dickens-clues.json';
import operaClues from './data/processed/opera-clues.json';
import classicalMusicClues from './data/processed/classical-music-clues.json';

const CLUE_TIME_LIMIT = 10;

function normalizeAnswer(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple fuzzy match using Levenshtein distance (max 2 edits)
function isFuzzyMatch(user, correct) {
  const s = user.toLowerCase();
  const t = correct.toLowerCase();

  const m = s.length;
  const n = t.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s[i - 1] === t[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n] <= 2;
}

function formatScore(score) {
  return `${score < 0 ? '-' : ''}${Math.abs(score)}`;
}

function App() {
  const [boardData, setBoardData] = useState([]);
  const [activeClue, setActiveClue] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(CLUE_TIME_LIMIT);
  const [didTimeExpire, setDidTimeExpire] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Build multi-category board
    const allClues = [
      ...shakespeareStudyClues,
      ...charlesDickensClues,
      ...operaClues,
      ...classicalMusicClues
    ];

    import('./utils/boardGenerator.js').then(({ generateBoardFromStudyClues }) => {
      setBoardData(generateBoardFromStudyClues(allClues));
    });
  }, []);

  useEffect(() => {
    if (!activeClue || isSubmitted || didTimeExpire) return;

    if (timeRemaining <= 0) {
      setDidTimeExpire(true);
      setScore(s => s - activeClue.value);
    }

    const timerId = setTimeout(() => setTimeRemaining(t => t - 1), 1000);
    return () => clearTimeout(timerId);
  }, [timeRemaining, activeClue, isSubmitted, didTimeExpire]);

  function handleClueSelect(selectedClue) {
    setDidTimeExpire(false);
    setActiveClue(selectedClue);
    setTimeRemaining(CLUE_TIME_LIMIT);
    setAnswerText('');
    setIsSubmitted(false);
    setIsCorrect(null);
  }

  function handleSubmitAnswer(event) {
    event.preventDefault();
    if (!activeClue || !answerText.trim() || didTimeExpire) return;

    const normalizedUserAnswer = normalizeAnswer(answerText);
    const normalizedCorrectAnswer = normalizeAnswer(activeClue.response);

    const answerMatches =
      normalizedUserAnswer === normalizedCorrectAnswer ||
      normalizedCorrectAnswer.includes(normalizedUserAnswer) ||
      normalizedUserAnswer.includes(normalizedCorrectAnswer) ||
      isFuzzyMatch(normalizedUserAnswer, normalizedCorrectAnswer);

    setIsCorrect(answerMatches);
    setIsSubmitted(true);
    setScore(currentScore =>
      answerMatches ? currentScore + activeClue.value : currentScore - activeClue.value
    );
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <p className="eyebrow">Quizzy Whiskers</p>
          <h1>Jeopardy practice, made cozy.</h1>
        </header>

        <section className="board-section">
          {boardData.map((category, idx) => (
            <div key={idx} className="board-category">
              <h3>{category.category}</h3>
              {category.clues.map(clue => (
                <button
                  key={clue.id}
                  className="clue-tile"
                  onClick={() => handleClueSelect(clue)}
                  disabled={clue.used}
                >
                  {clue.used ? '-' : `$${clue.value}`}
                </button>
              ))}
            </div>
          ))}
        </section>

        <section className="clue-section">
          {activeClue && (
            <div className="selected-clue">
              <span className="clue-value">${activeClue.value}</span>
              <p className="clue-text">{activeClue.clue}</p>
              <form onSubmit={handleSubmitAnswer}>
                <label>Your response</label>
                <div className="answer-input-container">
                  <span className="answer-prefix">What is</span>
                  <input
                    type="text"
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                  />
                </div>
                <button type="submit">Submit response</button>
              </form>
              {isSubmitted && (
                <div className={`result ${isCorrect ? 'correct' : 'incorrect'}`}>
                  {isCorrect ? 'Nice work' : 'Not a match'}
                  <br />
                  {isCorrect
                    ? `+$${activeClue.value} earned for a correct response.`
                    : `-$${activeClue.value} applied for an incorrect response.`}
                </div>
              )}
              {didTimeExpire && !isSubmitted && (
                <div className="result timeout">
                  Time expired
                  <br />
                  -${activeClue.value} applied for timeout.
                </div>
              )}
            </div>
          )}

          <div className="session-details">
            <div>Mode: Single-player practice</div>
            <div>Dataset: Real Shakespeare archive clues</div>
            <div>Timer: 10 second countdown per clue</div>
            <div>Score: ${score}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;