export const ACHIEVEMENT_ICONS = {
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

export function getAchievementIcon(slug) {
  return ACHIEVEMENT_ICONS[slug] ?? '🏆'
}

const CELEBRATION_PHRASES = [
  "Let's go!",
  "You legend!",
  "Incredible!",
  "Nailed it!",
  "Too easy!",
  "Outstanding!",
  "Phenomenal!",
  "You're on fire!",
  "Unstoppable!",
  "Brilliant!",
  "That's the stuff!",
  "Oh yeah!",
  "Woo-hoo!",
  "Sensational!",
  "Magnificent!",
]

export function pickCelebrationPhrase() {
  return CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)]
}
