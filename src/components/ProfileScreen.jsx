import { formatScore, formatMemberSince, timeAgo } from '../utils/formatters'

const ACHIEVEMENT_ICONS = {
  first_game: '🎯',
  ten_games: '🔟',
  fifty_games: '🏆',
  century_club: '💯',
  perfect_round: '✨',
  perfect_game: '🏅',
  no_timeouts: '⚡',
  double_dominator: '💰',
  final_jeopardy_winner: '🎤',
  fj_regular: '🌟',
  high_roller: '💵',
  grand_champion: '👑',
  answer_machine: '🧠',
}

export default function ProfileScreen({
  user,
  gameHistory,
  allAchievements,
  achievementDefs,
  onSignOut,
  onBackToLobby,
}) {
  if (!user) {
    return (
      <section className="panel panel-full profile-panel">
        <p className="profile-loading">Loading profile…</p>
        <button className="secondary-button" type="button" onClick={onBackToLobby}>
          ← Back to Lobby
        </button>
      </section>
    )
  }

  const ls = gameHistory?.lifetimeStats
  const accuracy = ls?.totalAnswered > 0
    ? Math.round((ls.totalCorrect / ls.totalAnswered) * 100)
    : null
  const fjRate = ls?.totalGames > 0
    ? Math.round((ls.finalJeopardyWins / ls.totalGames) * 100)
    : null

  const earned = new Map((allAchievements ?? []).map((a) => [a.slug, a.earned_at]))
  const merged = (achievementDefs ?? []).map((def) => ({
    ...def,
    earned_at: earned.get(def.slug) || null,
  }))
  const earnedCount = merged.filter((a) => a.earned_at).length

  return (
    <section className="panel panel-full profile-panel">
      <div className="profile-identity">
        <div className="profile-avatar">
          {(user.displayName || user.email).charAt(0).toUpperCase()}
        </div>
        <div className="profile-meta">
          <h2>{user.displayName || user.email.split('@')[0]}</h2>
          <p className="profile-email">{user.email}</p>
          {user.memberSince && (
            <p className="profile-member-since">Member since {formatMemberSince(user.memberSince)}</p>
          )}
        </div>
        <button className="secondary-button profile-signout-btn" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <div className="profile-stats-bar">
        <div className="stat-card">
          <div className="stat-value">{ls?.totalGames ?? 0}</div>
          <div className="stat-label">Games Played</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ls?.bestScore ? `$${ls.bestScore.toLocaleString()}` : '—'}</div>
          <div className="stat-label">Best Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{accuracy !== null ? `${accuracy}%` : '—'}</div>
          <div className="stat-label">Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fjRate !== null ? `${fjRate}%` : '—'}</div>
          <div className="stat-label">FJ Win Rate</div>
        </div>
      </div>

      <div className="profile-section">
        <h3>Achievements <span className="achievement-count">{earnedCount}/{merged.length}</span></h3>
        <div className="profile-achievements">
          {merged.map((ach) => (
            <div key={ach.slug} className={`achievement-card${ach.earned_at ? ' earned' : ''}`}>
              <div className="achievement-icon">{ACHIEVEMENT_ICONS[ach.slug] || '🎖️'}</div>
              <div className="achievement-content">
                <div className="achievement-name">{ach.name}</div>
                <div className="achievement-desc">{ach.description}</div>
                {ach.earned_at ? (
                  <div className="achievement-earned">Earned {timeAgo(ach.earned_at)}</div>
                ) : (
                  <div className="achievement-locked-label">Locked</div>
                )}
              </div>
              {!ach.earned_at && <div className="achievement-lock-icon">🔒</div>}
            </div>
          ))}
          {merged.length === 0 && (
            <p className="no-achievements">Complete games to earn achievements!</p>
          )}
        </div>
      </div>

      {gameHistory?.games?.length > 0 && (
        <div className="profile-section">
          <h3>Recent Games</h3>
          <div className="game-history-list">
            {gameHistory.games.slice(0, 10).map((game) => {
              const date = new Date(game.played_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              const topics = game.topics ? game.topics.split(',').filter(Boolean) : []
              const fjResult = game.final_jeopardy_correct === 1 ? '✓' : game.final_jeopardy_correct === 0 ? '✗' : '—'
              return (
                <div key={game.id} className="game-history-row">
                  <div className="game-history-main">
                    <span className="game-history-date">{date}</span>
                    {topics.length > 0 && (
                      <div className="game-history-topics">
                        {topics.map((t) => (
                          <span key={t} className="game-history-topic-pill">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="game-history-breakdown">
                      R1 {game.round1_correct}✓ {game.round1_incorrect}✗
                      &nbsp;·&nbsp;
                      R2 {game.round2_correct}✓ {game.round2_incorrect}✗
                      &nbsp;·&nbsp;
                      FJ {fjResult}
                    </div>
                  </div>
                  <div className="game-history-score">{formatScore(game.final_score)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button className="secondary-button" type="button" onClick={onBackToLobby}>
        ← Back to Lobby
      </button>
    </section>
  )
}
